import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { normalizeSourceUrlForCache } from "./cache.ts";
import {
  YOUTUBE_SHORT_READ_PROMPT,
  buildYouTubeActorInput,
  buildYouTubeShortReadRequest,
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
  assert.match(fetcher, /body: buildYouTubeActorInput\(sourceUrl\)/);
  assert.match(fetcher, /APIFY_TOKEN_MISSING"\)\) throw error/);
  assert.deepEqual(buildYouTubeActorInput(expected.source_url), {
    startUrls: [{ url: "https://www.youtube.com/watch?v=abcDEF12345" }],
    maxResults: 1,
    maxResultsShorts: 1,
    maxResultStreams: 0,
  });
  assert.match(fetcher, /thumbnailUrl: fallbackThumbnailUrl/);

  const parser = functionBody(pipeline, "parseYouTubeApifyMetadata");
  assert.match(parser, /parseDurationSeconds\(record\.duration\)/);
  assert.match(parser, /asString\(record\.text\)/);
});

test("a Short over three minutes is rejected before the video is read", () => {
  const durationCheck = pipeline.indexOf('throw new Error("SHORT_TOO_LONG")');
  const videoRead = pipeline.indexOf("await readYouTubeShort(");
  assert.notEqual(durationCheck, -1);
  assert.notEqual(videoRead, -1);
  assert.ok(durationCheck < videoRead, "the duration check must come before the paid video read");

  assert.match(pipeline, /metadata\.videoDurationSeconds > SHORT_MAX_DURATION_SECONDS/);
  assert.match(pipeline, /typeof metadata\.videoDurationSeconds === "number" &&/);
  assert.match(pipeline, new RegExp(`code:\\s*"${expected.rejections.too_long.error_code}"`));
});

test("a Short is read from its link by Gemini on AI Studio, never downloaded", () => {
  const branch = pipeline.match(
    /\} else if \(params\.job\.source_platform === "youtube"\) \{([\s\S]*?)\n    \} else \{/
  );
  assert.ok(branch, "the Shorts branch should sit between the transcript branch and the download branch");
  assert.match(branch[1], /readYouTubeShort\(params\.job\.source_url\)/);
  assert.match(branch[1], /stage:\s*"youtube_short_read"/);
  assert.match(branch[1], /stage:\s*"youtube_short_read_failed"/);
  assert.doesNotMatch(branch[1], /downloadMediaForTranscription|transcribeWithOpenRouter|openrouter_transcribe/);

  const reader = functionBody(pipeline, "readYouTubeShort");
  assert.match(reader, /JSON\.stringify\(buildYouTubeShortReadRequest\(sourceUrl\)\)/);
  assert.match(reader, /YOUTUBE_SHORT_UNREADABLE/);

  const request = buildYouTubeShortReadRequest(expected.source_url);
  assert.equal(request.model, "google/gemini-3-flash-preview");
  assert.deepEqual(request.provider, { only: ["google-ai-studio"] });
  assert.deepEqual(request.messages[0].content[1], {
    type: "video_url",
    video_url: { url: "https://www.youtube.com/watch?v=abcDEF12345" },
  });
  assert.match(YOUTUBE_SHORT_READ_PROMPT, /Spoken:/);
  assert.match(YOUTUBE_SHORT_READ_PROMPT, /On-screen text:/);
  assert.match(YOUTUBE_SHORT_READ_PROMPT, /VIDEO_UNAVAILABLE/);
});

test("the extraction schema and the fixture accept youtube as a platform", () => {
  assert.match(ai, /platform: z\.enum\(\["instagram", "tiktok", "youtube", "unknown"\]\)/);

  assert.equal(expected.status, "confirmed");
  assert.equal(expected.source_platform, "youtube");
  assert.ok(expected.events.some((event) => event.stage === "youtube_short_read"));
  assert.ok(!expected.events.some((event) => event.stage === "openrouter_transcribe"));
  assert.ok(expected.recipe.ingredients.every((ingredient) => typeof ingredient.is_estimated === "boolean"));
  assert.ok(expected.recipe.localized.en.steps.length > 0);
  assert.ok(expected.recipe.localized.ar.steps.length > 0);
});
