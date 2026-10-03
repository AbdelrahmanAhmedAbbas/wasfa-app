import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("pipeline uses platform-specific Apify actors and downloads the TikTok video", () => {
  const source = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");

  assert.match(source, /APIFY_ACTOR_INSTAGRAM/);
  assert.match(source, /APIFY_ACTOR_TIKTOK/);
  assert.doesNotMatch(source, /APIFY_ACTOR_ID/);
  assert.match(source, /fetchInstagramViaApify/);
  assert.match(source, /fetchTikTokViaApify/);
  assert.match(source, /source_platform/);
  assert.match(source, /DEFAULT_APIFY_ACTOR_TIKTOK = "clockworks~tiktok-scraper"/);
  assert.match(source, /postURLs:\s*\[sourceUrl\]/);
  assert.match(source, /shouldDownloadVideos:\s*true/);
  assert.match(source, /downloadSubtitlesOptions:\s*"NEVER_DOWNLOAD_SUBTITLES"/);
  assert.match(source, /asStringArray\(record\?\.mediaUrls\)\?\.\[0\]/);
  assert.match(source, /TIKTOK_APIFY_FAILED/);
});

test("no platform skips the download and transcription steps", () => {
  const source = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /metadata\.transcript/);
  assert.doesNotMatch(source, /tiktok_apify_transcript_used/);
  assert.doesNotMatch(source, /translate:\s*"english"/);
  assert.doesNotMatch(source, /youtube_short_read/);
  assert.equal(source.match(/await downloadMediaForTranscription\(metadata\)/g)?.length, 1);
  assert.equal(source.match(/await transcribeWithOpenRouter\(media\)/g)?.length, 1);
});

test("pipeline accepts TikTok media URLs from common Apify video scraper fields", () => {
  const source = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");

  assert.match(source, /"downloadaddr"/);
  assert.match(source, /"mediaurls"/);
  assert.match(source, /findFirstStringValue/);
});
