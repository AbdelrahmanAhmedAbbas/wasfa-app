import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the extraction cache table and its read and write functions exist", () => {
  const schema = readFileSync(new URL("../schema.ts", import.meta.url), "utf8");
  const table = schema.match(/recipe_extraction_cache: defineTable\(\{([\s\S]*?)\}\)\.index\("by_normalized_source_url", \["normalized_source_url"\]\)/);
  assert.ok(table, "recipe_extraction_cache should be indexed by its normalized URL");
  assert.match(table[1], /normalized_source_url: v\.string\(\)/);
  assert.match(table[1], /payload: v\.any\(\)/);
  assert.match(table[1], /extraction_model: v\.optional\(v\.string\(\)\)/);

  const imports = readFileSync(new URL("../imports.ts", import.meta.url), "utf8");
  // The cache is shared by every user, so only server code may read or write it.
  assert.match(imports, /export const findCachedExtraction = internalQuery\(/);
  assert.match(imports, /export const upsertExtractionCache = internalMutation\(/);
});

test("pipeline wires extraction cache lookup, hit confirmation, and write telemetry", () => {
  const pipeline = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");
  assert.match(pipeline, /normalizeSourceUrlForCache/);
  assert.match(pipeline, /store\.findCachedExtraction\(normalizedCacheUrl\)/);
  assert.match(pipeline, /store\.upsertExtractionCache/);
  assert.match(pipeline, /cache_lookup/);
  assert.match(pipeline, /cache_write/);
  assert.match(pipeline, /cache_hit/);
  assert.match(pipeline, /cache_source_url/);
});
