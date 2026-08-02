import assert from "node:assert/strict";
import { test } from "node:test";

import { runSanityCheck } from "./sanity-check.ts";

const draft = {
  title: "Tomato Pasta",
  cuisine: "Italian",
  meal_type: "Dinner",
  ingredients: [
    {
      name: "tomato",
      quantity: "2",
      unit: "cups",
      source: "caption",
      is_estimated: false,
    },
  ],
  steps: [
    {
      order: 1,
      title: "Cook sauce",
      text: "Cook the tomatoes until saucy.",
      ingredients_used: ["tomato"],
    },
  ],
  source: {
    platform: "instagram",
    url: "https://www.instagram.com/reel/example",
  },
};

test("sanity check returns structured issues instead of throwing on provider failure", async () => {
  const result = await runSanityCheck(draft);

  assert.equal(typeof result.passed, "boolean");
  assert.ok(Array.isArray(result.issues));
  assert.equal(result.passed, false);
  assert.deepEqual(result.issues, ["sanity_check_unavailable"]);
});
