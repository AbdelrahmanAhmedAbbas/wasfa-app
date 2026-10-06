import test from "node:test";
import assert from "node:assert/strict";

import {
  ANY_DAY,
  addRecipeToPlan,
  countPlannedMeals,
  getPlannedRecipeIds,
  getWeekDates,
  isRecipePlanned,
  moveRecipeInPlan,
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

test("moves a recipe between days without duplicating it", () => {
  const plan = { any: ["a", "b"], days: { "2026-10-05": ["b"] } };

  assert.deepEqual(moveRecipeInPlan(plan, ANY_DAY, "2026-10-04", "a"), {
    any: ["b"],
    days: { "2026-10-05": ["b"], "2026-10-04": ["a"] },
  });
  assert.deepEqual(moveRecipeInPlan(plan, ANY_DAY, "2026-10-05", "b"), {
    any: ["a"],
    days: { "2026-10-05": ["b"] },
  });
  assert.deepEqual(moveRecipeInPlan(plan, "2026-10-05", ANY_DAY, "b"), { any: ["a", "b"], days: {} });
  assert.equal(moveRecipeInPlan(plan, ANY_DAY, ANY_DAY, "a"), plan);
  assert.equal(moveRecipeInPlan(plan, "2026-10-05", ANY_DAY, "a"), plan);
});

test("finds the day under the finger and scrolls near the list edges", async () => {
  const { findDropTarget, getAutoScrollSpeed } = await import("./drag.ts");
  const targets = [
    { dayKey: "any", x: 20, y: 100, width: 300, height: 60 },
    { dayKey: "2026-10-04", x: 20, y: 170, width: 300, height: 60 },
  ];

  assert.equal(findDropTarget(targets, 100, 130), "any");
  assert.equal(findDropTarget(targets, 100, 200), "2026-10-04");
  assert.equal(findDropTarget(targets, 100, 165), null);
  assert.equal(findDropTarget(targets, 5, 130), null);

  assert.equal(getAutoScrollSpeed(400, 0, 800), 0);
  assert.equal(getAutoScrollSpeed(0, 0, 800), -900);
  assert.equal(getAutoScrollSpeed(45, 0, 800), -450);
  assert.equal(getAutoScrollSpeed(755, 0, 800), 450);
  assert.equal(getAutoScrollSpeed(900, 0, 800), 900);
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

test("lists the recipes on the visible calendar once each, leaving other weeks out", () => {
  const plan = {
    any: ["soup"],
    days: {
      "2026-09-26": ["last-week"],
      "2026-09-28": ["kabsa", "soup"],
      "2026-10-02": ["kabsa", "salad"],
    },
  };
  const weekKeys = getWeekDates(new Date(2026, 9, 2)).map(toDateKey);

  assert.deepEqual(getPlannedRecipeIds(plan, weekKeys), ["soup", "kabsa", "salad"]);
  assert.deepEqual(getPlannedRecipeIds({ any: [], days: plan.days }, []), []);
});
