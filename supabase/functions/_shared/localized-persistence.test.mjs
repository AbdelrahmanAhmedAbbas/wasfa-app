import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("confirmed recipes persist and expose localized recipe text", () => {
  const migrationsDir = new URL("../../migrations/", import.meta.url);
  const migrationSources = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => readFileSync(new URL(name, migrationsDir), "utf8"))
    .join("\n");
  const db = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
  const sharedTypes = readFileSync(new URL("./types.ts", import.meta.url), "utf8");
  const validation = readFileSync(new URL("./validation.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../../../lib/recipes/client.ts", import.meta.url), "utf8");

  assert.match(migrationSources, /localized_json\s+jsonb\s+not\s+null\s+default\s+'\{\}'::jsonb/);
  assert.match(db, /localized_json:\s*params\.payload\.localized\s*\?\?\s*\{\}/);
  assert.match(client, /localized_json/);
  assert.match(client, /localized:\s*normalizeLocalizedRecipeText/);
  assert.match(sharedTypes, /cuisine\?:\s*string/);
  assert.match(sharedTypes, /meal_type\?:\s*string/);
  assert.match(validation, /cuisine:\s*optionalString\(item\.cuisine\)/);
  assert.match(validation, /meal_type:\s*optionalString\(item\.meal_type\)/);
});
