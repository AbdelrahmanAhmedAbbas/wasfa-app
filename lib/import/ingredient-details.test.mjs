import test from "node:test";
import assert from "node:assert/strict";

import {
  isIngredientDetailComplete,
  markIngredientReviewState,
} from "./ingredient-details.ts";

test("detects whether an ingredient has a specific quantity, count, or size", () => {
  assert.equal(isIngredientDetailComplete({ name: "beef bacon", quantity: "150", unit: "g" }), true);
  assert.equal(isIngredientDetailComplete({ name: "olive oil", quantity: "2", unit: "tbsp" }), true);
  assert.equal(isIngredientDetailComplete({ name: "onion", quantity: "1", unit: "whole" }), true);
  assert.equal(isIngredientDetailComplete({ name: "beef bacon" }), false);
  assert.equal(isIngredientDetailComplete({ name: "beef bacon", preparation: "diced" }), false);
});

test("marks incomplete ingredients for user review", () => {
  assert.deepEqual(markIngredientReviewState({ name: "beef bacon" }), {
    name: "beef bacon",
    needs_review: true,
  });
  assert.deepEqual(markIngredientReviewState({ name: "beef bacon", quantity: "150", unit: "g" }), {
    name: "beef bacon",
    quantity: "150",
    unit: "g",
    needs_review: false,
  });
});
