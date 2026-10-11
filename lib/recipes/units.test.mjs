import assert from "node:assert/strict";
import { test } from "node:test";

import { convertIngredientAmount, convertTemperature, getLocalizedUnitLabel, isCountBasedUnit } from "./units.ts";
import { toArabicIndicDigits } from "./numerals.ts";

test("converts ingredient amounts between metric and imperial while preserving count units", () => {
  assert.deepEqual(convertIngredientAmount({ quantity: "240", unit: "ml", name: "milk" }, "imperial"), {
    quantity: "1",
    unit: "cup",
  });
  // Converted amounts round the way a cook measures.
  assert.deepEqual(convertIngredientAmount({ quantity: "8", unit: "oz", name: "cheese" }, "metric"), {
    quantity: "225",
    unit: "g",
  });
  assert.deepEqual(convertIngredientAmount({ quantity: "1/3", unit: "cup", name: "milk" }, "metric"), {
    quantity: "80",
    unit: "ml",
  });
  assert.deepEqual(convertIngredientAmount({ quantity: "1½", unit: "cup", name: "milk" }, "metric"), {
    quantity: "350",
    unit: "ml",
  });
  assert.equal(isCountBasedUnit("cloves"), true);
  assert.deepEqual(convertIngredientAmount({ quantity: "2", unit: "cloves", name: "garlic" }, "imperial"), {
    quantity: "2",
    unit: "cloves",
  });
});

test("converts temperatures to the requested measurement system", () => {
  assert.deepEqual(convertTemperature(180, "C", "imperial"), { value: 356, unit: "F" });
  assert.deepEqual(convertTemperature(350, "F", "metric"), { value: 177, unit: "C" });
  assert.deepEqual(convertTemperature(180, "C", "metric"), { value: 180, unit: "C" });
});

test("localizes Arabic numerals and unit labels for display", () => {
  assert.equal(toArabicIndicDigits("12.5"), "١٢.٥");
  assert.equal(getLocalizedUnitLabel("whole", "ar"), "حبة");
  assert.equal(getLocalizedUnitLabel("dash", "ar"), "قليل");
});
