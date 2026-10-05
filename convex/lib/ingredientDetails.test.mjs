import test from "node:test";
import assert from "node:assert/strict";

import {
  isIngredientDetailComplete,
  mergeIngredientSources,
  markIngredientReviewStates,
  normalizeIngredientKey,
  normalizeQuantity,
  normalizeUnit,
} from "./ingredientDetails.ts";

test("AI-estimated ingredient details override name-only transcript ingredients", () => {
  const merged = mergeIngredientSources([
    { name: "beef bacon", source: "transcript" },
    {
      name: "beef bacon",
      quantity: "150",
      unit: "g",
      preparation: "cooked and diced",
      source: "ai_estimate",
      evidence_text: "150g Cooked & Diced Beef Bacon",
    },
  ]);

  assert.deepEqual(merged, [
    {
      name: "beef bacon",
      quantity: "150",
      unit: "g",
      preparation: "cooked and diced",
      source: "ai_estimate",
      evidence_text: "150g Cooked & Diced Beef Bacon",
      needs_review: false,
      is_estimated: true,
    },
  ]);
});

test("web research fills details only when citation evidence is present", () => {
  const withEvidence = mergeIngredientSources([
    { name: "olive oil", source: "transcript" },
    {
      name: "olive oil",
      quantity: "2",
      unit: "tbsp",
      source: "web_research",
      evidence_text: "2 tbsp olive oil",
      citation_url: "https://example.com/recipe",
    },
  ]);
  const withoutEvidence = mergeIngredientSources([
    { name: "beef bacon", source: "transcript" },
    { name: "beef bacon", quantity: "150", unit: "g", source: "web_research" },
  ]);

  assert.equal(withEvidence[0].needs_review, false);
  assert.equal(withEvidence[0].source, "web_research");
  assert.deepEqual(withoutEvidence, [
    { name: "beef bacon", source: "transcript", needs_review: true },
  ]);
});

test("review state is applied to every ingredient", () => {
  assert.deepEqual(
    markIngredientReviewStates([
      { name: "onion", quantity: "1", unit: "whole" },
      { name: "salt" },
    ]),
    [
      { name: "onion", quantity: "1", unit: "whole", needs_review: false },
      { name: "salt", needs_review: true },
    ]
  );
});

test("ingredient normalization preserves Arabic letters for deduping", () => {
  assert.equal(normalizeIngredientKey("بصل مفروم"), "بصل");
  assert.equal(normalizeIngredientKey("طماطم-كرزية!!"), "طماطم كرزية");

  const merged = mergeIngredientSources([
    { name: "بصل", source: "transcript" },
    { name: "بصل مفروم", quantity: "1", unit: "حبة", source: "ai_estimate" },
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, "بصل مفروم");
  assert.equal(merged[0].quantity, "1");
  assert.equal(merged[0].unit, "حبة");
});

test("Arabic units are stored as the English unit the app can translate, scale and convert", () => {
  const cases = {
    "ملعقة كبيرة": "tbsp",
    "ملعقه كبيره": "tbsp",
    "معلقة أكل": "tbsp",
    "ملاعق كبيرة": "tbsp",
    "ملعقة صغيرة": "tsp",
    "معلقة شاي": "tsp",
    "كوب": "cup",
    "كوباية": "cup",
    "أكواب": "cup",
    "جرام": "g",
    "غرام": "g",
    "كيلو": "kg",
    "مل": "ml",
    "لتر": "l",
    "فص": "clove",
    "فصوص": "clove",
    "حبة": "whole",
    "حبه": "whole",
    "رشة": "pinch",
    "علبة": "can",
  };
  for (const [arabic, unit] of Object.entries(cases)) {
    assert.equal(normalizeUnit(arabic), unit, arabic);
  }
});

test("English units and units with no known match are left as written", () => {
  assert.equal(normalizeUnit("Tbsp."), "tbsp");
  assert.equal(normalizeUnit("cups"), "cups");
  assert.equal(normalizeUnit("pods"), "pods");
  assert.equal(normalizeUnit("ملعقة"), "ملعقة");
  assert.equal(normalizeUnit(null), "");
});

test("amounts are rewritten with Western digits", () => {
  assert.equal(normalizeQuantity("٢"), "2");
  assert.equal(normalizeQuantity("١٫٥"), "1.5");
  assert.equal(normalizeQuantity("۳"), "3");
  assert.equal(normalizeQuantity("½"), "1/2");
  assert.equal(normalizeQuantity("1½"), "1 1/2");
  assert.equal(normalizeQuantity(" 1/4 "), "1/4");
  assert.equal(normalizeQuantity("2-3"), "2-3");
  assert.equal(normalizeQuantity(undefined), "");
});

test("an amount written together with an Arabic unit counts as a complete measurement", () => {
  assert.equal(isIngredientDetailComplete({ quantity: "2 كوب" }), true);
  assert.equal(isIngredientDetailComplete({ quantity: "٢ ملعقة كبيرة" }), true);
  assert.equal(isIngredientDetailComplete({ size: "500 جرام" }), true);
  assert.equal(isIngredientDetailComplete({ quantity: "2" }), false);
  assert.equal(isIngredientDetailComplete({}), false);
});

test("halal and allergen findings survive merging and review marking", () => {
  const merged = mergeIngredientSources([
    {
      name: "bacon",
      source: "transcript",
      is_halal: false,
      halal_concern: "pork",
      suggested_alternative: "beef bacon",
      dietary_flags: ["pork", "meat"],
      allergen_hints: [],
      is_estimated: false,
    },
    { name: "soy sauce", quantity: "2", unit: "tbsp", allergen_hints: ["wheat", "gluten"], is_estimated: false },
    { name: "bacon", quantity: "150", unit: "g", source: "ai_estimate", is_estimated: true },
  ]);

  assert.equal(merged.length, 2);
  assert.equal(merged[0].quantity, "150");
  assert.equal(merged[0].is_halal, false);
  assert.equal(merged[0].halal_concern, "pork");
  assert.equal(merged[0].suggested_alternative, "beef bacon");
  assert.deepEqual(merged[0].dietary_flags, ["pork", "meat"]);
  assert.deepEqual(merged[1].allergen_hints, ["wheat", "gluten"]);
});
