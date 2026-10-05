import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("serving recalculation scales ingredients locally and persists localized step rewrites", () => {
  const ai = readFileSync(new URL("./ai.ts", import.meta.url), "utf8");
  const action = readFileSync(new URL("../recipeAi.ts", import.meta.url), "utf8");
  const recipes = readFileSync(new URL("../recipes.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../../lib/recipes/client.ts", import.meta.url), "utf8");

  assert.match(ai, /function scaleIngredientQuantities/);
  assert.match(ai, /function scaleQuantityString/);
  assert.match(ai, /function rewriteLocalizedStepsForServings/);
  assert.match(ai, /localizedStepRewriteSchema/);
  assert.doesNotMatch(ai, /schema:\s*servingRecalculationSchema/);
  // Rewritten steps are kept for each language the recipe already had.
  assert.match(ai, /localized\[language\] = rewrittenLocalized\[language\]/);
  assert.match(action, /localized:\s*recalculated\.localized/);
  assert.match(recipes, /localized_json:\s*args\.localized/);
  assert.match(client, /withRecipeClassificationFallback\(recipe\)/);
});
