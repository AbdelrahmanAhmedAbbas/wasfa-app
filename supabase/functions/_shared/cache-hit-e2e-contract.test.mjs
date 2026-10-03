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
  assert.match(cacheHitBranch[1], /sourceThumbnailUrl:\s*cachedExtraction\.source_thumbnail_url/);
  assert.match(pipeline, /sourceThumbnailUrl:\s*metadata\.thumbnailUrl \?\? null,\n\s+modelInfo/);
  assert.match(dbModule, /source_thumbnail_url: params\.sourceThumbnailUrl \?\? null/);
  assert.match(dbModule, /\.select\("[^"]*source_thumbnail_url[^"]*"\)/);
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

test("a cached recipe that lacks a language is completed and stored again", () => {
  const pipeline = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");
  const ai = readFileSync(new URL("./ai.ts", import.meta.url), "utf8");

  const cacheHitBranch = pipeline.match(/if \(cachedExtraction\) \{([\s\S]*?)\n    \}\n\n    const metadata/);
  assert.ok(cacheHitBranch);
  assert.match(cacheHitBranch[1], /completeLocalizedContent\(cachedExtraction\.payload\)/);
  assert.match(cacheHitBranch[1], /upsertExtractionCache/);
  assert.match(cacheHitBranch[1], /stage:\s*"cache_localization_repair"/);
  // The repaired draft, not the stored one, is what the user receives.
  assert.match(cacheHitBranch[1], /const cachedDraft = completion\.draft/);

  // A complete entry returns before any model is called.
  assert.match(ai, /if \(missing\.length === 0\) return \{ draft, filled: \[\], failed: \[\] \}/);
});
