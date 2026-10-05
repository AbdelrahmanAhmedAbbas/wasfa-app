import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("confirmed recipes persist and expose localized recipe text", () => {
  const schema = readFileSync(new URL("../schema.ts", import.meta.url), "utf8");
  const imports = readFileSync(new URL("../imports.ts", import.meta.url), "utf8");
  const sharedTypes = readFileSync(new URL("./types.ts", import.meta.url), "utf8");
  const validation = readFileSync(new URL("./validation.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../../lib/recipes/client.ts", import.meta.url), "utf8");

  assert.match(schema, /localized_json: localized,/);
  assert.match(imports, /localized_json:\s*draft\.localized\s*\?\?\s*\{\}/);
  assert.match(client, /localized_json/);
  assert.match(client, /localized:\s*normalizeLocalizedRecipeText/);
  assert.match(sharedTypes, /cuisine\?:\s*string/);
  assert.match(sharedTypes, /meal_type\?:\s*string/);
  assert.match(validation, /cuisine:\s*optionalString\(item\.cuisine\)/);
  assert.match(validation, /meal_type:\s*optionalString\(item\.meal_type\)/);
});
