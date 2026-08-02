import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("extraction cache migration and DB helpers exist", () => {
  const migrationsUrl = new URL("../../migrations/", import.meta.url);
  const migration = readdirSync(migrationsUrl)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => readFileSync(new URL(name, migrationsUrl), "utf8"))
    .find((contents) => contents.includes("recipe_extraction_cache"));

  assert.ok(migration, "recipe_extraction_cache migration should exist");
  assert.match(migration, /normalized_source_url text primary key/);
  assert.match(migration, /payload jsonb not null/);
  assert.match(migration, /extraction_model text/);
  assert.match(migration, /enable row level security/);

  const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
  assert.match(dbSource, /findCachedExtractionByUrl/);
  assert.match(dbSource, /upsertExtractionCache/);
});

test("pipeline wires extraction cache lookup, hit confirmation, and write telemetry", () => {
  const pipeline = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");

  assert.match(pipeline, /normalizeSourceUrlForCache/);
  assert.match(pipeline, /findCachedExtractionByUrl/);
  assert.match(pipeline, /upsertExtractionCache/);
  assert.match(pipeline, /cache_lookup/);
  assert.match(pipeline, /cache_write/);
  assert.match(pipeline, /cache_hit/);
  assert.match(pipeline, /cache_source_url/);
});
