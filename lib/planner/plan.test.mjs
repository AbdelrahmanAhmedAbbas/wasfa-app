import test from "node:test";
import assert from "node:assert/strict";

import {
  ANY_DAY,
  addRecipeToPlan,
  countPlannedMeals,
  getWeekDates,
  isRecipePlanned,
  normalizeMealPlan,
  pruneMealPlan,
  removeRecipeFromPlan,
  removeRecipeFromWholePlan,
  toDateKey,
} from "./plan.ts";

test("builds the Sunday-first week that contains the given day", () => {
  const week = getWeekDates(new Date(2026, 9, 2)); // Friday, Oct 2 2026

  assert.deepEqual(week.map(toDateKey), [
    "2026-09-27",
    "2026-09-28",
    "2026-09-29",
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
  ]);
});

test("adds a recipe to a day once and removes empty days", () => {
  let plan = addRecipeToPlan({ any: [], days: {} }, "2026-10-02", "kabsa");
  plan = addRecipeToPlan(plan, "2026-10-02", "kabsa");
  plan = addRecipeToPlan(plan, ANY_DAY, "pasta");

  assert.deepEqual(plan, { any: ["pasta"], days: { "2026-10-02": ["kabsa"] } });
  assert.equal(countPlannedMeals(plan, ["2026-10-02"]), 2);
  assert.equal(isRecipePlanned(plan, "kabsa", ["2026-10-02"]), true);
  assert.equal(isRecipePlanned(plan, "kabsa", ["2026-10-03"]), false);
  assert.equal(isRecipePlanned(plan, "pasta", []), true);

  plan = removeRecipeFromPlan(plan, "2026-10-02", "kabsa");
  assert.deepEqual(plan, { any: ["pasta"], days: {} });
});

test("normalizes stored plans and prunes recipes that no longer exist", () => {
  assert.deepEqual(normalizeMealPlan(null), { any: [], days: {} });
  assert.deepEqual(normalizeMealPlan({ any: ["a", 3], days: { "2026-10-02": ["b"], bad: "x" } }), {
    any: ["a"],
    days: { "2026-10-02": ["b"] },
  });

  assert.deepEqual(
    pruneMealPlan({ any: ["a", "gone"], days: { "2026-10-02": ["gone"], "2026-10-03": ["b"] } }, ["a", "b"]),
    { any: ["a"], days: { "2026-10-03": ["b"] } }
  );
});

test("a deleted recipe leaves every day it was planned on", () => {
  const plan = { any: ["a", "b"], days: { "2026-10-04": ["a"], "2026-10-05": ["b", "a"] } };
  assert.deepEqual(removeRecipeFromWholePlan(plan, "a"), { any: ["b"], days: { "2026-10-05": ["b"] } });
  assert.equal(removeRecipeFromWholePlan(plan, "missing"), plan);
  assert.equal(countPlannedMeals(removeRecipeFromWholePlan(plan, "a"), ["2026-10-04", "2026-10-05"]), 2);
});

test("formats planner dates in English and Arabic", async () => {
  const { formatDayOfMonth, formatWeekRange, formatWeekdayLong, formatWeekdayShort } = await import(
    "./format.ts"
  );
  const week = getWeekDates(new Date(2026, 9, 2));

  assert.equal(formatWeekRange(week, "en"), "Sep 27 – Oct 3");
  assert.equal(formatWeekRange(week, "ar"), "٢٧ سبتمبر – ٣ أكتوبر");
  assert.equal(formatWeekdayLong(week[5], "en"), "Friday");
  assert.equal(formatWeekdayShort(week[5], "en"), "Fri");
  assert.equal(formatWeekdayLong(week[5], "ar"), "الجمعة");
  assert.equal(formatDayOfMonth(week[0], "ar"), "٢٧");
});
