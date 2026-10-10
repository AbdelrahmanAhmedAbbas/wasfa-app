import assert from "node:assert/strict";
import { test } from "node:test";

import { linesToAdd } from "./shoppingLines.ts";

test("adds every line of a recipe not on the list yet", () => {
  assert.deepEqual(linesToAdd([], ["1 cup flour", " 2 eggs ", ""]), ["1 cup flour", "2 eggs"]);
});

test("keeps a line the recipe lists twice", () => {
  assert.deepEqual(linesToAdd([], ["1 cup flour", "1 cup flour"]), ["1 cup flour", "1 cup flour"]);
});

test("planning a recipe again adds nothing", () => {
  const lines = ["1 cup flour", "1 cup flour", "2 eggs"];
  assert.deepEqual(linesToAdd(lines, lines), []);
});

test("adds only what is missing when the recipe gained a line", () => {
  assert.deepEqual(linesToAdd(["1 cup flour"], ["1 cup flour", "1 cup flour", "2 eggs"]), ["1 cup flour", "2 eggs"]);
});

test("a line saved with its notes still answers for the same line without them", () => {
  assert.deepEqual(linesToAdd(["1 cup flour (for the dough)", "1 cup flour (for the filling)"], ["1 cup flour", "1 cup flour"]), []);
});
