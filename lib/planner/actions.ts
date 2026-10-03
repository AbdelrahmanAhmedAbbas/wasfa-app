import { getRecipeById } from "@/lib/recipes/client";
import {
  addRecipeIngredientsToShoppingList,
  removeRecipeFromShoppingList,
} from "@/lib/shopping/client";

import { addRecipeToPlan, isRecipeInPlan, removeRecipeFromPlan, type MealPlan } from "./plan";

type UpdatePlan = (update: (current: MealPlan) => MealPlan) => Promise<MealPlan>;

export type PlanChangeResult = {
  plan: MealPlan;
  /** False when the plan was saved but the grocery list could not be updated. */
  grocerySynced: boolean;
};

/**
 * Adds a recipe to a day of the meal plan and puts its ingredients on the
 * grocery list. The plan change always sticks; a grocery failure (offline,
 * signed out) is reported through `grocerySynced` instead of throwing.
 */
export async function planRecipe(
  updatePlan: UpdatePlan,
  dayKey: string,
  recipeId: string
): Promise<PlanChangeResult> {
  const plan = await updatePlan((current) => addRecipeToPlan(current, dayKey, recipeId));

  try {
    const recipe = await getRecipeById(recipeId);
    if (recipe) await addRecipeIngredientsToShoppingList(recipe);
    return { plan, grocerySynced: true };
  } catch {
    return { plan, grocerySynced: false };
  }
}

/**
 * Removes a recipe from a day. Its ingredients leave the grocery list only
 * once the recipe is no longer planned on any day.
 */
export async function unplanRecipe(
  updatePlan: UpdatePlan,
  dayKey: string,
  recipeId: string
): Promise<PlanChangeResult> {
  const plan = await updatePlan((current) => removeRecipeFromPlan(current, dayKey, recipeId));
  if (isRecipeInPlan(plan, recipeId)) return { plan, grocerySynced: true };

  try {
    await removeRecipeFromShoppingList(recipeId);
    return { plan, grocerySynced: true };
  } catch {
    return { plan, grocerySynced: false };
  }
}
