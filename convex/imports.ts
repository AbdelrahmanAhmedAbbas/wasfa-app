import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { requireUserId } from "./authz";
import type { RecipeDraft } from "./lib/types";
import {
  detectSourcePlatform,
  extractFirstUrl,
  isSupportedSource,
  normalizeSourceUrl,
  resolveTikTokSourceUrl,
  validateRecipeDraft,
} from "./lib/validation";
import { canonicalYouTubeShortUrl, isYouTubeUrl, parseYouTubeShortId } from "./lib/youtube";
import { importEntrypoint, importStatus, sourcePlatform } from "./schema";

const MAX_SHARED_TEXT_LENGTH = 10_000;
const IMPORTS_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;
// A link submitted again within this window returns the import already running for it.
const DEDUPE_WINDOW_MS = 30 * 60 * 1000;

const UNSUPPORTED_URL_MESSAGE = "Unsupported source URL. Only Instagram, TikTok and YouTube Shorts are allowed.";

/** A rejection the app shows in its own language, by code. */
function rejection(code: string, message: string) {
  return new ConvexError({ code, message });
}

/**
 * Starts importing a recipe from a shared link. The link comes either on its own or
 * inside the text the share sheet passed along.
 */
export const create = action({
  args: {
    sourceUrl: v.optional(v.string()),
    sharedText: v.optional(v.string()),
    entrypoint: v.optional(importEntrypoint),
  },
  handler: async (ctx, args): Promise<{ job_id: Id<"import_jobs">; status: string; deduplicated: boolean }> => {
    const userId = await requireUserId(ctx);

    const submittedUrl =
      (args.sourceUrl ? normalizeSourceUrl(args.sourceUrl) : null) ??
      (args.sharedText ? extractFirstUrl(args.sharedText) : null);
    if (!submittedUrl) throw rejection("UNSUPPORTED_URL", UNSUPPORTED_URL_MESSAGE);

    const submittedShortId = parseYouTubeShortId(submittedUrl);
    if (isYouTubeUrl(submittedUrl) && !submittedShortId) {
      throw rejection(
        "YOUTUBE_NOT_A_SHORT",
        "Only YouTube Shorts can be imported. Open the Short on YouTube and share it from there."
      );
    }
    if (!isSupportedSource(submittedUrl) || detectSourcePlatform(submittedUrl) === "unknown") {
      throw rejection("UNSUPPORTED_URL", UNSUPPORTED_URL_MESSAGE);
    }

    // A TikTok share link is a short redirect; the job stores the video's own address.
    const resolution =
      detectSourcePlatform(submittedUrl) === "tiktok"
        ? await resolveTikTokSourceUrl(submittedUrl)
        : submittedShortId
          ? { url: canonicalYouTubeShortUrl(submittedShortId), resolved: false }
          : { url: submittedUrl, resolved: false };

    const platform = detectSourcePlatform(resolution.url);
    if (!isSupportedSource(resolution.url) || platform === "unknown") {
      throw rejection("UNSUPPORTED_URL", UNSUPPORTED_URL_MESSAGE);
    }

    const started: { rateLimited: true } | { rateLimited: false; jobId: Id<"import_jobs">; status: string; deduplicated: boolean } =
      await ctx.runMutation(internal.imports.start, {
        userId,
        sourceUrl: resolution.url,
        sourcePlatform: platform,
        entrypoint: args.entrypoint ?? "paste_url",
        sharedText: args.sharedText?.slice(0, MAX_SHARED_TEXT_LENGTH),
        submittedUrl,
        urlResolved: resolution.resolved,
      });

    if (started.rateLimited) {
      throw rejection("RATE_LIMITED", "Rate limit reached. Please wait before creating more import jobs.");
    }
    return { job_id: started.jobId, status: started.status, deduplicated: started.deduplicated };
  },
});

