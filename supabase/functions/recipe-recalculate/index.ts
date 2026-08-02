import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createSupabaseClients, getRequestUser } from "../_shared/db.ts";
import { recalculateRecipeServings } from "../_shared/ai.ts";
import type { RecipeDraft } from "../_shared/types.ts";
import { validateRecipeDraft } from "../_shared/validation.ts";

type RecalculateInput = {
  recipe_id?: string;
  servings?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let input: RecalculateInput;
  try {
    input = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!input.recipe_id || typeof input.recipe_id !== "string") {
    return jsonResponse({ error: "recipe_id is required" }, 400);
  }
  if (typeof input.servings !== "number" || !Number.isFinite(input.servings) || input.servings < 1) {
    return jsonResponse({ error: "servings must be a positive number" }, 400);
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

  const draft = validateRecipeDraft({
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
  } satisfies RecipeDraft);

  if (!draft) return jsonResponse({ error: "Recipe failed validation" }, 422);

  const recalculated = await recalculateRecipeServings(draft, Math.trunc(input.servings));
  const { data: updated, error: updateError } = await adminClient
    .from("recipes")
    .update({
      servings: recalculated.servings,
      ingredients_json: recalculated.ingredients,
      steps_json: recalculated.steps,
      localized_json: recalculated.localized,
    })
    .eq("id", input.recipe_id)
    .select(
      "id,title,description,cuisine,meal_type,localized_json,servings,prep_minutes,cook_minutes,created_at,ingredients_json,steps_json,nutrition_json,source_url,source_platform,source_reel_url,source_thumbnail_url,folder_id"
    )
    .single();

  if (updateError || !updated) throw updateError ?? new Error("Failed to update recipe");
  return jsonResponse({ recipe: updated });
});
