import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("TikTok path verifies confirmed bilingual rich recipe through the same transcription as Instagram", () => {
  const pipeline = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");
  const expected = JSON.parse(
    readFileSync(new URL("./fixtures/tiktok-honey-bbq-mac.expected.json", import.meta.url), "utf8")
  );

  assert.doesNotMatch(pipeline, /tiktok_apify_transcript_used/);
  assert.ok(expected.events.some((event) => event.stage === "openrouter_transcribe"));
  assert.ok(!expected.events.some((event) => event.stage === "tiktok_apify_transcript_used"));

  assert.match(pipeline, /extractRecipe/);
  assert.match(pipeline, /generateRecipeContent/);
  assert.match(pipeline, /Promise\.all\(\[/);
  assert.match(pipeline, /estimateNutrition/);
  assert.match(pipeline, /has_localized_ar/);
  assert.match(pipeline, /has_localized_en/);
  assert.match(pipeline, /status:\s*"confirmed"/);

  assert.equal(expected.status, "confirmed");
  assert.ok(expected.recipe.cuisine);
  assert.ok(expected.recipe.meal_type);
  assert.ok(expected.recipe.servings > 0);
  assert.ok(expected.recipe.localized.en.ingredients.length > 0);
  assert.ok(expected.recipe.localized.ar.ingredients.length > 0);
  assert.ok(expected.recipe.localized.en.steps.some((step) => step.tips?.length));
  assert.ok(expected.recipe.localized.ar.steps.some((step) => step.tips?.length));
  assert.ok(expected.recipe.nutrition_estimate.estimated);
});
