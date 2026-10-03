import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SHORT_MAX_DURATION_SECONDS,
  canonicalYouTubeShortUrl,
  isYouTubeUrl,
  parseDurationSeconds,
  parseYouTubeShortId,
  youTubeThumbnailUrl,
  youTubeWatchUrl,
} from "./youtube.ts";

test("recognises Short links on the accepted YouTube hosts", () => {
  for (const url of [
    "https://youtube.com/shorts/abcDEF12345",
    "https://www.youtube.com/shorts/abcDEF12345",
    "https://m.youtube.com/shorts/abcDEF12345",
    "https://WWW.YouTube.com/shorts/abcDEF12345/",
    "http://youtube.com/shorts/abcDEF12345?si=XyZ123&feature=share",
    "https://youtube.com/shorts/a-c_EF12345#t=3",
  ]) {
    assert.ok(parseYouTubeShortId(url), `${url} should be a Short`);
  }
  assert.equal(parseYouTubeShortId("https://youtube.com/shorts/abcDEF12345?si=XyZ"), "abcDEF12345");
});

test("rejects YouTube links that are not Shorts", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=abcDEF12345",
    "https://youtu.be/abcDEF12345",
    "https://music.youtube.com/shorts/abcDEF12345",
    "https://www.youtube-nocookie.com/shorts/abcDEF12345",
    "https://www.youtube.com/shorts/abcDEF12345/extra",
    "https://www.youtube.com/shorts/",
    "https://www.youtube.com/shorts/short",
    "https://www.youtube.com/shorts/abcDEF12345678",
    "https://www.youtube.com/embed/abcDEF12345",
    "https://www.youtube.com/@chef/shorts",
    "https://notyoutube.com/shorts/abcDEF12345",
    "not a url",
  ]) {
    assert.equal(parseYouTubeShortId(url), null, `${url} should not be a Short`);
  }
});

test("identifies YouTube-owned links so non-Shorts get the Shorts-only rejection", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=abcDEF12345",
    "https://youtu.be/abcDEF12345",
    "https://music.youtube.com/watch?v=abcDEF12345",
    "https://www.youtube-nocookie.com/embed/abcDEF12345",
    "https://m.youtube.com/shorts/abcDEF12345",
  ]) {
    assert.equal(isYouTubeUrl(url), true, `${url} is a YouTube link`);
  }
  for (const url of [
    "https://www.instagram.com/reel/ABC123/",
    "https://www.tiktok.com/@chef/video/777",
    "https://notyoutube.com/shorts/abcDEF12345",
    "https://youtube.com.evil.example/shorts/abcDEF12345",
    "not a url",
  ]) {
    assert.equal(isYouTubeUrl(url), false, `${url} is not a YouTube link`);
  }
});

test("builds one canonical link, a watch link and a thumbnail from a Short id", () => {
  assert.equal(canonicalYouTubeShortUrl("abcDEF12345"), "https://www.youtube.com/shorts/abcDEF12345");
  assert.equal(youTubeWatchUrl("abcDEF12345"), "https://www.youtube.com/watch?v=abcDEF12345");
  assert.equal(youTubeThumbnailUrl("abcDEF12345"), "https://i.ytimg.com/vi/abcDEF12345/hqdefault.jpg");

  const variants = [
    "https://youtube.com/shorts/abcDEF12345?si=one",
    "https://m.youtube.com/shorts/abcDEF12345/",
    "http://www.youtube.com/shorts/abcDEF12345?feature=share&utm_source=x",
  ].map((url) => canonicalYouTubeShortUrl(parseYouTubeShortId(url)));
  assert.deepEqual(new Set(variants).size, 1);
});

test("parses scraper durations into seconds", () => {
  assert.equal(parseDurationSeconds("00:03:17"), 197);
  assert.equal(parseDurationSeconds("00:00:45"), 45);
  assert.equal(parseDurationSeconds("3:00"), 180);
  assert.equal(parseDurationSeconds("59"), 59);
  assert.equal(parseDurationSeconds("01:02:03"), 3723);
  assert.equal(parseDurationSeconds("PT1M5S"), 65);
  assert.equal(parseDurationSeconds("PT3M"), 180);
  assert.equal(parseDurationSeconds("PT1H"), 3600);
  assert.equal(parseDurationSeconds(42), 42);
  assert.equal(parseDurationSeconds(0), 0);
});

test("treats unreadable durations as missing rather than zero", () => {
  for (const value of ["", "  ", "live", "PT", "1:2:3:4", "-5", -5, Number.NaN, null, undefined, {}, []]) {
    assert.equal(parseDurationSeconds(value), undefined, `${JSON.stringify(value)} should be missing`);
  }
});

test("a Short of exactly three minutes is within the limit", () => {
  assert.equal(SHORT_MAX_DURATION_SECONDS, 180);
  assert.ok(parseDurationSeconds("00:03:00") <= SHORT_MAX_DURATION_SECONDS);
  assert.ok(parseDurationSeconds("00:03:01") > SHORT_MAX_DURATION_SECONDS);
});
