import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { normalizeSourceUrlForCache } from "./cache.ts";
import {
  YOUTUBE_AUDIO_MAX_CHARGE_USD,
  buildYouTubeActorInput,
  buildYouTubeAudioActorInput,
  canonicalYouTubeShortUrl,
  parseYouTubeShortId,
  youTubeThumbnailUrl,
} from "./youtube.ts";

const pipeline = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");
const handler = readFileSync(new URL("./create-handler.ts", import.meta.url), "utf8");
const ai = readFileSync(new URL("./ai.ts", import.meta.url), "utf8");
const expected = JSON.parse(
  readFileSync(new URL("./fixtures/youtube-short-kabsa.expected.json", import.meta.url), "utf8")
);

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = source.indexOf("\n}\n", start);
  return source.slice(start, next);
}

test("a Short is stored and cached under one link whatever form was shared", () => {
  const shortId = parseYouTubeShortId(expected.submitted_url);
  assert.equal(canonicalYouTubeShortUrl(shortId), expected.source_url);
  assert.equal(normalizeSourceUrlForCache(expected.source_url), expected.normalized_source_url);
  assert.equal(normalizeSourceUrlForCache(expected.submitted_url), expected.normalized_source_url);
  assert.equal(youTubeThumbnailUrl(shortId), expected.source_thumbnail_url);

  assert.match(handler, /canonicalYouTubeShortUrl\(submittedShortId\)/);
  assert.match(handler, /sourceUrl:\s*normalizedUrl/);
});

test("a YouTube link that is not a Short is rejected with a code before any job exists", () => {
  const rejection = handler.match(/if \(isYouTubeUrl\(submittedUrl\) && !submittedShortId\) \{([\s\S]*?)\n  \}/);
  assert.ok(rejection, "handler should reject non-Short YouTube links");
  assert.match(rejection[1], new RegExp(`code:\\s*"${expected.rejections.not_a_short.code}"`));
  assert.match(rejection[1], new RegExp(`${expected.rejections.not_a_short.http_status}`));

  assert.ok(
    handler.indexOf("isYouTubeUrl(submittedUrl) && !submittedShortId") < handler.indexOf("enforceRateLimit("),
    "the Shorts-only rejection should not count against the rate limit or create a job"
  );
  assert.ok(handler.indexOf("YOUTUBE_NOT_A_SHORT") < handler.indexOf("createImportJob(adminClient"));
});

test("YouTube metadata comes from its own Apify actor and a failed scrape does not fail the import", () => {
  assert.match(pipeline, /APIFY_ACTOR_YOUTUBE/);
  assert.match(pipeline, /if \(params\.sourcePlatform === "youtube"\) return fetchYouTubeViaApify\(params\.sourceUrl\)/);

  const fetcher = functionBody(pipeline, "fetchYouTubeViaApify");
  const details = functionBody(pipeline, "fetchYouTubeDetailsViaApify");
  assert.match(details, /body: buildYouTubeActorInput\(sourceUrl\)/);
  assert.match(details, /APIFY_TOKEN_MISSING"\)\) throw error/);
  assert.match(details, /return \{\};/);
  assert.deepEqual(buildYouTubeActorInput(expected.source_url), {
    startUrls: [{ url: "https://www.youtube.com/watch?v=abcDEF12345" }],
    maxResults: 1,
    maxResultsShorts: 1,
    maxResultStreams: 0,
  });
  assert.match(fetcher, /thumbnailUrl: details\.thumbnailUrl \?\? fallbackThumbnailUrl/);

  const parser = functionBody(pipeline, "parseYouTubeApifyMetadata");
  assert.match(parser, /parseDurationSeconds\(record\.duration\)/);
  assert.match(parser, /asString\(record\.text\)/);
});

test("a Short over three minutes is rejected before its audio is transcribed", () => {
  const durationCheck = pipeline.indexOf('throw new Error("SHORT_TOO_LONG")');
  const transcription = pipeline.indexOf("await transcribeWithOpenRouter(media)");
  assert.notEqual(durationCheck, -1);
  assert.notEqual(transcription, -1);
  assert.ok(durationCheck < transcription, "the duration check must come before the transcription");

  assert.match(pipeline, /metadata\.videoDurationSeconds > SHORT_MAX_DURATION_SECONDS/);
  assert.match(pipeline, /typeof metadata\.videoDurationSeconds === "number" &&/);
  assert.match(pipeline, new RegExp(`code:\\s*"${expected.rejections.too_long.error_code}"`));
});

test("a Short's audio is downloaded by its own Apify actor and transcribed like an Instagram reel", () => {
  assert.doesNotMatch(pipeline, /readYouTubeShort|youtube_short_read|video_url/);
  assert.doesNotMatch(pipeline, /source_platform === "youtube"\) \{\s*try/);

  const fetcher = functionBody(pipeline, "fetchYouTubeViaApify");
  assert.match(fetcher, /Promise\.all\(\[\s*fetchYouTubeDetailsViaApify\(sourceUrl\),\s*fetchYouTubeAudioViaApify\(sourceUrl\),/);

  const audio = functionBody(pipeline, "fetchYouTubeAudioViaApify");
  assert.match(audio, /APIFY_ACTOR_YOUTUBE_AUDIO/);
  assert.match(audio, /body: buildYouTubeAudioActorInput\(sourceUrl\)/);
  assert.match(audio, /maxTotalChargeUsd: YOUTUBE_AUDIO_MAX_CHARGE_USD/);
  assert.match(audio, /sanitizeHttpUrl\(record\?\.downloadUrl\)/);
  assert.match(audio, /APIFY_TOKEN_MISSING"\)\) throw error/);
  assert.match(audio, /return \{ mediaError:/);

  assert.deepEqual(buildYouTubeAudioActorInput(expected.source_url), {
    urls: [{ url: "https://www.youtube.com/watch?v=abcDEF12345" }],
    format: "mp3",
    residentialProxyMode: "disabled",
  });
  assert.ok(YOUTUBE_AUDIO_MAX_CHARGE_USD <= 0.05);
  assert.match(pipeline, /&maxTotalChargeUsd=\$\{params\.maxTotalChargeUsd\}/);
});

test("the extraction schema and the fixture accept youtube as a platform", () => {
  assert.match(ai, /platform: z\.enum\(\["instagram", "tiktok", "youtube", "unknown"\]\)/);

  assert.equal(expected.status, "confirmed");
  assert.equal(expected.source_platform, "youtube");
  assert.ok(expected.events.some((event) => event.stage === "openrouter_transcribe"));
  assert.ok(!expected.events.some((event) => event.stage === "youtube_short_read"));
  assert.ok(expected.recipe.ingredients.every((ingredient) => typeof ingredient.is_estimated === "boolean"));
  assert.ok(expected.recipe.localized.en.steps.length > 0);
  assert.ok(expected.recipe.localized.ar.steps.length > 0);
});
