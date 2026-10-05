import assert from "node:assert/strict";
import { test } from "node:test";

import { linkStepIngredients, normalizeIngredientNameForLinking } from "./stepRewriter.ts";

test("normalizes and links rewritten step ingredients to canonical draft ingredient names", () => {
  assert.equal(normalizeIngredientNameForLinking(" Chopped Tomatoes "), "chopped tomato");

  const linked = linkStepIngredients(
    [
      {
        order: 1,
        title: "Cook sauce",
        text: "Cook the tomatoes with onions.",
        ingredients_used: ["tomatoes", "onion"],
      },
    ],
    [
      { name: "tomato" },
      { name: "onions" },
    ]
  );

  assert.deepEqual(linked[0].ingredients_used, ["tomato", "onions"]);
});
