import test from "node:test";
import assert from "node:assert/strict";

import {
  ALLERGY_OPTIONS,
  DIET_OPTIONS,
  getHouseholdOption,
  getResumeRoute,
  getStepIndex,
  GOAL_OPTIONS,
  hasQuestionnaireAnswers,
  HOUSEHOLD_OPTIONS,
  PAIN_OPTIONS,
  scaleDemoQuantity,
  STEP_ROUTES,
} from "./flow.ts";

test("questionnaire steps follow the redesigned flow order", () => {
  assert.deepEqual([...STEP_ROUTES], ["language", "intro", "chat", "kitchen", "demo", "ready"]);
  assert.equal(getStepIndex("kitchen"), 3);
});

test("resume ignores the first step and out-of-range saved steps", () => {
  assert.equal(getResumeRoute(0), null);
  assert.equal(getResumeRoute(2), "chat");
  assert.equal(getResumeRoute(5), "ready");
  assert.equal(getResumeRoute(6), null);
  assert.equal(getResumeRoute(-1), null);
  assert.equal(getResumeRoute(Number.NaN), null);
});

test("chat options keep the stored answer ids in design order", () => {
  assert.deepEqual(
    GOAL_OPTIONS.map((option) => option.id),
    ["save_social", "meal_plan", "eat_better", "save_money", "family"]
  );
  assert.deepEqual(
    HOUSEHOLD_OPTIONS.map((option) => option.id),
    ["one", "two", "three_four", "five_plus"]
  );
  assert.deepEqual(
    PAIN_OPTIONS.map((option) => option.id),
    ["lost_recipes", "daily_decisions", "grocery_waste", "picky_family", "no_time"]
  );
  assert.deepEqual(
    DIET_OPTIONS.map((option) => option.id),
    ["halal", "omnivore", "vegetarian", "vegan", "keto", "pescatarian"]
  );
  assert.deepEqual(
    ALLERGY_OPTIONS.map((option) => option.id),
    ["shellfish", "seafood", "dairy", "peanut", "tree_nut", "egg", "gluten", "wheat"]
  );
});

test("demo amounts scale with the household and round to quarters", () => {
  assert.equal(getHouseholdOption("one").servings, 1);
  assert.equal(getHouseholdOption("five_plus").servings, 5);
  assert.equal(getHouseholdOption(null).id, "three_four");

  assert.equal(scaleDemoQuantity(2, 4, 4), 2);
  assert.equal(scaleDemoQuantity(2, 1, 4), 0.5);
  assert.equal(scaleDemoQuantity(1, 5, 4), 1.25);
  assert.equal(scaleDemoQuantity(1, 2, 3), 0.75);
});

test("detects a skipped chat", () => {
  const empty = { goal: null, householdSize: null, painPoints: [], diet: [], allergies: [] };

  assert.equal(hasQuestionnaireAnswers(empty), false);
  assert.equal(hasQuestionnaireAnswers({ ...empty, householdSize: "two" }), true);
  assert.equal(hasQuestionnaireAnswers({ ...empty, allergies: ["egg"] }), true);
});
