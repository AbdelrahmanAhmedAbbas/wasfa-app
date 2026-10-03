import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOnboardingProfilePayload,
  shouldRetryLegacyOnboardingProfileUpsert,
} from "./supabase-compat.ts";

test("retries with legacy payload when Supabase schema cache is missing goal column", () => {
  const shouldRetry = shouldRetryLegacyOnboardingProfileUpsert({
    code: "PGRST204",
    details: null,
    hint: null,
    message:
      "Could not find the 'goal' column of 'onboarding_profiles' in the schema cache",
  });

  assert.equal(shouldRetry, true);
});

test("does not retry for unrelated Supabase errors", () => {
  const shouldRetry = shouldRetryLegacyOnboardingProfileUpsert({
    code: "23505",
    details: null,
    hint: null,
    message: "duplicate key value violates unique constraint",
  });

  assert.equal(shouldRetry, false);
});

test("builds a legacy payload without questionnaire-only columns", () => {
  const payload = buildOnboardingProfilePayload(
    "user-123",
    {
      goal: "meal_plan",
      painPoints: ["no_time"],
      diet: ["omnivore"],
      allergies: ["gluten"],
      referralSource: "friend",
      inviteCode: "ABC123",
      ageRange: "25-30",
      measurementSystem: "metric",
      nutritionDisplay: "show",
    },
    false
  );

  assert.deepEqual(payload, {
    user_id: "user-123",
    diet: ["omnivore"],
    allergies: ["gluten"],
    referral_source: "friend",
    invite_code: "ABC123",
    age_range: "25-30",
    measurement_system: "metric",
    nutrition_display: "show",
  });
});

test("never sends the device-only household size to Supabase", () => {
  const payload = buildOnboardingProfilePayload("user-123", {
    goal: "family",
    householdSize: "three_four",
    painPoints: [],
    diet: ["halal"],
    allergies: [],
    referralSource: null,
    inviteCode: null,
    ageRange: null,
    measurementSystem: null,
    nutritionDisplay: null,
  });

  assert.equal(payload.goal, "family");
  assert.equal(
    Object.keys(payload).some((key) => key.toLowerCase().includes("household")),
    false
  );
});
