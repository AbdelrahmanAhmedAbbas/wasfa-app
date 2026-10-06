// Pure meal-plan logic. Kept free of React Native imports so it runs under
// `node --test`. Persistence lives in ./storage.ts.

/** "any" holds unscheduled meals; every other bucket is a local `YYYY-MM-DD` date. */
export const ANY_DAY = "any";

export type MealPlan = {
  any: string[];
  days: Record<string, string[]>;
};

export const EMPTY_MEAL_PLAN: MealPlan = { any: [], days: {} };

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export function normalizeMealPlan(input: unknown): MealPlan {
  if (!input || typeof input !== "object") return { any: [], days: {} };
  const source = input as { any?: unknown; days?: unknown };
  const days: Record<string, string[]> = {};

  if (source.days && typeof source.days === "object") {
    for (const [key, value] of Object.entries(source.days as Record<string, unknown>)) {
      const ids = stringList(value);
      if (ids.length > 0) days[key] = ids;
    }
  }

  return { any: stringList(source.any), days };
}

export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The seven dates (Sunday first) of the week containing `today`. */
export function getWeekDates(today: Date): Date[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  return Array.from(
    { length: 7 },
    (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
  );
}

export function getPlanDay(plan: MealPlan, dayKey: string): string[] {
  return dayKey === ANY_DAY ? plan.any : plan.days[dayKey] ?? [];
}

function withPlanDay(plan: MealPlan, dayKey: string, recipeIds: string[]): MealPlan {
  if (dayKey === ANY_DAY) return { ...plan, any: recipeIds };

  const days = { ...plan.days };
  if (recipeIds.length > 0) days[dayKey] = recipeIds;
  else delete days[dayKey];
  return { ...plan, days };
}

export function addRecipeToPlan(plan: MealPlan, dayKey: string, recipeId: string): MealPlan {
  const current = getPlanDay(plan, dayKey);
  if (current.includes(recipeId)) return plan;
  return withPlanDay(plan, dayKey, [...current, recipeId]);
}

export function removeRecipeFromPlan(plan: MealPlan, dayKey: string, recipeId: string): MealPlan {
  const current = getPlanDay(plan, dayKey);
  if (!current.includes(recipeId)) return plan;
  return withPlanDay(
    plan,
    dayKey,
    current.filter((id) => id !== recipeId)
  );
}

/** Moves a recipe between days; a recipe already on the target day is not duplicated. */
export function moveRecipeInPlan(
  plan: MealPlan,
  fromDayKey: string,
  toDayKey: string,
  recipeId: string
): MealPlan {
  if (fromDayKey === toDayKey || !getPlanDay(plan, fromDayKey).includes(recipeId)) return plan;
  return addRecipeToPlan(removeRecipeFromPlan(plan, fromDayKey, recipeId), toDayKey, recipeId);
}

/** True when the recipe sits in the unscheduled bucket or on any of `dayKeys`. */
export function isRecipePlanned(plan: MealPlan, recipeId: string, dayKeys: string[]): boolean {
  return [ANY_DAY, ...dayKeys].some((dayKey) => getPlanDay(plan, dayKey).includes(recipeId));
}

/**
 * The recipes on the calendar the planner shows: the unscheduled bucket plus
 * `dayKeys` (the current week). The grocery list holds exactly their ingredients.
 */
export function getPlannedRecipeIds(plan: MealPlan, dayKeys: string[]): string[] {
  return Array.from(new Set([ANY_DAY, ...dayKeys].flatMap((dayKey) => getPlanDay(plan, dayKey))));
}

/** True when the recipe appears in any bucket of the plan, past weeks included. */
export function isRecipeInPlan(plan: MealPlan, recipeId: string): boolean {
  return plan.any.includes(recipeId) || Object.values(plan.days).some((ids) => ids.includes(recipeId));
}

/** Takes a recipe out of every bucket, for when the recipe itself is deleted. */
export function removeRecipeFromWholePlan(plan: MealPlan, recipeId: string): MealPlan {
  if (!isRecipeInPlan(plan, recipeId)) return plan;
  const days: Record<string, string[]> = {};

  for (const [key, ids] of Object.entries(plan.days)) {
    const kept = ids.filter((id) => id !== recipeId);
    if (kept.length > 0) days[key] = kept;
  }

  return { any: plan.any.filter((id) => id !== recipeId), days };
}

export function countPlannedMeals(plan: MealPlan, dayKeys: string[]): number {
  return [ANY_DAY, ...dayKeys].reduce((total, dayKey) => total + getPlanDay(plan, dayKey).length, 0);
}

/** Drops recipe ids that no longer exist in the library (e.g. deleted recipes). */
export function pruneMealPlan(plan: MealPlan, knownRecipeIds: Iterable<string>): MealPlan {
  const known = new Set(knownRecipeIds);
  const days: Record<string, string[]> = {};

  for (const [key, ids] of Object.entries(plan.days)) {
    const kept = ids.filter((id) => known.has(id));
    if (kept.length > 0) days[key] = kept;
  }

  return { any: plan.any.filter((id) => known.has(id)), days };
}
