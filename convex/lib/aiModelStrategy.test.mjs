import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("AI extraction uses tiered models and a single web measurement fill path", () => {
  const ai = readFileSync(new URL("./ai.ts", import.meta.url), "utf8");
  const pipeline = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");

  assert.match(ai, /EXTRACTION_MODELS\s*=\s*\[/);
  assert.match(ai, /anthropic\/claude-sonnet-4\.6/);
  assert.match(ai, /anthropic\/claude-haiku-4\.5/);
  assert.match(ai, /google\/gemini-3-flash-preview/);
  assert.match(ai, /for\s*\(const\s+candidateModel\s+of\s+EXTRACTION_MODELS\)/);
  assert.match(ai, /WEB_RESEARCH_MODEL/);
  assert.match(ai, /WEB_RESEARCH_MODEL\s*=\s*"google\/gemini-2\.5-pro"/);
  assert.match(ai, /plugins:\s*\[\{\s*id:\s*"web"\s*\}\]/);
  assert.doesNotMatch(ai, /WEB_RESEARCH_MODEL\s*=\s*"[^"]*:online"/);
  assert.match(ai, /fillMissingMeasurements/);
  assert.match(ai, /forceFillIngredientMeasurements/);
  assert.match(ai, /forcedIngredientMeasurementSchema/);
  assert.match(ai, /quantity:\s*z\.string\(\)\.min\(1\)/);
  assert.match(ai, /unit:\s*z\.string\(\)\.min\(1\)/);
  assert.doesNotMatch(ai, /inferIngredientQuantitiesWithAi/);
  assert.match(ai, /source:\s*"ai_estimate"/);
  assert.match(pipeline, /web_measurement_fill/);
});
