import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("translated content never falls back to text in the other language", () => {
  const ai = read("./ai.ts");
  const normalize = ai.match(/function normalizeGeneratedLocalizedText\(([\s\S]*?)\n}\n/);
  assert.ok(normalize);

  // Draft fields are in the source language; they may only fill a gap when
  // they are written in the language being generated.
  assert.match(normalize[1], /inLanguage\(fallback\.description\)/);
  assert.match(normalize[1], /inLanguage\(fallback\.ingredients\[index\]\?\.notes\)/);
  assert.match(normalize[1], /allInLanguage\(fallback\.steps\[index\]\?\.equipment\)/);
  assert.match(normalize[1], /allInLanguage\(fallback\.steps\[index\]\?\.tips\)/);
  assert.doesNotMatch(normalize[1], /\?\? fallback\.(description|cuisine|meal_type)\b/);

  // Step ingredients link to the same language's ingredient names.
  assert.match(normalize[1], /linkStepIngredients\(normalizedSteps, normalizedIngredients\)/);
});

test("English content is checked like Arabic content", () => {
  const ai = read("./ai.ts");

  assert.match(ai, /function assertEnglishContentQuality/);
  assert.match(ai, /ENGLISH_CONTENT_QUALITY_FAILED/);
  assert.match(ai, /assertArabicContentQuality\(normalized\);\s*\} else \{\s*assertEnglishContentQuality\(normalized\);/);
});

test("changing servings does not store source text under a missing language", () => {
  const ai = read("./ai.ts");
  const recalculate = ai.match(/export async function recalculateRecipeServings\(([\s\S]*?)\n}\n/);
  assert.ok(recalculate);

  assert.match(recalculate[1], /if \(draft\.localized\?\.\[language\]\) localized\[language\] = rewrittenLocalized\[language\]/);
});

test("a saved recipe can have its missing language written", () => {
  const localize = read("../recipe-localize/index.ts");
  const client = read("../../../lib/recipes/client.ts");
  const screen = read("../../../app/recipe/[id].tsx");
  const deploy = read("../../../scripts/deploy-functions.sh");

  assert.match(localize, /completeLocalizedContent\(draft\)/);
  assert.match(localize, /recipe\.user_id !== requestUser\.id/);
  assert.match(localize, /localized_json: completion\.draft\.localized/);
  assert.match(client, /functions\.invoke\("recipe-localize"/);
  assert.match(screen, /hasLocalizedContent\(recipe, language\)/);
  assert.match(deploy, /recipe-localize/);
});

test("halal alternatives are generated per language and the swap choice survives validation", () => {
  const ai = read("./ai.ts");
  const validation = read("./validation.ts");
  const types = read("./types.ts");

  assert.match(ai, /suggested_alternative: z\.string\(\)\.nullable\(\)\.optional\(\),\n    }\)\n  \),\n  steps: z\.array\(\n    z\.object\(\{\n      order: z\.number\(\)\.int\(\)\.positive\(\),/);
  assert.match(ai, /not halal\$\{ingredient\.suggested_alternative/);
  assert.match(validation, /if \(item\.use_original === true\) result\.use_original = true/);
  assert.match(validation, /suggested_alternative: optionalString\(ingredient\.suggested_alternative\)/);
  assert.match(types, /use_original\?: boolean/);
});
