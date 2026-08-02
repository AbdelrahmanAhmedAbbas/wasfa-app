import assert from "node:assert/strict";
import { test } from "node:test";

import { convertIngredientAmount, convertTemperature, isCountBasedUnit } from "./units.ts";

test("converts ingredient amounts between metric and imperial while preserving count units", () => {
  assert.deepEqual(convertIngredientAmount({ quantity: "240", unit: "ml", name: "milk" }, "imperial"), {
    quantity: "1",
    unit: "cup",
  });
  assert.deepEqual(convertIngredientAmount({ quantity: "8", unit: "oz", name: "cheese" }, "metric"), {
    quantity: "227",
    unit: "g",
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
