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
