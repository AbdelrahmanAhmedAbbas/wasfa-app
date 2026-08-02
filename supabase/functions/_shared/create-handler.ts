import { corsHeaders, jsonResponse } from "./cors.ts";
import {
  createImportJob,
  createSupabaseClients,
  enforceRateLimit,
  findDeduplicatedJob,
  getImportJobById,
  getRequestUser,
  logJobEvent,
} from "./db.ts";
import { runImportPipeline } from "./pipeline.ts";
import type { ImportCreateInput, ImportEntrypoint, SourcePlatform } from "./types.ts";
import {
  detectSourcePlatform,
  extractFirstUrl,
  isSupportedSource,
  normalizeSourceUrl,
  resolveTikTokSourceUrl,
} from "./validation.ts";

const MAX_SHARED_TEXT_LENGTH = 10_000;

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function handleImportCreate(req: Request, defaultEntrypoint: ImportEntrypoint) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const input = parseJson<ImportCreateInput>(await req.text());
  if (!input) return jsonResponse({ error: "Invalid JSON body" }, 400);

  const submittedUrl =
    (input.source_url ? normalizeSourceUrl(input.source_url) : null) ??
    (input.shared_text ? extractFirstUrl(input.shared_text) : null);

  if (!submittedUrl) {
    return jsonResponse(
      { error: "A valid Instagram or TikTok URL is required in source_url or shared_text." },
      400
    );
  }

  if (!isSupportedSource(submittedUrl)) {
    return jsonResponse(
      { error: "Unsupported source URL. Only Instagram and TikTok are allowed." },
      422
    );
  }

  const submittedPlatform = detectSourcePlatform(submittedUrl);
  if (submittedPlatform === "unknown") {
    return jsonResponse(
      { error: "Could not detect source platform. Only Instagram and TikTok are supported." },
      422
    );
  }

  const sharedText =
    typeof input.shared_text === "string"
      ? input.shared_text.slice(0, MAX_SHARED_TEXT_LENGTH)
      : undefined;
  const clientId = typeof input.client_id === "string" ? input.client_id.slice(0, 128) : null;
  const requestUser = await getRequestUser(req);

  const { adminClient } = createSupabaseClients(req);

  try {
    await enforceRateLimit(adminClient, {
      userId: requestUser?.id ?? null,
      clientId,
      limitPerHour: 20,
    });
  } catch (error) {
    if (String(error).includes("RATE_LIMITED")) {
      return jsonResponse(
        { error: "Rate limit reached. Please wait before creating more import jobs." },
        429
      );
    }
    throw error;
  }

  const sourceResolution = submittedPlatform === "tiktok"
    ? await resolveTikTokSourceUrl(submittedUrl)
    : { url: submittedUrl, resolved: false };
  const normalizedUrl = sourceResolution.url;

  if (!isSupportedSource(normalizedUrl)) {
    return jsonResponse(
      { error: "Unsupported source URL. Only Instagram and TikTok are allowed." },
      422
    );
  }

  const sourcePlatform = detectSourcePlatform(normalizedUrl);
  if (sourcePlatform === "unknown") {
    return jsonResponse(
      { error: "Could not detect source platform. Only Instagram and TikTok are supported." },
      422
    );
  }

  const deduplicated = await findDeduplicatedJob(adminClient, {
    userId: requestUser?.id ?? null,
    clientId,
    sourceUrl: normalizedUrl,
    minutes: 30,
  });
  if (deduplicated) return jsonResponse(deduplicated, 200);

  const response = await createImportJob(adminClient, {
    userId: requestUser?.id ?? null,
    clientId,
    sourceUrl: normalizedUrl,
    sourcePlatform: sourcePlatform as SourcePlatform,
    entrypoint: input.entrypoint ?? defaultEntrypoint,
    input,
  });

  if (sourcePlatform === "tiktok") {
    await logJobEvent(adminClient, response.job_id, "normalized", {
      stage: "share_url_resolved",
      original_url: submittedUrl,
      resolved_url: normalizedUrl,
      resolved: sourceResolution.resolved,
    });
  }

  const job = await getImportJobById(adminClient, response.job_id);
  if (!job) return jsonResponse({ error: "Job creation failed" }, 500);

  EdgeRuntime.waitUntil(
    runImportPipeline({
      adminClient,
      job,
      sharedText,
    })
  );

  return jsonResponse(response, 202);
}
