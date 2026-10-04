import test from "node:test";
import assert from "node:assert/strict";

import {
  ImportRequestError,
  getImportErrorCode,
  getImportErrorTranslationKey,
  getJobFailureTranslationKey,
} from "./errors.ts";

test("maps the Shorts rejections and the time-out to localized messages", () => {
  assert.equal(getImportErrorTranslationKey("YOUTUBE_NOT_A_SHORT"), "importErrorYoutubeNotShort");
  assert.equal(getImportErrorTranslationKey("SHORT_TOO_LONG"), "importErrorShortTooLong");
  assert.equal(getImportErrorTranslationKey("IMPORT_TIMED_OUT"), "importErrorTimedOut");
});

test("maps pipeline failures to messages the app can show in Arabic", () => {
  assert.equal(getImportErrorTranslationKey("RECIPE_NOT_FOUND"), "importErrorRecipeNotFound");
  assert.equal(getImportErrorTranslationKey("TRANSCRIPTION_UNAVAILABLE"), "importErrorTranscriptUnavailable");
  assert.equal(getImportErrorTranslationKey("IMPORT_SERVICE_UNAVAILABLE"), "importErrorServiceUnavailable");
  assert.equal(getImportErrorTranslationKey("RATE_LIMITED"), "importErrorRateLimited");
  assert.equal(getImportErrorTranslationKey("UNSUPPORTED_URL"), "importErrorUnsupportedUrl");
  for (const code of ["POST_UNAVAILABLE", "APIFY_FAILED", "TIKTOK_APIFY_FAILED", "MEDIA_NOT_AVAILABLE"]) {
    assert.equal(getImportErrorTranslationKey(code), "importErrorPostUnavailable");
  }
});

test("leaves a rejection with no known code to the server's own message", () => {
  for (const code of ["AI_EXTRACTION_FAILED", "toString", "constructor", "", null, undefined]) {
    assert.equal(getImportErrorTranslationKey(code), null, `${String(code)} should not be localized`);
  }
});

test("a failed job always gets a translated message, whatever its code", () => {
  assert.equal(getJobFailureTranslationKey("RECIPE_NOT_FOUND"), "importErrorRecipeNotFound");
  for (const code of ["AI_EXTRACTION_FAILED", "PARSER_SCHEMA_FAILED", "SOMETHING_NEW", "toString", "", null, undefined]) {
    assert.equal(getJobFailureTranslationKey(code), "importErrorGeneric");
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
