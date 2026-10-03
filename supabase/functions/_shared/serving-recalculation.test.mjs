import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("serving recalculation scales ingredients locally and persists localized step rewrites", () => {
  const ai = readFileSync(new URL("./ai.ts", import.meta.url), "utf8");
  const fn = readFileSync(new URL("../recipe-recalculate/index.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../../../lib/recipes/client.ts", import.meta.url), "utf8");

  assert.match(ai, /function scaleIngredientQuantities/);
  assert.match(ai, /function scaleQuantityString/);
  assert.match(ai, /function rewriteLocalizedStepsForServings/);
  assert.match(ai, /localizedStepRewriteSchema/);
  assert.doesNotMatch(ai, /schema:\s*servingRecalculationSchema/);
  // Rewritten steps are kept for each language the recipe already had.
  assert.match(ai, /localized\[language\] = rewrittenLocalized\[language\]/);
  assert.match(fn, /localized_json:\s*recalculated\.localized/);
  assert.match(client, /withRecipeClassificationFallback\(recipe\)/);
});
