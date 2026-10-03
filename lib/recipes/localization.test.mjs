import test from "node:test";
import assert from "node:assert/strict";

import { hasLocalizedContent } from "./localization.ts";

const recipe = {
  ingredients_json: [{}, {}],
  steps_json: [{}, {}],
  localized: {
    en: { title: "Chicken Kabsa", ingredients: [{}, {}], steps: [{}, {}] },
    ar: { title: "كبسة دجاج", ingredients: [{}, {}], steps: [{}, {}] },
  },
};

test("a recipe with both languages needs no translation", () => {
  assert.equal(hasLocalizedContent(recipe, "en"), true);
  assert.equal(hasLocalizedContent(recipe, "ar"), true);
});

test("a missing language is reported", () => {
  const arabicOnly = { ...recipe, localized: { ar: recipe.localized.ar } };

  assert.equal(hasLocalizedContent(arabicOnly, "en"), false);
  assert.equal(hasLocalizedContent(arabicOnly, "ar"), true);
});

test("content stored under the wrong language does not count", () => {
  const mislabelled = { ...recipe, localized: { ...recipe.localized, en: recipe.localized.ar } };

  assert.equal(hasLocalizedContent(mislabelled, "en"), false);
});

test("content that no longer lines up with the recipe does not count", () => {
  const stale = {
    ...recipe,
    localized: { ...recipe.localized, ar: { ...recipe.localized.ar, steps: [{}] } },
  };

  assert.equal(hasLocalizedContent(stale, "ar"), false);
});
