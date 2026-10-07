import { track } from "@/lib/analytics/posthog";
import { getCurrentUserId } from "@/lib/auth/session";
import { getRecipeById } from "@/lib/recipes/client";
import { loadRecipePreferences } from "@/lib/recipes/preferences";
import {
  addRecipeIngredientsToShoppingList,
  removeRecipeFromShoppingList,
} from "@/lib/shopping/client";

import {
  addRecipeToPlan,
  getWeekDates,
  ANY_DAY,
  isRecipePlanned,
  removeRecipeFromPlan,
  toDateKey,
  type MealPlan,
} from "./plan";

type UpdatePlan = (update: (current: MealPlan) => MealPlan) => Promise<MealPlan>;

/** Where a recipe was planned from: its own screen, the planner's picker, or a drag onto a day. */
export type PlanSource = "recipe" | "picker" | "drag";

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
  recipeId: string,
  source: PlanSource
): Promise<PlanChangeResult> {
  const plan = await updatePlan((current) => addRecipeToPlan(current, dayKey, recipeId));
  track("recipe_planned", { source, any_day: dayKey === ANY_DAY });

  try {
    const recipe = await getRecipeById(recipeId);
    if (recipe) {
      const preferences = await loadRecipePreferences(getCurrentUserId());
      await addRecipeIngredientsToShoppingList(recipe, preferences);
    }
    return { plan, grocerySynced: true };
  } catch {
    return { plan, grocerySynced: false };
  }
}

/**
 * Removes a recipe from a day. Its ingredients leave the grocery list only
 * once the recipe is no longer on the calendar: not on any day of this week
 * and not in "Any day".
 */
export async function unplanRecipe(
  updatePlan: UpdatePlan,
  dayKey: string,
  recipeId: string
): Promise<PlanChangeResult> {
  const plan = await updatePlan((current) => removeRecipeFromPlan(current, dayKey, recipeId));
  track("recipe_unplanned", { any_day: dayKey === ANY_DAY });
  const weekKeys = getWeekDates(new Date()).map(toDateKey);
  if (isRecipePlanned(plan, recipeId, weekKeys)) return { plan, grocerySynced: true };

  try {
    await removeRecipeFromShoppingList(recipeId);
    return { plan, grocerySynced: true };
  } catch {
    return { plan, grocerySynced: false };
  }
}
