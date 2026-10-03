import test from "node:test";
import assert from "node:assert/strict";

import { detectAllergens, detectDislikes, detectNonHalal } from "./ingredient-matching.ts";
import { applyIngredientSwaps, assessIngredient, assessRecipeIngredients } from "./ingredient-warnings.ts";

const noPreferences = { diet: [], allergies: [], dislikes: [] };

test("flags an allergy from the AI tags", () => {
  const result = assessIngredient(
    { name: "queso fresco", allergen_hints: ["Dairy"] },
    { ...noPreferences, allergies: ["dairy"] }
  );

  assert.deepEqual(result, { allergies: ["dairy"], dislikes: [], halal: null });
});

test("flags an allergy from the ingredient name when the AI tagged nothing", () => {
  const preferences = { ...noPreferences, allergies: ["dairy", "egg", "tree_nut", "wheat"] };

  assert.deepEqual(assessIngredient({ name: "unsalted butter" }, preferences).allergies, ["dairy"]);
  assert.deepEqual(assessIngredient({ name: "2 large eggs" }, preferences).allergies, ["egg"]);
  assert.deepEqual(assessIngredient({ name: "pine nuts" }, preferences).allergies, ["tree_nut"]);
  assert.deepEqual(assessIngredient({ name: "all-purpose flour" }, preferences).allergies, ["wheat"]);
  assert.deepEqual(assessIngredient({ name: "olive oil" }, preferences).allergies, []);
});

test("matches Arabic ingredient names, including joined prefixes", () => {
  assert.ok(detectAllergens(["زبدة غير مملحة"]).has("dairy"));
  assert.ok(detectAllergens(["بيضة"]).has("egg"));
  assert.ok(detectAllergens(["حفنة من اللوز"]).has("tree_nut"));
  assert.ok(detectAllergens(["الفول السوداني"]).has("peanut"));
  assert.ok(detectAllergens(["روبيان مقشر"]).has("shellfish"));
  assert.ok(detectAllergens(["دقيق أبيض"]).has("gluten"));
});

test("uses the localized names as well as the source name", () => {
  const result = assessIngredient(
    { name: "queso" },
    { ...noPreferences, allergies: ["dairy"] },
    { names: ["cheese", "جبنة"] }
  );

  assert.deepEqual(result.allergies, ["dairy"]);
});

test("does not confuse look-alike ingredients", () => {
  assert.equal(detectAllergens(["coconut milk"]).has("dairy"), false);
  assert.equal(detectAllergens(["peanut butter"]).has("dairy"), false);
  assert.equal(detectAllergens(["حليب جوز الهند"]).has("dairy"), false);
  assert.equal(detectAllergens(["eggplant"]).has("egg"), false);
  assert.equal(detectAllergens(["فلفل أبيض"]).has("egg"), false);
  assert.equal(detectAllergens(["nutmeg"]).has("tree_nut"), false);
  assert.equal(detectAllergens(["جوزة الطيب"]).has("tree_nut"), false);
  assert.equal(detectAllergens(["جوز الهند المبشور"]).has("tree_nut"), false);
  assert.equal(detectAllergens(["rice flour"]).has("wheat"), false);
  assert.equal(detectAllergens(["gluten-free pasta"]).has("gluten"), false);
  assert.equal(detectAllergens(["خبز لبناني"]).has("dairy"), false);
});

test("wheat implies gluten and shellfish implies seafood", () => {
  const flour = detectAllergens(["flour"]);
  assert.ok(flour.has("wheat") && flour.has("gluten"));

  const shrimp = detectAllergens(["shrimp"]);
  assert.ok(shrimp.has("shellfish") && shrimp.has("seafood"));

  const salmon = detectAllergens(["salmon fillet"]);
  assert.ok(salmon.has("seafood"));
  assert.equal(salmon.has("shellfish"), false);

  assert.ok(detectAllergens(["barley"]).has("gluten"));
  assert.equal(detectAllergens(["barley"]).has("wheat"), false);
});

test("flags disliked ingredients in either language", () => {
  const dislikes = ["onion", "olives", "spicy"];

  assert.deepEqual(detectDislikes(["red onions"], dislikes), ["onion"]);
  assert.deepEqual(detectDislikes(["بصل مفروم"], dislikes), ["onion"]);
  assert.deepEqual(detectDislikes(["black olives"], dislikes), ["olives"]);
  assert.deepEqual(detectDislikes(["extra virgin olive oil"], dislikes), []);
  assert.deepEqual(detectDislikes(["زيت الزيتون"], dislikes), []);
  assert.deepEqual(detectDislikes(["jalapeño"], dislikes), ["spicy"]);
  assert.deepEqual(detectDislikes(["محار"], dislikes), []);
});

test("matches dislikes the user typed themselves", () => {
  assert.deepEqual(detectDislikes(["fresh beets"], ["beet"]), ["beet"]);
  assert.deepEqual(detectDislikes(["الشمندر المسلوق"], ["شمندر"]), ["شمندر"]);
  assert.deepEqual(detectDislikes(["beetroot"], ["beet"]), []);
  assert.deepEqual(detectDislikes(["carrot"], ["  "]), []);
});

test("reports dislikes through the assessment", () => {
  const result = assessIngredient(
    { name: "mushrooms" },
    { ...noPreferences, dislikes: ["mushroom", "okra"] }
  );

  assert.deepEqual(result.dislikes, ["mushroom"]);
});

