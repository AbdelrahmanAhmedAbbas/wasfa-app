import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  canAccessJob,
  confirmRecipeFromDraft,
  createSupabaseClients,
  getImportJobById,
  getRecipeDraftByJobId,
  getRequestUser,
  logJobEvent,
  updateJobStatus,
} from "../_shared/db.ts";
import { hasIngredientsNeedingReview } from "../_shared/ingredient-details.ts";
import type { RecipeDraft } from "../_shared/types.ts";
import { validateRecipeDraft } from "../_shared/validation.ts";

type ConfirmInput = {
  job_id?: string;
  access_token?: string;
  edits?: Partial<RecipeDraft>;
};

function mergeDraft(base: RecipeDraft, edits: Partial<RecipeDraft> | undefined): RecipeDraft {
  if (!edits) return base;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let input: ConfirmInput;
  try {
    input = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!input.job_id || typeof input.job_id !== "string") {
    return jsonResponse({ error: "job_id is required" }, 400);
  }

  const requestUser = await getRequestUser(req);
  const { adminClient } = createSupabaseClients(req);
  const job = await getImportJobById(adminClient, input.job_id);
  if (!job) return jsonResponse({ error: "Job not found" }, 404);

  if (!canAccessJob({ job, userId: requestUser?.id ?? null, accessToken: input.access_token ?? null })) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const draftRecord = await getRecipeDraftByJobId(adminClient, job.id);
  if (!draftRecord?.payload_json) {
    return jsonResponse({ error: "No draft available for this job." }, 422);
  }

  const baseDraft = validateRecipeDraft(draftRecord.payload_json);
  if (!baseDraft) {
    return jsonResponse({ error: "Stored draft failed schema validation." }, 422);
  }

  const merged = mergeDraft(baseDraft, input.edits);
  const validated = validateRecipeDraft(merged);
  if (!validated) {
    return jsonResponse(
      { error: "Invalid recipe edits. Ensure at least 2 ingredients and 2 steps." },
      422
    );
  }
  if (hasIngredientsNeedingReview(validated.ingredients)) {
    return jsonResponse(
      { error: "Every ingredient needs a specific quantity, unit, or size before saving." },
      422
    );
  }

  const recipeId = await confirmRecipeFromDraft(adminClient, {
    job,
    payload: validated,
  });

  await updateJobStatus(adminClient, {
    jobId: job.id,
    status: "confirmed",
    errorCode: null,
    errorMessage: null,
  });
  await logJobEvent(adminClient, job.id, "confirmed", {
    recipe_id: recipeId,
  });

  return jsonResponse({
    recipe_id: recipeId,
    job_id: job.id,
    status: "confirmed",
  });
});
