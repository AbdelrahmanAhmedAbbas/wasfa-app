import test from "node:test";
import assert from "node:assert/strict";

import { getShareIntentKey, shouldRedirectImportHome, shouldRedirectShareIntent } from "./navigation.ts";

test("redirects import flow home once the recipe is confirmed", () => {
  assert.equal(shouldRedirectImportHome("confirmed"), true);
});

test("redirects import flow home when the import has failed", () => {
  assert.equal(shouldRedirectImportHome("failed"), true);
});

test("keeps import flow visible while it is still processing", () => {
  assert.equal(shouldRedirectImportHome("queued"), false);
  assert.equal(shouldRedirectImportHome("processing"), false);
  assert.equal(shouldRedirectImportHome("awaiting_user_review"), false);
});

test("dedupes share redirects by payload key instead of one global latch", () => {
  const firstIntent = { webUrl: "https://instagram.com/p/one", text: "ignored" };
  const duplicateIntent = { webUrl: "https://instagram.com/p/one" };
  const secondIntent = { text: "https://tiktok.com/@chef/video/2" };

  const firstKey = getShareIntentKey(firstIntent);
  assert.equal(firstKey, "https://instagram.com/p/one");
  assert.equal(shouldRedirectShareIntent(firstKey, null), true);
  assert.equal(shouldRedirectShareIntent(getShareIntentKey(duplicateIntent), firstKey), false);
  assert.equal(shouldRedirectShareIntent(getShareIntentKey(secondIntent), firstKey), true);
});
