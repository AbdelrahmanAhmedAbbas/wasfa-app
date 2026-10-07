import assert from "node:assert/strict";
import { test } from "node:test";

import { formatShoppingLine, localizeShoppingLine } from "./lines.ts";
import { mergeShoppingItems } from "./merge.ts";

// An English recipe whose translated names are worded differently from the saved ones.
const recipe = {
  ingredients_json: [
    { quantity: "520", unit: "g", name: "Greek Yogurt", notes: "For the dough" },
    { quantity: "1", unit: "tbsp", name: "Garlic Salt", notes: "For the dough (15g)" },
    { quantity: "10", unit: "whole", name: "Whole Eggs" },
    { quantity: "6", unit: "slice", name: "Center Cut Bacon", notes: "diced", suggested_alternative: "beef bacon" },
    { name: "Salt" },
  ],
  localized: {
    en: {
      ingredients: [
        { name: "fat-free Greek yogurt", notes: "For the dough" },
        { name: "garlic salt", notes: "For the dough" },
        { name: "whole eggs" },
        { name: "center-cut bacon", notes: "Diced", suggested_alternative: "beef bacon" },
        { name: "salt" },
      ],
    },
    ar: {
      ingredients: [
        { name: "زبادي يوناني", notes: "للعجينة" },
        { name: "ملح الثوم", notes: "للعجينة" },
        { name: "بيض كامل" },
        { name: "بيكون مقطّع", notes: "مقطّع مكعبات", suggested_alternative: "بيكون بقري" },
        { name: "ملح" },
      ],
    },
  },
};

const lines = recipe.ingredients_json.map(formatShoppingLine);

test("writes a saved line in Arabic from the recipe's translation", () => {
  assert.equal(localizeShoppingLine(lines[0], recipe, "ar"), "520 جم زبادي يوناني (للعجينة)");
  assert.equal(localizeShoppingLine(lines[1], recipe, "ar"), "1 ملعقة كبيرة ملح الثوم (للعجينة)");
  assert.equal(localizeShoppingLine(lines[2], recipe, "ar"), "10 حبة بيض كامل");
  assert.equal(localizeShoppingLine(lines[4], recipe, "ar"), "ملح");
});

test("a line saved as its halal swap is translated as the swap", () => {
  assert.equal(
    localizeShoppingLine("6 slice beef bacon (diced)", recipe, "ar"),
    "6 شريحة بيكون بقري (مقطّع مكعبات)"
  );
  assert.equal(localizeShoppingLine(lines[3], recipe, "ar"), "6 شريحة بيكون مقطّع (مقطّع مكعبات)");
});

test("a line whose amount has since changed in the recipe still matches by name", () => {
  assert.equal(localizeShoppingLine("260 g Greek Yogurt (For the dough)", recipe, "ar"), "520 جم زبادي يوناني (للعجينة)");
});

test("a line already in the app's language is left as written", () => {
  assert.equal(localizeShoppingLine(lines[0], recipe, "en"), lines[0]);
  assert.equal(localizeShoppingLine("٢ كوب أرز", recipe, "ar"), "٢ كوب أرز");
});

test("an Arabic recipe's lines are written in English", () => {
  const arabicRecipe = {
    ingredients_json: [{ quantity: "2", unit: "cup", name: "أرز بسمتي", notes: "مغسول" }],
    localized: { en: { ingredients: [{ name: "basmati rice", notes: "washed" }] } },
  };
  assert.equal(localizeShoppingLine("2 cup أرز بسمتي (مغسول)", arabicRecipe, "en"), "2 cup basmati rice (washed)");
});

test("a line with nothing to translate from stays as written", () => {
  assert.equal(localizeShoppingLine(lines[0], null, "ar"), lines[0]);
  assert.equal(localizeShoppingLine(lines[0], { ...recipe, localized: {} }, "ar"), lines[0]);
  assert.equal(localizeShoppingLine("2 cups rice", recipe, "ar"), "2 cups rice");

  // A translation that no longer lines up with the ingredients is not trusted.
  const misaligned = { ...recipe, localized: { ar: { ingredients: recipe.localized.ar.ingredients.slice(1) } } };
  assert.equal(localizeShoppingLine(lines[0], misaligned, "ar"), lines[0]);

  // A "translation" still written in the other language is not used.
  const untranslated = { ...recipe, localized: { ar: recipe.localized.en } };
  assert.equal(localizeShoppingLine(lines[0], untranslated, "ar"), lines[0]);
});

test("translated lines from two recipes merge into one row", () => {
  const other = {
    ingredients_json: [{ quantity: "1", unit: "kg", name: "Plain Greek Yoghurt" }],
    localized: { ar: { ingredients: [{ name: "زبادي يوناني" }] } },
  };
  const merged = mergeShoppingItems([
    { ingredient_text: localizeShoppingLine(lines[0], recipe, "ar") },
    { ingredient_text: localizeShoppingLine("1 kg Plain Greek Yoghurt", other, "ar") },
  ]);
  assert.deepEqual(merged.map((group) => group.text), ["1.52 كجم زبادي يوناني"]);
});
