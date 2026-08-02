import test from "node:test";
import assert from "node:assert/strict";

import { getIngredientWarnings } from "./ingredient-warnings.ts";

test("returns a red allergy warning when ingredient metadata matches user allergies", () => {
  const warnings = getIngredientWarnings(
    {
      name: "cheese",
      allergen_hints: ["dairy"],
    },
    {
      diet: [],
      allergies: ["dairy"],
    }
  );

  assert.deepEqual(warnings, [
    {
      kind: "allergy",
      tone: "danger",
      label: "Dairy allergy",
    },
  ]);
});

test("returns non-halal warning and suggested alternative for halal users", () => {
  const warnings = getIngredientWarnings(
    {
      name: "pork bacon",
      is_halal: false,
      halal_concern: "Contains pork",
      suggested_alternative: "halal beef bacon",
    },
    {
      diet: ["halal"],
      allergies: [],
    }
  );

  assert.deepEqual(warnings, [
    {
      kind: "halal",
      tone: "danger",
      label: "Not halal",
      detail: "Contains pork",
      suggestion: "halal beef bacon",
    },
  ]);
});
