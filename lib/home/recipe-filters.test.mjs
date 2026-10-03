import test from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_RECIPE_FILTERS,
  countActiveFilters,
  getRecipeFilterOptions,
  matchesMainIngredient,
  matchesRecipeFilters,
  matchesRecipeSearch,
  pruneRecipeFilters,
} from "./recipe-filters.ts";

const kabsa = {
  title: "كبسة دجاج",
  cuisine: "Saudi",
  meal_type: "Dinner",
  prep_minutes: 15,
  cook_minutes: 60,
  ingredient_names: ["أرز بسمتي", "دجاج", "طماطم"],
  localized: {
    en: {
      title: "Chicken Kabsa",
      cuisine: "Saudi",
      meal_type: "Dinner",
      ingredients: [{ name: "basmati rice" }, { name: "chicken" }, { name: "tomato" }],
    },
    ar: { title: "كبسة دجاج", cuisine: "سعودي", meal_type: "عشاء", ingredients: [{ name: "أرز بسمتي" }] },
  },
};
const pasta = {
  title: "Garlicky Kale Pasta",
  cuisine: "Italian",
  meal_type: "Lunch",
  prep_minutes: 5,
  cook_minutes: 15,
  ingredient_names: ["spaghetti", "kale", "garlic"],
};
const shakshuka = {
  title: "Shakshuka",
  cuisine: "General",
  meal_type: "Breakfast",
  prep_minutes: null,
  cook_minutes: null,
  ingredient_names: ["eggs", "tomato", "bell pepper"],
};
const moussaka = {
  title: "Eggplant bake",
  cuisine: "Lebanese",
  meal_type: "Meal",
  prep_minutes: 10,
  cook_minutes: 40,
  ingredient_names: ["eggplant", "minced beef"],
};
const library = [kabsa, pasta, shakshuka, moussaka];

test("search finds a recipe by its name in either language", () => {
  assert.equal(matchesRecipeSearch(kabsa, "كبسة"), true);
  assert.equal(matchesRecipeSearch(kabsa, "kabsa"), true);
  assert.equal(matchesRecipeSearch(kabsa, "pasta"), false);
  assert.equal(matchesRecipeSearch(kabsa, "  "), true);
});

test("search finds a recipe by any of its ingredients", () => {
  assert.equal(matchesRecipeSearch(kabsa, "tomato"), true);
  assert.equal(matchesRecipeSearch(kabsa, "طماطم"), true);
  assert.equal(matchesRecipeSearch(pasta, "Kale"), true);
  assert.equal(matchesRecipeSearch(pasta, "tomato"), false);
});

test("search finds a recipe by its cuisine or meal type", () => {
  assert.equal(matchesRecipeSearch(kabsa, "saudi"), true);
  assert.equal(matchesRecipeSearch(kabsa, "عشاء"), true);
  assert.equal(matchesRecipeSearch(pasta, "italian"), true);
});

test("every word of the search has to match", () => {
  assert.equal(matchesRecipeSearch(kabsa, "chicken rice"), true);
  assert.equal(matchesRecipeSearch(kabsa, "chicken kale"), false);
});

test("search ignores Arabic spelling variants", () => {
  assert.equal(matchesRecipeSearch(kabsa, "ارز"), true);
  assert.equal(matchesRecipeSearch(kabsa, "كبسه"), true);
});

test("filters by total time and skips recipes with no known time", () => {
  const quick = { ...EMPTY_RECIPE_FILTERS, maxMinutes: 30 };
  assert.equal(matchesRecipeFilters(pasta, quick), true);
  assert.equal(matchesRecipeFilters(kabsa, quick), false);
  assert.equal(matchesRecipeFilters(shakshuka, quick), false);
});

test("filters by meal type and cuisine, any of the selected values", () => {
  const filters = { ...EMPTY_RECIPE_FILTERS, mealTypes: ["dinner", "lunch"], cuisines: ["saudi"] };
  assert.equal(matchesRecipeFilters(kabsa, filters), true);
  assert.equal(matchesRecipeFilters(pasta, filters), false);
});

test("a recipe must have every selected main ingredient", () => {
  assert.equal(matchesRecipeFilters(kabsa, { ...EMPTY_RECIPE_FILTERS, ingredients: ["chicken", "rice"] }), true);
  assert.equal(matchesRecipeFilters(kabsa, { ...EMPTY_RECIPE_FILTERS, ingredients: ["chicken", "pasta"] }), false);
});

test("recognises main ingredients, including vegetarian dishes", () => {
  assert.equal(matchesMainIngredient(pasta, "vegetarian"), true);
  assert.equal(matchesMainIngredient(kabsa, "vegetarian"), false);
  assert.equal(matchesMainIngredient({ ...pasta, ingredient_names: [] }, "vegetarian"), false);
  assert.equal(matchesMainIngredient(shakshuka, "eggs"), true);
  assert.equal(matchesMainIngredient(moussaka, "eggs"), false);
  assert.equal(matchesMainIngredient(moussaka, "meat"), true);
});

test("offers only the filter values the library has, labelled in the app language", () => {
  const options = getRecipeFilterOptions(library, "ar");

  assert.deepEqual(
    options.mealTypes.map((option) => option.key).sort(),
    ["breakfast", "dinner", "lunch"]
  );
  assert.equal(options.mealTypes.find((option) => option.key === "dinner").label, "عشاء");
  // "General" and "Meal" are the importer's "unknown" values.
  assert.deepEqual(options.cuisines.map((option) => option.key).sort(), ["italian", "lebanese", "saudi"]);
  assert.deepEqual(options.ingredients, ["chicken", "meat", "rice", "pasta", "eggs", "vegetarian"]);
  assert.equal(options.hasTimes, true);
});

test("counts and prunes active filters", () => {
  const filters = { maxMinutes: 30, mealTypes: ["dinner", "brunch"], cuisines: [], ingredients: ["seafood"] };
  assert.equal(countActiveFilters(filters), 4);
  assert.equal(countActiveFilters(EMPTY_RECIPE_FILTERS), 0);

  const pruned = pruneRecipeFilters(filters, getRecipeFilterOptions(library, "en"));
  assert.deepEqual(pruned, { maxMinutes: 30, mealTypes: ["dinner"], cuisines: [], ingredients: [] });
  assert.equal(pruneRecipeFilters(pruned, getRecipeFilterOptions(library, "en")), pruned);
});
