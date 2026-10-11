import assert from "node:assert/strict";
import { test } from "node:test";

import { scaleIngredientQuantities } from "./ai.ts";

const imported = [
  { name: "onion", quantity: "1", is_estimated: false },
  { name: "eggs", quantity: "3", is_estimated: false },
  { name: "rice", quantity: "2", unit: "cup", is_estimated: false },
  { name: "salt", is_estimated: false },
];

const amounts = (ingredients) => ingredients.map((entry) => [entry.quantity, entry.unit].filter(Boolean).join(" "));

test("scales to kitchen amounts and keeps the imported amounts", () => {
  const forOne = scaleIngredientQuantities(imported, 4, 1);
  assert.deepEqual(amounts(forOne), ["1/2", "1", "1/2 cup", ""]);
  assert.equal(forOne[0].base_quantity, "1");
  assert.equal(forOne[2].base_unit, "cup");
  assert.equal(forOne[3].base_quantity, undefined);
});

test("scaling again starts from the imported amounts, not the rounded ones", () => {
  const forOne = scaleIngredientQuantities(imported, 4, 1);
  const backToFour = scaleIngredientQuantities(forOne, 4, 4);
  assert.deepEqual(amounts(backToFour), ["1", "3", "2 cup", ""]);
  const forSix = scaleIngredientQuantities(forOne, 4, 6);
  assert.deepEqual(amounts(forSix), ["1 1/2", "5", "3 cup", ""]);
});

test("a unit changed by scaling goes back with the amount", () => {
  const sauce = [{ name: "milk", quantity: "1/2", unit: "cup", is_estimated: false }];
  const small = scaleIngredientQuantities(sauce, 4, 1);
  assert.deepEqual(amounts(small), ["2 tbsp"]);
  assert.deepEqual(amounts(scaleIngredientQuantities(small, 4, 4)), ["1/2 cup"]);
});

test("a recipe with no serving count is left as it is", () => {
  assert.deepEqual(amounts(scaleIngredientQuantities(imported, undefined, 2)), ["1", "3", "2 cup", ""]);
});
