import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import type {
  ImportCreateInput,
  ImportCreateResponse,
  ImportEntrypoint,
  ImportJobRow,
  ImportStatus,
  RecipeDraft,
  SourcePlatform,
} from "./types.ts";

type RequestUser = {
  id: string;
  isAuthenticated: boolean;
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createSupabaseClients(req: Request) {
  const url = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const userClient = createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return { userClient, adminClient };
}

export async function getRequestUser(req: Request): Promise<RequestUser | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const { userClient } = createSupabaseClients(req);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;

  return {
    id: data.user.id,
    isAuthenticated: true,
  };
}

export async function enforceRateLimit(
  adminClient: ReturnType<typeof createClient>,
  params: { userId: string | null; clientId: string | null; limitPerHour: number }
) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  let query = adminClient
    .from("import_jobs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  if (params.userId) {
    query = query.eq("user_id", params.userId);
  } else if (params.clientId) {
    query = query.eq("client_id", params.clientId);
  } else {
    return;
  }

  const { count, error } = await query;
  if (error) throw error;
  if ((count ?? 0) >= params.limitPerHour) {
    throw new Error("RATE_LIMITED");
  }
}

export async function findDeduplicatedJob(
  adminClient: ReturnType<typeof createClient>,
  params: {
    userId: string | null;
    clientId: string | null;
    sourceUrl: string;
    minutes: number;
  }
): Promise<ImportCreateResponse | null> {
  const since = new Date(Date.now() - params.minutes * 60 * 1000).toISOString();
  let query = adminClient
    .from("import_jobs")
    .select("id, access_token, status")
    .eq("source_url", params.sourceUrl)
    .in("status", ["queued", "processing", "awaiting_user_review"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);

  if (params.userId) {
    query = query.eq("user_id", params.userId);
  } else if (params.clientId) {
    query = query.eq("client_id", params.clientId);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  return {
    job_id: data.id,
    access_token: data.access_token,
    status: data.status as ImportStatus,
    deduplicated: true,
  };
}

export async function createImportJob(
  adminClient: ReturnType<typeof createClient>,
  params: {
    userId: string | null;
    clientId: string | null;
    sourceUrl: string;
    sourcePlatform: SourcePlatform;
    entrypoint: ImportEntrypoint;
    input: ImportCreateInput;
  }
): Promise<ImportCreateResponse> {
  const { data, error } = await adminClient
    .from("import_jobs")
    .insert({
      user_id: params.userId,
      client_id: params.clientId,
      source_url: params.sourceUrl,
      source_platform: params.sourcePlatform,
      entrypoint: params.entrypoint,
      status: "queued",
    })
    .select("id, access_token, status")
    .single();

  if (error || !data) throw error ?? new Error("Failed to create import job");

  await logJobEvent(adminClient, data.id, "received", {
    entrypoint: params.entrypoint,
    has_shared_text: !!params.input.shared_text,
  });

  return {
    job_id: data.id,
    access_token: data.access_token,
    status: data.status as ImportStatus,
    deduplicated: false,
  };
}

export async function getImportJobById(
  adminClient: ReturnType<typeof createClient>,
  id: string
): Promise<ImportJobRow | null> {
  const { data, error } = await adminClient
    .from("import_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as ImportJobRow | null;
}

export function canAccessJob(params: {
  job: ImportJobRow;
  userId: string | null;
  accessToken: string | null;
}): boolean {
  if (params.userId && params.job.user_id && params.userId === params.job.user_id) return true;
  if (params.accessToken && params.accessToken === params.job.access_token) return true;
  return false;
}

export async function updateJobStatus(
  adminClient: ReturnType<typeof createClient>,
  params: {
    jobId: string;
    status: ImportStatus;
    errorCode?: string | null;
    errorMessage?: string | null;
  }
) {
  const { error } = await adminClient
    .from("import_jobs")
    .update({
      status: params.status,
      error_code: params.errorCode ?? null,
      error_message: params.errorMessage ?? null,
    })
    .eq("id", params.jobId);

  if (error) throw error;
}

export async function upsertRecipeDraft(
  adminClient: ReturnType<typeof createClient>,
  params: {
    jobId: string;
    userId: string | null;
    payload: RecipeDraft;
    confidence: Record<string, unknown>;
    language: string | null;
  }
) {
  const { error } = await adminClient
    .from("recipe_drafts")
    .upsert(
      {
        job_id: params.jobId,
        user_id: params.userId,
        payload_json: params.payload,
        confidence_json: params.confidence,
        language_detected: params.language,
      },
      { onConflict: "job_id" }
    );

  if (error) throw error;
}

export async function getRecipeDraftByJobId(
  adminClient: ReturnType<typeof createClient>,
  jobId: string
) {
  const { data, error } = await adminClient
    .from("recipe_drafts")
    .select("id, payload_json, confidence_json, language_detected, created_at, updated_at")
    .eq("job_id", jobId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function confirmRecipeFromDraft(
  adminClient: ReturnType<typeof createClient>,
  params: {
    job: ImportJobRow;
    payload: RecipeDraft;
  }
) {
  const { data, error } = await adminClient
    .from("recipes")
    .upsert(
      {
        user_id: params.job.user_id,
        draft_job_id: params.job.id,
        source_platform: params.job.source_platform,
        source_url: params.job.source_url,
        title: params.payload.title,
        description: params.payload.description ?? null,
        servings: params.payload.servings ?? null,
        prep_minutes: params.payload.prep_minutes ?? null,
        cook_minutes: params.payload.cook_minutes ?? null,
        ingredients_json: params.payload.ingredients,
        steps_json: params.payload.steps,
        nutrition_json: params.payload.nutrition_estimate ?? {},
      },
      { onConflict: "draft_job_id" }
    )
    .select("id")
    .single();

  if (error || !data) throw error ?? new Error("Failed to confirm recipe");
  return data.id as string;
}

export async function logJobEvent(
  adminClient: ReturnType<typeof createClient>,
  jobId: string,
  event: "received" | "normalized" | "ai_extracted" | "confirmed" | "failed",
  payload: Record<string, unknown> = {}
) {
  const { error } = await adminClient.from("job_events").insert({
    job_id: jobId,
    event,
    payload,
  });
  if (error) throw error;
}

export async function insertRawArtifact(
  adminClient: ReturnType<typeof createClient>,
  params: {
    jobId: string;
    artifactType: "shared_text" | "caption" | "ocr_text" | "transcript";
    encryptedContent: string;
  }
) {
  const { error } = await adminClient.from("import_raw_artifacts").insert({
    job_id: params.jobId,
    artifact_type: params.artifactType,
    content_encrypted: params.encryptedContent,
  });
  if (error) throw error;
}
