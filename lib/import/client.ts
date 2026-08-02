import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";

import { supabase } from "@/lib/supabase/client";

import type {
  ImportCreateInput,
  ImportCreateResponse,
  ImportStatusResponse,
  RecipeDraft,
} from "./types";

const CLIENT_ID_STORAGE_KEY = "@meal_planner_import_client_id";

function getSupabaseEdgeBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("EXPO_PUBLIC_SUPABASE_URL is not configured.");
  }
  return `${url.replace(/\/+$/, "")}/functions/v1`;
}

async function getClientId(): Promise<string> {
  const existing = await AsyncStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated = randomUUID();
  await AsyncStorage.setItem(CLIENT_ID_STORAGE_KEY, generated);
  return generated;
}

async function getHeaders(options: { includeAuth?: boolean } = {}) {
  const includeAuth = options.includeAuth ?? true;
  const { data } = await supabase.auth.getSession();
  const authToken = data.session?.access_token;
  const apikey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return {
    "Content-Type": "application/json",
    ...(apikey ? { apikey } : {}),
    ...(includeAuth && authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

function isInvalidJwtResponse(status: number, payload: string): boolean {
  if (status !== 401) return false;
  const lowered = payload.toLowerCase();
  return lowered.includes("invalid jwt");
}

async function callEdge<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    query?: Record<string, string | undefined>;
    body?: Record<string, unknown>;
  } = {}
): Promise<T> {
  const base = getSupabaseEdgeBaseUrl();
  const url = new URL(`${base}/${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value) url.searchParams.set(key, value);
    }
  }
  const executeRequest = async (includeAuth: boolean): Promise<Response> =>
    fetch(url.toString(), {
      method: options.method ?? "GET",
      headers: await getHeaders({ includeAuth }),
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

  let response: Response;
  try {
    response = await executeRequest(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Edge function request failed (${path}). ${message}. ` +
        "Check Supabase function deployment and project auth/link."
    );
  }
  let payload = response.ok ? "" : await response.text();

  // Recover from stale/wrong Supabase access tokens by retrying without auth.
  if (!response.ok && isInvalidJwtResponse(response.status, payload)) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore sign-out failure and still retry without auth header.
    }
    try {
      response = await executeRequest(false);
      payload = response.ok ? "" : await response.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Edge function request failed (${path}) after JWT recovery. ${message}.`
      );
    }
  }

  if (!response.ok) {
    let parsedError: string | null = null;
    try {
      const parsed = JSON.parse(payload) as { error?: string; message?: string };
      parsedError = parsed?.error ?? parsed?.message ?? null;
    } catch {
      // Ignore parse errors and fall back to raw payload.
    }
    throw new Error(parsedError || payload || `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

function mergeDraft(base: RecipeDraft, edits: Partial<RecipeDraft>): RecipeDraft {
  return {
    ...base,
    ...edits,
    ingredients: Array.isArray(edits.ingredients) ? edits.ingredients : base.ingredients,
    steps: Array.isArray(edits.steps) ? edits.steps : base.steps,
    source: {
      ...base.source,
      ...(edits.source ?? {}),
    },
  };
}

function isNetworkFailure(error: unknown): boolean {
  const raw = String(error).toLowerCase();
  return raw.includes("network request failed") || raw.includes("edge function request failed");
}

async function confirmRecipeFallback(
  jobId: string,
  edits: Partial<RecipeDraft>
): Promise<{ recipe_id: string; status: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) {
    throw new Error("Cannot use fallback save while signed out. Please sign in or redeploy import-confirm.");
  }

  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .select("id,user_id,source_platform,source_url")
    .eq("id", jobId)
    .single();
  if (jobError || !job) {
    throw new Error(jobError?.message || "Failed to load import job for fallback save.");
  }
  if (job.user_id !== userId) {
    throw new Error("Fallback save is only available for your own authenticated jobs.");
  }

  const { data: draftRecord, error: draftError } = await supabase
    .from("recipe_drafts")
    .select("payload_json,confidence_json")
    .eq("job_id", jobId)
    .single();
  if (draftError || !draftRecord?.payload_json) {
    throw new Error(draftError?.message || "No draft available to save.");
  }

  const merged = mergeDraft(draftRecord.payload_json as RecipeDraft, edits);
  const sourceMetadata = (draftRecord.confidence_json as Record<string, unknown> | null)?.source_metadata as
    | Record<string, unknown>
    | undefined;
  const sourceThumbnailUrl =
    sourceMetadata && typeof sourceMetadata.thumbnail_url === "string"
      ? sourceMetadata.thumbnail_url
      : null;
  if (!Array.isArray(merged.ingredients) || merged.ingredients.length < 2) {
    throw new Error("Recipe must include at least 2 ingredients.");
  }
  if (!Array.isArray(merged.steps) || merged.steps.length < 2) {
    throw new Error("Recipe must include at least 2 steps.");
  }

  const { data: recipeRow, error: recipeError } = await supabase
    .from("recipes")
    .upsert(
      {
        user_id: userId,
        draft_job_id: jobId,
        source_platform: job.source_platform,
        source_url: job.source_url,
        source_reel_url: job.source_url,
        source_thumbnail_url: sourceThumbnailUrl,
        title: merged.title,
        description: merged.description ?? null,
        cuisine: merged.cuisine,
        meal_type: merged.meal_type,
        servings: merged.servings ?? null,
        prep_minutes: merged.prep_minutes ?? null,
        cook_minutes: merged.cook_minutes ?? null,
        ingredients_json: merged.ingredients,
        steps_json: merged.steps,
        nutrition_json: merged.nutrition_estimate ?? {},
      },
      { onConflict: "draft_job_id" }
    )
    .select("id")
    .single();
  if (recipeError || !recipeRow?.id) {
    throw new Error(recipeError?.message || "Failed to save recipe in fallback mode.");
  }

  const { error: updateError } = await supabase
    .from("import_jobs")
    .update({
      status: "confirmed",
      error_code: null,
      error_message: null,
    })
    .eq("id", jobId);
  if (updateError) {
    throw new Error(updateError.message || "Saved recipe, but failed to mark import as confirmed.");
  }

  return { recipe_id: recipeRow.id as string, status: "confirmed" };
}

export async function createImportJob(input: ImportCreateInput): Promise<ImportCreateResponse> {
  const clientId = await getClientId();
  return callEdge<ImportCreateResponse>("import-create", {
    method: "POST",
    body: {
      ...input,
      client_id: clientId,
      entrypoint: input.entrypoint ?? "paste_url",
    },
  });
}

export async function createShareImport(input: {
  source_url?: string;
  shared_text?: string;
}): Promise<ImportCreateResponse> {
  const clientId = await getClientId();
  return callEdge<ImportCreateResponse>("import-share", {
    method: "POST",
    body: {
      ...input,
      client_id: clientId,
      entrypoint: "share_intent",
    },
  });
}

export async function getImportJob(
  jobId: string,
  accessToken?: string
): Promise<ImportStatusResponse> {
  return callEdge<ImportStatusResponse>("import-status", {
    method: "GET",
    query: {
      id: jobId,
      token: accessToken,
    },
  });
}

export async function confirmRecipe(
  jobId: string,
  edits: Partial<RecipeDraft>,
  accessToken?: string
): Promise<{ recipe_id: string; status: string }> {
  try {
    return await callEdge("import-confirm", {
      method: "POST",
      body: {
        job_id: jobId,
        access_token: accessToken,
        edits,
      },
    });
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    return confirmRecipeFallback(jobId, edits);
  }
}
