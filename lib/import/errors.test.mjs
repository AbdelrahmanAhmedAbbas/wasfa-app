import test from "node:test";
import assert from "node:assert/strict";

import { ImportRequestError, getImportErrorCode, getImportErrorTranslationKey } from "./errors.ts";

test("maps the Shorts rejections and the time-out to localized messages", () => {
  assert.equal(getImportErrorTranslationKey("YOUTUBE_NOT_A_SHORT"), "importErrorYoutubeNotShort");
  assert.equal(getImportErrorTranslationKey("SHORT_TOO_LONG"), "importErrorShortTooLong");
  assert.equal(getImportErrorTranslationKey("IMPORT_TIMED_OUT"), "importErrorTimedOut");
});

test("leaves every other failure to the server's own message", () => {
  for (const code of ["APIFY_FAILED", "AI_EXTRACTION_FAILED", "toString", "constructor", "", null, undefined]) {
    assert.equal(getImportErrorTranslationKey(code), null, `${String(code)} should not be localized`);
  }
});

test("reads the code from a rejected import request only", () => {
  const rejected = new ImportRequestError("Only YouTube Shorts can be imported.", "YOUTUBE_NOT_A_SHORT");
  assert.equal(rejected.message, "Only YouTube Shorts can be imported.");
  assert.ok(rejected instanceof Error);
  assert.equal(getImportErrorCode(rejected), "YOUTUBE_NOT_A_SHORT");

  assert.equal(getImportErrorCode(new ImportRequestError("Rate limit reached.")), null);
  assert.equal(getImportErrorCode(new Error("Network request failed")), null);
  assert.equal(getImportErrorCode("boom"), null);
});
