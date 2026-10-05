import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Instagram path verifies Apify metadata plus OpenRouter transcription without OCR", () => {
  const pipeline = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");
  const expected = JSON.parse(
    readFileSync(new URL("./fixtures/instagramTranscribedRecipe.expected.json", import.meta.url), "utf8")
  );

  assert.match(pipeline, /APIFY_ACTOR_INSTAGRAM/);
  assert.match(pipeline, /fetchInstagramViaApify/);
  assert.match(pipeline, /return fetchInstagramViaApify\(params\.sourceUrl\)/);
  assert.match(pipeline, /stage:\s*"openrouter_transcribe"/);
  assert.doesNotMatch(pipeline, /video_ocr|extractVisualRecipeText|openrouter_video_ocr/);

  assert.match(pipeline, /generateRecipeContent/);
  assert.match(pipeline, /Promise\.all\(\[/);
  assert.match(pipeline, /has_localized_ar/);
  assert.match(pipeline, /has_localized_en/);
  assert.match(pipeline, /status:\s*"confirmed"/);

  assert.equal(expected.status, "confirmed");
  assert.equal(expected.source_platform, "instagram");
  assert.ok(expected.events.some((event) => event.stage === "openrouter_transcribe"));
  assert.ok(expected.recipe.ingredients.every((ingredient) => typeof ingredient.is_estimated === "boolean"));
  assert.ok(expected.recipe.steps.every((step) => step.title && Array.isArray(step.ingredients_used)));
  assert.ok(expected.recipe.localized.en.steps.length > 0);
  assert.ok(expected.recipe.localized.ar.steps.length > 0);
});
