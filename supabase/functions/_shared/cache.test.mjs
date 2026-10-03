import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeSourceUrlForCache } from "./cache.ts";

test("normalizes social source URLs for extraction cache keys", () => {
  assert.equal(
    normalizeSourceUrlForCache("https://www.instagram.com/reel/ABC123/?utm_source=ig_web_copy_link&igsh=abc#caption"),
    "https://instagram.com/reel/ABC123"
  );
  assert.equal(
    normalizeSourceUrlForCache("https://m.tiktok.com/v/12345/?utm_campaign=test&share_item_id=999"),
    "https://tiktok.com/v/12345"
  );
  assert.equal(
    normalizeSourceUrlForCache("HTTPS://WWW.TIKTOK.COM/@chef/video/777/?lang=en"),
    "https://tiktok.com/@chef/video/777"
  );
});

test("every form of a YouTube Short link shares one cache key", () => {
  const variants = [
    "https://www.youtube.com/shorts/abcDEF12345",
    "https://youtube.com/shorts/abcDEF12345?si=XyZ123",
    "https://m.youtube.com/shorts/abcDEF12345/?feature=share",
    "http://WWW.YOUTUBE.COM/shorts/abcDEF12345?utm_source=whatsapp&si=abc#t=2",
  ];

  for (const url of variants) {
    assert.equal(normalizeSourceUrlForCache(url), "https://youtube.com/shorts/abcDEF12345");
  }
});
