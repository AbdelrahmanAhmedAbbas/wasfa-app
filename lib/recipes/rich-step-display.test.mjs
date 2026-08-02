import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatStepMetaItems,
  formatStepTemperature,
  getEstimatedIngredientLabel,
  getSafeStepTitle,
} from "./rich-step-display.ts";

test("formats rich recipe display helpers with safe fallbacks", () => {
  assert.equal(getEstimatedIngredientLabel({ name: "flour", is_estimated: true }), "Estimated");
  assert.equal(getEstimatedIngredientLabel({ name: "flour", is_estimated: false }), null);

  assert.equal(formatStepTemperature({ value: 180, unit: "C" }), "180°C");
  assert.equal(formatStepTemperature(undefined), null);

  assert.equal(getSafeStepTitle({ order: 2, title: "  Bake  ", text: "Bake until set." }, 1), "Bake");
  assert.equal(getSafeStepTitle({ order: 2, text: "Bake until set." }, 1), "Step 2");

  assert.deepEqual(
    formatStepMetaItems({
      order: 1,
      title: "Mix",
      text: "Mix batter.",
      duration_minutes: 5,
      temperature: { value: 180, unit: "C" },
      equipment: ["bowl", "spoon"],
      ingredients_used: ["flour", "milk"],
    }),
    ["5 min", "180°C", "bowl, spoon", "flour, milk"]
  );
});
