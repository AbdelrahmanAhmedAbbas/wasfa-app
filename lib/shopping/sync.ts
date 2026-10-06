import { useEffect } from "react";

import { getPlannedRecipeIds, getWeekDates, toDateKey } from "@/lib/planner/plan";
import { useMealPlan } from "@/lib/planner/storage";

import { removeRecipeFromShoppingList, useShoppingList } from "./client";

/**
 * Keeps the grocery list to what is on the calendar: the meals on this week's
 * days and in "Any day". Lines whose recipe is not planned there (last week's
 * meals, a removal that never reached the server) are taken off. Mounted once,
 * with the tabs.
 */
export function useGroceryListFollowsPlan(): void {
  const { items } = useShoppingList();
  const { plan, loaded, stored } = useMealPlan();

  useEffect(() => {
    // Nothing is removed until both sides are known. A device that has never
    // saved a plan cannot tell which lines are stale, so it leaves the list alone.
    if (!items || !loaded || !stored) return;

    const planned = new Set(getPlannedRecipeIds(plan, getWeekDates(new Date()).map(toDateKey)));
    const unplanned = new Set(
      items.map((item) => item.recipe_id).filter((recipeId) => !planned.has(recipeId))
    );
    unplanned.forEach((recipeId) => {
      void removeRecipeFromShoppingList(recipeId).catch(() => {
        // Tried again the next time the list or the plan changes.
      });
    });
  }, [items, plan, loaded, stored]);
}
