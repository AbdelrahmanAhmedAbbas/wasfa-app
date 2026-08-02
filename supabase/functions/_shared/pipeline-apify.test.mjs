import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("pipeline uses platform-specific Apify actors and TikTok actor transcripts", () => {
  const source = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");

  assert.match(source, /APIFY_ACTOR_INSTAGRAM/);
  assert.match(source, /APIFY_ACTOR_TIKTOK/);
  assert.doesNotMatch(source, /APIFY_ACTOR_ID/);
  assert.match(source, /fetchInstagramViaApify/);
  assert.match(source, /fetchTikTokViaApify/);
  assert.match(source, /source_platform/);
  assert.match(source, /translate:\s*"english"/);
  assert.match(source, /postURLs:\s*\[sourceUrl\]/);
  assert.match(source, /video_url:\s*sourceUrl/);
  assert.match(source, /transcript\.text/);
  assert.doesNotMatch(source, /transcript\.translation/);
  assert.match(source, /tiktok_apify_transcript_used/);
  assert.match(source, /TIKTOK_APIFY_FAILED/);
});

test("pipeline accepts TikTok media URLs from common Apify video scraper fields", () => {
  const source = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");

  assert.match(source, /"downloadaddr"/);
  assert.match(source, /"mediaurls"/);
  assert.match(source, /findFirstStringValue/);
});
