import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("cross-user re-import hits normalized URL cache without model or Apify calls", () => {
  const pipeline = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");
  const cacheModule = readFileSync(new URL("./cache.ts", import.meta.url), "utf8");
  const dbModule = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
  const expected = JSON.parse(
    readFileSync(new URL("./fixtures/cross-user-cache-hit.expected.json", import.meta.url), "utf8")
  );

  assert.match(cacheModule, /normalizeSourceUrlForCache/);
  assert.match(dbModule, /upsertExtractionCache/);
  assert.match(pipeline, /stage:\s*"cache_write"/);

  const cacheHitBranch = pipeline.match(/if \(cachedExtraction\) \{([\s\S]*?)\n    \}\n\n    const metadata/);
  assert.ok(cacheHitBranch, "cache hit branch should return before metadata fetch");
  assert.match(cacheHitBranch[1], /upsertRecipeDraft/);
  assert.match(cacheHitBranch[1], /confirmRecipeFromDraft/);
  assert.match(cacheHitBranch[1], /cache_hit:\s*true/);
  assert.doesNotMatch(cacheHitBranch[1], /fetchApifyMetadata|extractRecipe|generateRecipeContent|estimateNutrition|transcribeWithOpenRouter|openrouter_transcribe/);

  assert.equal(expected.first_import.cache_written, true);
  assert.equal(expected.second_import.cache_hit, true);
  assert.notEqual(expected.first_import.user_id, expected.second_import.user_id);
  assert.notEqual(expected.first_import.recipe_id, expected.second_import.recipe_id);
  assert.equal(expected.second_import.normalized_source_url, expected.first_import.normalized_source_url);
  assert.equal(expected.second_import.confidence.cache_hit, true);
  assert.deepEqual(expected.second_import.skipped_events, [
    "metadata_fetch",
    "openrouter_transcribe",
    "gemini_parse",
    "content_generation_en",
    "sanity_check",
    "cache_write"
  ]);
});