test("swaps a non-halal ingredient for its alternative for halal users", () => {
  const result = assessIngredient(
    {
      name: "pork bacon",
      is_halal: false,
      halal_concern: "Contains pork",
      suggested_alternative: "halal beef bacon",
    },
    { ...noPreferences, diet: ["halal"] }
  );

  assert.deepEqual(result.halal, {
    alternative: "halal beef bacon",
    swapped: true,
    concern: "Contains pork",
    concernKind: "pork",
  });
});

test("keeps the original when the user rolled the swap back", () => {
  const result = assessIngredient(
    { name: "bacon", is_halal: false, suggested_alternative: "beef bacon", use_original: true },
    { ...noPreferences, diet: ["halal"] }
  );

  assert.equal(result.halal?.swapped, false);
  assert.equal(result.halal?.alternative, "beef bacon");
});

test("does not check halal for users who did not choose it", () => {
  const result = assessIngredient(
    { name: "bacon", is_halal: false, suggested_alternative: "beef bacon" },
    { ...noPreferences, diet: ["keto"] }
  );

  assert.equal(result.halal, null);
});

test("catches non-halal ingredients the AI left untagged", () => {
  const halal = { ...noPreferences, diet: ["halal"] };

  assert.deepEqual(assessIngredient({ name: "dry white wine" }, halal).halal, {
    alternative: "grape juice with a splash of vinegar",
    swapped: true,
    concern: undefined,
    concernKind: "alcohol",
  });
  assert.equal(assessIngredient({ name: "نبيذ أحمر" }, halal, { language: "ar" }).halal?.alternative, "عصير عنب مع قليل من الخل");
  assert.equal(assessIngredient({ name: "smoked ham" }, halal).halal?.concernKind, "pork");
});

test("trusts the AI when it marked an ingredient halal", () => {
  const halal = { ...noPreferences, diet: ["halal"] };

  assert.equal(assessIngredient({ name: "bacon", is_halal: true }, halal).halal, null);
});

test("leaves halal look-alikes alone", () => {
  assert.equal(detectNonHalal(["beef bacon"]), null);
  assert.equal(detectNonHalal(["turkey ham"]), null);
  assert.equal(detectNonHalal(["hamburger buns"]), null);
  assert.equal(detectNonHalal(["red wine vinegar"]), null);
  assert.equal(detectNonHalal(["ginger"]), null);
  assert.equal(detectNonHalal(["ديك رومي"]), null);
  assert.equal(detectNonHalal(["خميرة"]), null);
});

test("prefers an alternative written in the display language", () => {
  const ingredient = {
    name: "bacon",
    is_halal: false,
    halal_concern: "Contains pork",
    suggested_alternative: "beef bacon",
  };
  const halal = { ...noPreferences, diet: ["halal"] };

  const localized = assessIngredient(ingredient, halal, {
    language: "ar",
    localizedAlternative: "بيكون بقري",
  });
  assert.equal(localized.halal?.alternative, "بيكون بقري");
  // The English reason is dropped in Arabic; the screen shows its own wording.
  assert.equal(localized.halal?.concern, undefined);
  assert.equal(localized.halal?.concernKind, "pork");

  const fallback = assessIngredient(ingredient, halal, { language: "ar" });
  assert.equal(fallback.halal?.alternative, "لحم بقري مقدد");
});

test("flags a non-halal ingredient without a swap when no alternative is known", () => {
  const result = assessIngredient(
    { name: "gelatin", is_halal: false },
    { ...noPreferences, diet: ["halal"] }
  );

  assert.deepEqual(result.halal, {
    alternative: undefined,
    swapped: false,
    concern: undefined,
    concernKind: undefined,
  });
});

test("rewrites whole-word mentions of a swapped ingredient", () => {
  const swaps = [{ from: "ham", to: "smoked turkey" }];

  assert.equal(applyIngredientSwaps("Add the Ham, then stir.", swaps), "Add the smoked turkey, then stir.");
  assert.equal(applyIngredientSwaps("Toast the hamburger buns.", swaps), "Toast the hamburger buns.");
  assert.equal(
    applyIngredientSwaps("أضف النبيذ الأحمر.", [{ from: "نبيذ", to: "عصير عنب" }]),
    "أضف عصير عنب الأحمر."
  );
});

test("assesses a whole recipe with its translated ingredient names", () => {
  const recipe = {
    ingredients_json: [
      { name: "panceta", is_halal: false, suggested_alternative: "beef bacon" },
      { name: "nata" },
    ],
    localized: {
      en: { ingredients: [{ name: "pancetta" }, { name: "heavy cream" }] },
      ar: { ingredients: [{ name: "بانشيتا", suggested_alternative: "لحم بقري مقدد" }, { name: "كريمة" }] },
    },
  };
  const preferences = { diet: ["halal"], allergies: ["dairy"], dislikes: [] };

  const [pancetta, cream] = assessRecipeIngredients(recipe, preferences, "ar");

  assert.equal(pancetta.halal?.alternative, "لحم بقري مقدد");
  assert.equal(pancetta.halal?.swapped, true);
  assert.deepEqual(cream.allergies, ["dairy"]);
});

test("ignores translated ingredients that do not line up with the recipe", () => {
  const recipe = {
    ingredients_json: [{ name: "arroz" }, { name: "agua" }],
    localized: { en: { ingredients: [{ name: "butter" }] } },
  };

  const [rice] = assessRecipeIngredients(recipe, { diet: [], allergies: ["dairy"], dislikes: [] }, "en");

  assert.deepEqual(rice.allergies, []);
});
