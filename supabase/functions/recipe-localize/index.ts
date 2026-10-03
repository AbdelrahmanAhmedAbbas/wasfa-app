import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createSupabaseClients, getRequestUser } from "../_shared/db.ts";
import { completeLocalizedContent } from "../_shared/ai.ts";
import type { RecipeDraft } from "../_shared/types.ts";
import { validateRecipeDraft } from "../_shared/validation.ts";

type LocalizeInput = {
  recipe_id?: string;
};

const RECIPE_SELECT =
  "id,title,description,cuisine,meal_type,localized_json,servings,prep_minutes,cook_minutes,created_at,ingredients_json,steps_json,nutrition_json,source_url,source_platform,source_reel_url,source_thumbnail_url,folder_id";

// Fills in the English or Arabic version a saved recipe is missing, so the
// recipe reads in whichever language the app is switched to.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let input: LocalizeInput;
  try {
    input = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!input.recipe_id || typeof input.recipe_id !== "string") {
    return jsonResponse({ error: "recipe_id is required" }, 400);
  }

  const requestUser = await getRequestUser(req);
  if (!requestUser?.id) return jsonResponse({ error: "Authentication required" }, 401);

  const { adminClient } = createSupabaseClients(req);
  const { data: recipe, error: loadError } = await adminClient
    .from("recipes")
    .select("*")
    .eq("id", input.recipe_id)
    .maybeSingle();

  if (loadError) throw loadError;
  if (!recipe) return jsonResponse({ error: "Recipe not found" }, 404);
  if (recipe.user_id !== requestUser.id) return jsonResponse({ error: "Forbidden" }, 403);

  const draft = validateRecipeDraft(
    {
      title: recipe.title,
      description: recipe.description,
      cuisine: recipe.cuisine,
      meal_type: recipe.meal_type,
      servings: recipe.servings,
      prep_minutes: recipe.prep_minutes,
      cook_minutes: recipe.cook_minutes,
      ingredients: recipe.ingredients_json,
      steps: recipe.steps_json,
      nutrition_estimate: recipe.nutrition_json,
      localized: recipe.localized_json,
      source: {
        platform: recipe.source_platform,
        url: recipe.source_url,
      },
    } satisfies RecipeDraft,
    { requireMeasurements: false }
  );

  if (!draft) return jsonResponse({ error: "Recipe failed validation" }, 422);

  const completion = await completeLocalizedContent(draft);
  if (completion.filled.length === 0) {
    return jsonResponse({ recipe: null, filled: [], failed: completion.failed });
  }

  const { data: updated, error: updateError } = await adminClient
    .from("recipes")
    .update({ localized_json: completion.draft.localized ?? {} })
    .eq("id", input.recipe_id)
    .select(RECIPE_SELECT)
    .single();

  if (updateError || !updated) throw updateError ?? new Error("Failed to update recipe");
  return jsonResponse({ recipe: updated, filled: completion.filled, failed: completion.failed });
});
