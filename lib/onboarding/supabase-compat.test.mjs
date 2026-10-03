import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOnboardingProfilePayload,
  getMissingOnboardingProfileColumn,
  mapOnboardingProfileRow,
} from "./supabase-compat.ts";

const emptyAnswers = {
  goal: null,
  householdSize: null,
  painPoints: [],
  diet: [],
  allergies: [],
  dislikes: [],
  referralSource: null,
  inviteCode: null,
  ageRange: null,
  measurementSystem: null,
  nutritionDisplay: null,
};

test("saves every chat answer, including household size and dislikes", () => {
  const payload = buildOnboardingProfilePayload("user-123", {
    goal: "family",
    householdSize: "three_four",
    painPoints: ["no_time"],
    diet: ["halal"],
    allergies: ["egg"],
    dislikes: ["onion", "beetroot"],
  });

  assert.deepEqual(payload, {
    user_id: "user-123",
    goal: "family",
    household_size: "three_four",
    pain_points: ["no_time"],
    diet: ["halal"],
    allergies: ["egg"],
    dislikes: ["onion", "beetroot"],
  });
});

test("a partial save only names the fields that changed", () => {
  const payload = buildOnboardingProfilePayload("user-123", { allergies: ["dairy"] });

  // Columns left out of an upsert keep their stored value.
  assert.deepEqual(payload, { user_id: "user-123", allergies: ["dairy"] });
});

test("a cleared answer is still written", () => {
  const payload = buildOnboardingProfilePayload("user-123", { goal: null, dislikes: [] });

  assert.deepEqual(payload, { user_id: "user-123", goal: null, dislikes: [] });
});

test("columns the database lacks can be left out of a retry", () => {
  const payload = buildOnboardingProfilePayload(
    "user-123",
    { diet: ["halal"], householdSize: "two", dislikes: ["okra"] },
    ["household_size", "dislikes"]
  );

  assert.deepEqual(payload, { user_id: "user-123", diet: ["halal"] });
});

test("names the newer column a failed save tripped over", () => {
  const missing = (column) =>
    getMissingOnboardingProfileColumn({
      code: "PGRST204",
      message: `Could not find the '${column}' column of 'onboarding_profiles' in the schema cache`,
    });

  assert.equal(missing("dislikes"), "dislikes");
  assert.equal(missing("household_size"), "household_size");
  assert.equal(missing("goal"), "goal");
  assert.equal(missing("pain_points"), "pain_points");
  // A column every database has is a real error, not a missing migration.
  assert.equal(missing("diet"), null);
});

test("does not retry for unrelated Supabase errors", () => {
  assert.equal(
    getMissingOnboardingProfileColumn({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    }),
    null
  );
});

test("maps a stored profile row to answers", () => {
  const profile = mapOnboardingProfileRow(
    {
      user_id: "user-123",
      goal: "meal_plan",
      household_size: "two",
      pain_points: ["no_time"],
      diet: ["halal"],
      allergies: ["gluten"],
      dislikes: ["mushroom"],
      referral_source: null,
      invite_code: null,
      age_range: null,
      measurement_system: "metric",
      nutrition_display: "hide",
    },
    emptyAnswers
  );

  assert.deepEqual(profile, {
    ...emptyAnswers,
    goal: "meal_plan",
    householdSize: "two",
    painPoints: ["no_time"],
    diet: ["halal"],
    allergies: ["gluten"],
    dislikes: ["mushroom"],
    measurementSystem: "metric",
    nutritionDisplay: "hide",
  });
});

test("answers the database has no column for come from the device copy", () => {
  const profile = mapOnboardingProfileRow(
    { user_id: "user-123", diet: ["halal"], allergies: [] },
    { ...emptyAnswers, householdSize: "five_plus", dislikes: ["okra"], diet: ["keto"] }
  );

  assert.equal(profile.householdSize, "five_plus");
  assert.deepEqual(profile.dislikes, ["okra"]);
  // Columns the database does have always win over the device copy.
  assert.deepEqual(profile.diet, ["halal"]);
});
