import test from "node:test";
import assert from "node:assert/strict";

import {
  ImportRequestError,
  fillImportLimitMessage,
  formatTimeOfDay,
  getDailyImportLimit,
  getImportAllowanceNote,
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

test("reads the daily limit a rejected import carries", () => {
  const rejected = new ImportRequestError("Your plan allows 4 recipe imports a day.", "DAILY_IMPORT_LIMIT", {
    limit: 4,
    resets_at: 1791300000000,
  });
  assert.deepEqual(getDailyImportLimit(rejected), { limit: 4, resetsAt: 1791300000000 });

  assert.equal(getDailyImportLimit(new ImportRequestError("Slow down.", "RATE_LIMITED")), null);
  assert.equal(getDailyImportLimit(new ImportRequestError("No numbers.", "DAILY_IMPORT_LIMIT")), null);
  assert.equal(getDailyImportLimit(new Error("offline")), null);
});

test("tells the reader when the next import opens, in their own digits", () => {
  const evening = new Date(2026, 9, 6, 18, 5).getTime();
  const midnight = new Date(2026, 9, 7, 0, 30).getTime();

  assert.equal(formatTimeOfDay(evening, "en"), "6:05 PM");
  assert.equal(formatTimeOfDay(evening, "ar"), "٦:٠٥ م");
  assert.equal(formatTimeOfDay(midnight, "en"), "12:30 AM");
  assert.equal(formatTimeOfDay(midnight, "ar"), "١٢:٣٠ ص");

  assert.equal(
    fillImportLimitMessage("{count} imports used. Back at {time}.", { limit: 4, resetsAt: evening }, "en"),
    "4 imports used. Back at 6:05 PM."
  );
  assert.equal(
    fillImportLimitMessage("{count} of {limit} left", { count: 3, limit: 4 }, "ar"),
    "٣ of ٤ left"
  );
});

test("says how many imports are left today, or when the next one opens", () => {
  const templates = {
    importSheetLeftToday: "{count} of {limit} imports left today",
    importSheetNoneLeft: "No imports left today. The next one opens at {time}.",
  };
  const t = (key) => templates[key];
  const evening = new Date(2026, 9, 6, 18, 5).getTime();

  assert.equal(
    getImportAllowanceNote({ limit: 4, remaining: 3, resets_at: null }, t, "en"),
    "3 of 4 imports left today"
  );
  assert.equal(
    getImportAllowanceNote({ limit: 4, remaining: 0, resets_at: evening }, t, "en"),
    "No imports left today. The next one opens at 6:05 PM."
  );
  assert.equal(getImportAllowanceNote({ limit: 4, remaining: 4, resets_at: null }, t, "ar"), "٤ of ٤ imports left today");
});

test("says nothing about imports on a plan with no limit, or before the count is known", () => {
  const t = (key) => key;
  assert.equal(getImportAllowanceNote({ limit: null, remaining: null, resets_at: null }, t, "en"), null);
  assert.equal(getImportAllowanceNote(undefined, t, "en"), null);
  assert.equal(getImportAllowanceNote(null, t, "en"), null);
});
