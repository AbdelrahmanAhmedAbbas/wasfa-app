import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeIngredientSources,
  markIngredientReviewStates,
  normalizeIngredientKey,
} from "./ingredient-details.ts";

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
