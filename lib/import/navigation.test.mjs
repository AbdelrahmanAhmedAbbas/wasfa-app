import test from "node:test";
import assert from "node:assert/strict";

import { shouldRedirectImportHome } from "./navigation.ts";

test("redirects import flow home once the recipe is confirmed", () => {
  assert.equal(shouldRedirectImportHome("confirmed"), true);
});

test("keeps import flow visible while it is still processing or needs attention", () => {
  assert.equal(shouldRedirectImportHome("queued"), false);
  assert.equal(shouldRedirectImportHome("processing"), false);
  assert.equal(shouldRedirectImportHome("awaiting_user_review"), false);
  assert.equal(shouldRedirectImportHome("failed"), false);
});
