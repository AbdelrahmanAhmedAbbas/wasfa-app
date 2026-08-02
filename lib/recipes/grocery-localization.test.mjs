import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("grocery screen uses localized recipe titles for source labels while grouping by recipe id", () => {
  const grocery = readFileSync(new URL("../../app/(tabs)/grocery.tsx", import.meta.url), "utf8");
  const shoppingClient = readFileSync(new URL("../../lib/shopping/client.ts", import.meta.url), "utf8");

  assert.match(shoppingClient, /localized_json/);
  assert.match(grocery, /getShoppingRecipeTitle/);
  assert.match(grocery, /item\.recipe\?\.id/);
  assert.match(grocery, /recipeTitles/);
});
