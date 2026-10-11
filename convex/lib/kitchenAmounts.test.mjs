import assert from "node:assert/strict";
import { test } from "node:test";

import { displayAmount, formatAmount, parseAmount, roundForKitchen, scaleAmount } from "./kitchenAmounts.ts";

const scaled = (quantity, unit, name, factor) => {
  const result = scaleAmount({ quantity, unit, name }, factor);
  return [result.quantity, result.unit].filter(Boolean).join(" ");
};

test("reads amounts however they are written", () => {
  assert.equal(parseAmount("2"), 2);
  assert.equal(parseAmount("0.5"), 0.5);
  assert.equal(parseAmount("1/2"), 0.5);
  assert.equal(parseAmount("1 1/2"), 1.5);
  assert.equal(parseAmount("1½"), 1.5);
  assert.equal(parseAmount("½"), 0.5);
  assert.equal(parseAmount("٢"), 2);
  assert.equal(parseAmount("2-3"), null);
  assert.equal(parseAmount("to taste"), null);
  assert.equal(parseAmount(undefined), null);
});

test("never asks for 0.35 of an onion", () => {
  assert.equal(scaled("1", undefined, "onion", 0.35), "1/2");
  assert.equal(scaled("1", "whole", "onion", 0.25), "1/2 whole");
  assert.equal(scaled("2", undefined, "onions", 0.75), "1 1/2");
  assert.equal(scaled("3", undefined, "tomatoes", 1.5), "5");
});

test("keeps eggs, cloves and slices whole", () => {
  assert.equal(scaled("3", undefined, "eggs", 0.5), "2");
  assert.equal(scaled("1", undefined, "egg", 0.25), "1");
  assert.equal(scaled("4", "clove", "garlic", 0.6), "2 clove");
  assert.equal(scaled("2", undefined, "بيض", 1.5), "3");
  assert.equal(scaled("5", "slice", "bread", 0.5), "3 slice");
});

test("measures spoons and cups in quarters and thirds", () => {
  assert.equal(scaled("1", "tsp", "salt", 0.33), "1/4 tsp");
  assert.equal(scaled("1", "tsp", "salt", 0.1), "1/4 tsp");
  assert.equal(scaled("1", "cup", "rice", 0.67), "2/3 cup");
  assert.equal(scaled("2", "cup", "rice", 1.5), "3 cup");
  assert.equal(scaled("1", "tbsp", "oil", 1.5), "1 1/2 tbsp");
});

test("moves to the spoon or cup that reads best", () => {
  // 0.1 cup is 1.6 tbsp.
  assert.equal(scaled("1/2", "cup", "milk", 0.2), "1 1/2 tbsp");
  // Half a tablespoon is 1.5 teaspoons.
  assert.equal(scaled("1", "tbsp", "sugar", 0.5), "1 1/2 tsp");
  // 6 teaspoons are 2 tablespoons.
  assert.equal(scaled("2", "tsp", "cumin", 3), "2 tbsp");
});

test("rounds weights and volumes to amounts on a scale or jug", () => {
  assert.equal(scaled("500", "g", "chicken", 0.67), "325 g");
  assert.equal(scaled("150", "g", "flour", 0.35), "55 g");
  assert.equal(scaled("7", "g", "yeast", 0.5), "4 g");
  assert.equal(scaled("1", "kg", "beef", 0.35), "350 g");
  assert.equal(scaled("750", "g", "rice", 2), "1 1/2 kg");
  assert.equal(scaled("1", "l", "water", 1.3), "1 1/4 l");
  assert.equal(scaled("200", "ml", "cream", 0.33), "65 ml");
});

test("nothing rounds down to zero", () => {
  assert.equal(roundForKitchen(0.01, "g", "saffron").quantity, 1);
  assert.equal(roundForKitchen(0.05, "tsp", "salt").quantity, 0.25);
  assert.equal(roundForKitchen(0.05, undefined, "onion").quantity, 0.5);
});

test("leaves an amount it cannot read as written", () => {
  assert.deepEqual(scaleAmount({ quantity: "2-3", unit: "cup", name: "rice" }, 2), { quantity: "2-3", unit: "cup" });
  assert.deepEqual(scaleAmount({ name: "salt" }, 2), { quantity: undefined, unit: undefined });
});

test("saves amounts as plain fractions and shows them as cooks write them", () => {
  assert.equal(formatAmount(1.5), "1 1/2");
  assert.equal(formatAmount(1 / 3), "1/3");
  assert.equal(formatAmount(2), "2");
  assert.equal(formatAmount(1.3), "1.3");
  assert.equal(displayAmount("0.5"), "½");
  assert.equal(displayAmount("1 1/2"), "1½");
  assert.equal(displayAmount("0.33"), "⅓");
  assert.equal(displayAmount("0.35"), "⅓");
  assert.equal(displayAmount("0.4"), "0.4");
  assert.equal(displayAmount("250"), "250");
  assert.equal(displayAmount("2-3"), "2-3");
});
