import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("pipeline generates localized recipe content in a parallel post-extraction batch", () => {
  const pipeline = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");
  const rewriter = readFileSync(new URL("./step-rewriter.ts", import.meta.url), "utf8");

  assert.match(rewriter, /STEP_REWRITER_MODEL/);
  assert.match(rewriter, /ingredients_used/);
  assert.match(rewriter, /linkStepIngredients/);

  assert.match(pipeline, /Promise\.all\(\[/);
  assert.match(pipeline, /generateRecipeContent\(\s*extraction\.draft,\s*"en"/s);
  assert.match(pipeline, /generateRecipeContent\(\s*extraction\.draft,\s*"ar"/s);
  assert.match(pipeline, /estimateNutrition\(extraction\.draft\)/);
  assert.match(pipeline, /fillMissingRecipeDetails\(extraction\.draft, combinedContext\)/);
  assert.match(pipeline, /stage:\s*"content_generation_en"/);
  assert.match(pipeline, /stage:\s*"content_generation_ar"/);
  assert.match(pipeline, /content_generation_models/);
});
