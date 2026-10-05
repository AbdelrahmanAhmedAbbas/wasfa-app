"use node";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { runImportPipeline, type PipelineStore } from "./lib/pipeline";

/** Runs one import from the shared link to a saved recipe. Scheduled when the job is created. */
export const run = internalAction({
  args: { jobId: v.id("import_jobs"), sharedText: v.optional(v.string()) },
  handler: async (ctx, { jobId, sharedText }) => {
    const job = await ctx.runQuery(internal.imports.getJob, { jobId });
    if (!job) return null;

    const store: PipelineStore = {
      updateJobStatus: async (params) => {
        await ctx.runMutation(internal.imports.setJobStatus, { jobId, ...params });
      },
      failJobIfStillProcessing: (params) => ctx.runMutation(internal.imports.failJobIfProcessing, { jobId, ...params }),
      logJobEvent: async (event, payload = {}) => {
        await ctx.runMutation(internal.imports.logEvent, { jobId, event, payload });
      },
      findCachedExtraction: (normalizedUrl) => ctx.runQuery(internal.imports.findCachedExtraction, { normalizedUrl }),
      upsertExtractionCache: async (params) => {
        await ctx.runMutation(internal.imports.upsertExtractionCache, params);
      },
      upsertRecipeDraft: async (params) => {
        await ctx.runMutation(internal.imports.upsertDraft, { jobId, ...params });
      },
      confirmRecipeFromDraft: (params) => ctx.runMutation(internal.imports.confirmFromDraft, { jobId, ...params }),
    };

    await runImportPipeline({
      store,
      job: { id: job._id, source_url: job.source_url, source_platform: job.source_platform },
      sharedText,
    });
    return null;
  },
});
