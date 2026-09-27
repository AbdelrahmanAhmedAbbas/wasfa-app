import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  canAccessJob,
  createSupabaseClients,
  getImportJobById,
  getLatestJobStage,
  getRecipeDraftByJobId,
  getRequestUser,
} from "../_shared/db.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const jobId = url.searchParams.get("id");
  const accessToken = url.searchParams.get("token");

  if (!jobId) return jsonResponse({ error: "Missing id parameter" }, 400);

  const requestUser = await getRequestUser(req);
  const { adminClient } = createSupabaseClients(req);
  const job = await getImportJobById(adminClient, jobId);

  if (!job) return jsonResponse({ error: "Job not found" }, 404);
  if (!canAccessJob({ job, userId: requestUser?.id ?? null, accessToken })) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const draft = await getRecipeDraftByJobId(adminClient, job.id);
  const currentStage = await getLatestJobStage(adminClient, job.id);
  return jsonResponse({
    job: {
      id: job.id,
      source_platform: job.source_platform,
      source_url: job.source_url,
      status: job.status,
      error_code: job.error_code,
      error_message: job.error_message,
      created_at: job.created_at,
      updated_at: job.updated_at,
      current_stage: currentStage,
    },
    draft: draft
      ? {
          payload: draft.payload_json,
          confidence: draft.confidence_json,
          language_detected: draft.language_detected,
          updated_at: draft.updated_at,
        }
      : null,
  });
});
