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
  assert.equal(source.match(/await transcribeSourceMedia\(metadata, params\.budget,/g)?.length, 1);
});

test("pipeline accepts TikTok media URLs from common Apify video scraper fields", () => {
  const source = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");

  assert.match(source, /"downloadaddr"/);
  assert.match(source, /"mediaurls"/);
  assert.match(source, /findFirstStringValue/);
});

test("transcription sends the audio track first and falls back to a second model", () => {
  const source = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");

  assert.match(source, /extractAacFromMp4\(media\.buffer\)/);
  assert.match(source, /OPENROUTER_TRANSCRIBE_MODELS = \["google\/gemini-3-flash-preview", "google\/gemini-2\.5-flash"\]/);
  assert.match(source, /max_tokens: TRANSCRIBE_MAX_TOKENS/);
  // Out of credit: another model or a smaller upload cannot help, so the attempts stop.
  assert.match(source, /if \(isProviderCreditError\(error\)\) break;/);
});

test("a recipe built without a transcript we failed to get is not written to the shared cache", () => {
  const source = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");

  assert.match(source, /transcriptUnavailable = transcription\.reason === "unavailable"/);
  assert.match(source, /if \(!transcriptUnavailable\) \{\s*await params\.store\.upsertExtractionCache\(/);
  assert.match(source, /mapPipelineError\(error, \{ transcriptUnavailable \}\)/);
});

test("every AI request caps its output so a low balance cannot refuse it outright", () => {
  const ai = readFileSync(new URL("./ai.ts", import.meta.url), "utf8");

  const calls = ai.match(/generateObject\(\{[\s\S]*?abortSignal,?\s*\}\)/g) ?? [];
  assert.ok(calls.length >= 6);
  for (const call of calls) assert.match(call, /maxTokens: (RECIPE|DETAIL)_MAX_TOKENS/);
});

test("extraction refuses to invent a recipe the source does not contain", () => {
  const ai = readFileSync(new URL("./ai.ts", import.meta.url), "utf8");

  assert.match(ai, /recipe_in_source: z\.boolean\(\)\.nullable\(\)\.optional\(\)/);
  assert.match(ai, /if \(object\.recipe_in_source === false\) throw new Error\("RECIPE_NOT_IN_SOURCE"\)/);
  assert.match(ai, /Never add an ingredient from general knowledge of the dish/);
});