/** Records the import job and hands it to the pipeline, unless the user is over the hourly limit. */
export const start = internalMutation({
  args: {
    userId: v.id("users"),
    sourceUrl: v.string(),
    sourcePlatform,
    entrypoint: importEntrypoint,
    sharedText: v.optional(v.string()),
    submittedUrl: v.string(),
    urlResolved: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const lastHour = await ctx.db
      .query("import_jobs")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.userId).gt("_creationTime", now - HOUR_MS))
      .take(IMPORTS_PER_HOUR);
    if (lastHour.length >= IMPORTS_PER_HOUR) return { rateLimited: true as const };

    const sameLink = await ctx.db
      .query("import_jobs")
      .withIndex("by_user_id_and_source_url", (q) =>
        q.eq("user_id", args.userId).eq("source_url", args.sourceUrl).gt("_creationTime", now - DEDUPE_WINDOW_MS)
      )
      .order("desc")
      .take(5);
    const running = sameLink.find((job) => job.status !== "confirmed" && job.status !== "failed");
    if (running) {
      return { rateLimited: false as const, jobId: running._id, status: running.status, deduplicated: true };
    }

    const jobId = await ctx.db.insert("import_jobs", {
      user_id: args.userId,
      source_platform: args.sourcePlatform,
      entrypoint: args.entrypoint,
      source_url: args.sourceUrl,
      status: "queued",
      updated_at: now,
    });
    await ctx.db.insert("job_events", {
      job_id: jobId,
      event: "received",
      payload: { entrypoint: args.entrypoint, has_shared_text: !!args.sharedText },
    });
    if (args.sourcePlatform === "tiktok") {
      await ctx.db.insert("job_events", {
        job_id: jobId,
        event: "normalized",
        payload: {
          stage: "share_url_resolved",
          original_url: args.submittedUrl,
          resolved_url: args.sourceUrl,
          resolved: args.urlResolved,
        },
      });
    }

    await ctx.scheduler.runAfter(0, internal.importPipeline.run, { jobId, sharedText: args.sharedText });
    return { rateLimited: false as const, jobId, status: "queued", deduplicated: false };
  },
});

/** An import's progress and, once extracted, its recipe draft. Null when it is not the user's. */
export const get = query({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const jobId = ctx.db.normalizeId("import_jobs", args.jobId);
    const job = jobId ? await ctx.db.get("import_jobs", jobId) : null;
    if (!job || job.user_id !== userId) return null;

    const draft = await ctx.db
      .query("recipe_drafts")
      .withIndex("by_job_id", (q) => q.eq("job_id", job._id))
      .unique();

    return {
      job: {
        id: job._id,
        source_platform: job.source_platform,
        source_url: job.source_url,
        status: job.status,
        error_code: job.error_code ?? null,
        error_message: job.error_message ?? null,
        created_at: new Date(job._creationTime).toISOString(),
        updated_at: new Date(job.updated_at).toISOString(),
        current_stage: job.current_stage ?? null,
      },
      draft: draft
        ? {
            payload: draft.payload_json as RecipeDraft,
            confidence: draft.confidence_json as Record<string, unknown>,
            language_detected: draft.language_detected ?? null,
            updated_at: new Date(draft.updated_at).toISOString(),
          }
        : null,
    };
  },
});

// ---- What the pipeline reads and writes. It runs in an action, so each step is a call here. ----

export const getJob = internalQuery({
  args: { jobId: v.id("import_jobs") },
  handler: async (ctx, { jobId }) => await ctx.db.get("import_jobs", jobId),
});

export const setJobStatus = internalMutation({
  args: {
    jobId: v.id("import_jobs"),
    status: importStatus,
    errorCode: v.optional(v.union(v.string(), v.null())),
    errorMessage: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("import_jobs", args.jobId, {
      status: args.status,
      error_code: args.errorCode ?? undefined,
      error_message: args.errorMessage ?? undefined,
      updated_at: Date.now(),
    });
    return null;
  },
});

/**
 * Fails a job that ran out of time. Only touches a job that is still processing, so a
 * pipeline that finished at the same moment keeps its own outcome.
 */
export const failJobIfProcessing = internalMutation({
  args: { jobId: v.id("import_jobs"), errorCode: v.string(), errorMessage: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get("import_jobs", args.jobId);
    if (!job || job.status !== "processing") return false;
    await ctx.db.patch("import_jobs", args.jobId, {
      status: "failed",
      error_code: args.errorCode,
      error_message: args.errorMessage,
      updated_at: Date.now(),
    });
    return true;
  },
});

export const logEvent = internalMutation({
  args: {
    jobId: v.id("import_jobs"),
    event: v.union(
      v.literal("received"),
      v.literal("normalized"),
      v.literal("ai_extracted"),
      v.literal("confirmed"),
      v.literal("failed")
    ),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("job_events", { job_id: args.jobId, event: args.event, payload: args.payload });
    const stage = (args.payload as { stage?: unknown } | null)?.stage;
    if (typeof stage === "string" && stage.trim()) {
      await ctx.db.patch("import_jobs", args.jobId, { current_stage: stage, updated_at: Date.now() });
    }
    return null;
  },
});

