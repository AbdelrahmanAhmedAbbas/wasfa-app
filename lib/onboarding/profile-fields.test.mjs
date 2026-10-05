import test from "node:test";
import assert from "node:assert/strict";

import { buildProfileFields, mapProfileFields } from "./profile-fields.ts";

test("saves every chat answer, including household size and dislikes", () => {
  const fields = buildProfileFields({
    goal: "family",
    householdSize: "three_four",
    painPoints: ["no_time"],
    diet: ["halal"],
    allergies: ["egg"],
    dislikes: ["onion", "beetroot"],
  });

  assert.deepEqual(fields, {
    goal: "family",
    household_size: "three_four",
    pain_points: ["no_time"],
    diet: ["halal"],
    allergies: ["egg"],
    dislikes: ["onion", "beetroot"],
  });
});

test("a partial save only names the fields that changed", () => {
  // Fields left out of a save keep their stored value.
  assert.deepEqual(buildProfileFields({ allergies: ["dairy"] }), { allergies: ["dairy"] });
});

test("a cleared answer is still written", () => {
  assert.deepEqual(buildProfileFields({ goal: null, dislikes: [] }), { goal: null, dislikes: [] });
});

test("a stored profile maps back to the answers it was saved from", () => {
  const answers = {
    goal: "save_money",
    householdSize: "two",
    painPoints: ["grocery_waste"],
    diet: ["halal"],
    allergies: ["peanut"],
    dislikes: ["okra"],
    referralSource: "instagram",
    inviteCode: null,
    ageRange: "25-30",
    measurementSystem: "metric",
    nutritionDisplay: "show",
  };

  assert.deepEqual(mapProfileFields(buildProfileFields(answers)), answers);
});

test("anything never saved reads as unanswered", () => {
  assert.deepEqual(mapProfileFields({ diet: ["vegan"] }), {
    goal: null,
    householdSize: null,
    painPoints: [],
    diet: ["vegan"],
    allergies: [],
    dislikes: [],
    referralSource: null,
    inviteCode: null,
    ageRange: null,
    measurementSystem: null,
    nutritionDisplay: null,
  });
});
