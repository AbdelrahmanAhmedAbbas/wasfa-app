"use node";

import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { requireUserId } from "./authz";
import { completeLocalizedContent, recalculateRecipeServings } from "./lib/ai";
import type { RecipeDraft } from "./lib/types";
import { validateRecipeDraft } from "./lib/validation";
import type { toDetail } from "./recipes";

type RecipeDetail = ReturnType<typeof toDetail>;

function recipeNotFound() {
  return new ConvexError({ code: "NOT_FOUND", message: "Recipe not found." });
}

function toDraft(recipe: Doc<"recipes">, options: { requireMeasurements: boolean }): RecipeDraft {
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
      source: { platform: recipe.source_platform, url: recipe.source_url },
    },
    options
  );
  if (!draft) throw new ConvexError({ code: "INVALID_RECIPE", message: "Recipe failed validation." });
  return draft;
}

/** Scales a recipe's amounts, and any step wording that depends on them, to a new number of servings. */
export const recalculateServings = action({
  args: { recipeId: v.string(), servings: v.number() },
  handler: async (ctx, args): Promise<RecipeDetail> => {
    const userId = await requireUserId(ctx);
    if (!Number.isFinite(args.servings) || args.servings < 1) {
      throw new ConvexError({ code: "INVALID_SERVINGS", message: "servings must be a positive number" });
    }

    const recipe = await ctx.runQuery(internal.recipes.getOwned, { userId, recipeId: args.recipeId });
    if (!recipe) throw recipeNotFound();

    const recalculated = await recalculateRecipeServings(
      toDraft(recipe, { requireMeasurements: true }),
      Math.trunc(args.servings)
    );
    return await ctx.runMutation(internal.recipes.applyServings, {
      recipeId: recipe._id,
      servings: recalculated.servings,
      ingredients: recalculated.ingredients,
      steps: recalculated.steps,
      localized: recalculated.localized ?? {},
    });
  },
});

/**
 * Writes the English or Arabic version a saved recipe is missing, so the recipe reads
 * in whichever language the app is switched to. Returns null when nothing could be added.
 */
export const localize = action({
  args: { recipeId: v.string() },
  handler: async (ctx, args): Promise<RecipeDetail | null> => {
    const userId = await requireUserId(ctx);
    const recipe = await ctx.runQuery(internal.recipes.getOwned, { userId, recipeId: args.recipeId });
    if (!recipe) throw recipeNotFound();

    const completion = await completeLocalizedContent(toDraft(recipe, { requireMeasurements: false }));
    if (completion.filled.length === 0) return null;

    return await ctx.runMutation(internal.recipes.applyLocalized, {
      recipeId: recipe._id,
      localized: completion.draft.localized ?? {},
    });
  },
});