export const findCachedExtraction = internalQuery({
  args: { normalizedUrl: v.string() },
  handler: async (ctx, { normalizedUrl }) => {
    const cached = await ctx.db
      .query("recipe_extraction_cache")
      .withIndex("by_normalized_source_url", (q) => q.eq("normalized_source_url", normalizedUrl))
      .unique();
    if (!cached) return null;
    return {
      source_platform: cached.source_platform,
      source_post_id: cached.source_post_id ?? null,
      source_thumbnail_url: cached.source_thumbnail_url ?? null,
      payload: cached.payload as RecipeDraft,
      extraction_model: cached.extraction_model ?? null,
    };
  },
});

export const upsertExtractionCache = internalMutation({
  args: {
    normalizedUrl: v.string(),
    payload: v.any(),
    sourcePlatform,
    sourcePostId: v.optional(v.union(v.string(), v.null())),
    sourceThumbnailUrl: v.optional(v.union(v.string(), v.null())),
    extractionModel: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const fields = {
      normalized_source_url: args.normalizedUrl,
      source_platform: args.sourcePlatform,
      source_post_id: args.sourcePostId ?? undefined,
      source_thumbnail_url: args.sourceThumbnailUrl ?? undefined,
      payload: args.payload,
      extraction_model: args.extractionModel ?? undefined,
    };
    const existing = await ctx.db
      .query("recipe_extraction_cache")
      .withIndex("by_normalized_source_url", (q) => q.eq("normalized_source_url", args.normalizedUrl))
      .unique();
    if (existing) {
      await ctx.db.replace("recipe_extraction_cache", existing._id, fields);
    } else {
      await ctx.db.insert("recipe_extraction_cache", fields);
    }
    return null;
  },
});

export const upsertDraft = internalMutation({
  args: {
    jobId: v.id("import_jobs"),
    payload: v.any(),
    confidence: v.any(),
    language: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get("import_jobs", args.jobId);
    if (!job) throw new Error("Import job not found");

    const fields = {
      job_id: job._id,
      user_id: job.user_id,
      payload_json: args.payload,
      confidence_json: args.confidence,
      language_detected: args.language ?? undefined,
      updated_at: Date.now(),
    };
    const existing = await ctx.db
      .query("recipe_drafts")
      .withIndex("by_job_id", (q) => q.eq("job_id", job._id))
      .unique();
    if (existing) {
      await ctx.db.replace("recipe_drafts", existing._id, fields);
    } else {
      await ctx.db.insert("recipe_drafts", fields);
    }
    return null;
  },
});

/** Saves the extracted recipe to the job owner's library. Running it again for one job updates that recipe. */
export const confirmFromDraft = internalMutation({
  args: {
    jobId: v.id("import_jobs"),
    payload: v.any(),
    sourceThumbnailUrl: v.optional(v.union(v.string(), v.null())),
    sourceReelUrl: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get("import_jobs", args.jobId);
    if (!job) throw new Error("Import job not found");

    // Passing the draft through validation leaves only the fields a recipe stores.
    const draft = validateRecipeDraft(args.payload, { requireMeasurements: false });
    if (!draft) throw new Error("RECIPE_NOT_IN_SOURCE Recipe draft failed validation before saving.");

    const existing = await ctx.db
      .query("recipes")
      .withIndex("by_draft_job_id", (q) => q.eq("draft_job_id", job._id))
      .unique();

    const fields = {
      user_id: job.user_id,
      draft_job_id: job._id,
      folder_id: existing?.folder_id,
      source_platform: job.source_platform,
      source_url: job.source_url,
      source_reel_url: args.sourceReelUrl ?? job.source_url,
      source_thumbnail_url: args.sourceThumbnailUrl ?? undefined,
      title: draft.title,
      description: draft.description,
      cuisine: draft.cuisine,
      meal_type: draft.meal_type,
      servings: draft.servings,
      prep_minutes: draft.prep_minutes,
      cook_minutes: draft.cook_minutes,
      ingredients_json: draft.ingredients,
      steps_json: draft.steps,
      nutrition_json: draft.nutrition_estimate ?? {},
      localized_json: draft.localized ?? {},
    };

    if (existing) {
      await ctx.db.replace("recipes", existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("recipes", fields);
  },
});
