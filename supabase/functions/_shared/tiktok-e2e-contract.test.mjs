import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("TikTok transcript path verifies confirmed bilingual rich recipe without audio transcription", () => {
  const pipeline = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");
  const expected = JSON.parse(
    readFileSync(new URL("./fixtures/tiktok-honey-bbq-mac.expected.json", import.meta.url), "utf8")
  );

  const transcriptBranch = pipeline.match(/if \(metadata\.transcript\?\.trim\(\)\) \{([\s\S]*?)\n    \} else \{/);
  assert.ok(transcriptBranch, "metadata transcript branch should exist");
  assert.match(transcriptBranch[1], /tiktok_apify_transcript_used/);
  assert.doesNotMatch(transcriptBranch[1], /openrouter_transcribe/);

  assert.match(pipeline, /extractRecipe/);
  assert.match(pipeline, /rewriteProceduralSteps/);
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
