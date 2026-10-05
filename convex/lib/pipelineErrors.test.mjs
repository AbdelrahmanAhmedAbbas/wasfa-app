import assert from "node:assert/strict";
import { test } from "node:test";

import { isProviderCreditError, mapPipelineError } from "./pipelineErrors.ts";

const CREDIT_REFUSALS = [
  'Error: TRANSCRIPTION_FAILED 402 {"error":{"message":"This request requires at least $0.50 in balance for audio","code":402}}',
  "Error: RECIPE_CONTENT_GENERATION_FAILED ar AI_APICallError: This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 44572.",
];

test("an out-of-credit refusal from the AI provider is recognised", () => {
  for (const refusal of CREDIT_REFUSALS) assert.equal(isProviderCreditError(refusal), true);

  assert.equal(isProviderCreditError("Error: TRANSCRIPTION_FAILED 500 upstream error"), false);
  assert.equal(isProviderCreditError("Error: TRANSCRIPTION_TIMEOUT"), false);
  // A number that merely contains 402 is not the HTTP status.
  assert.equal(isProviderCreditError("can only afford 44028 tokens for video 7500402559"), false);
});

test("an extraction that every model refused for credit reads as a service outage, not a bad link", () => {
  const mapped = mapPipelineError(`Error: OPENROUTER_EXTRACTION_FAILED ${CREDIT_REFUSALS[1]}`);
  assert.equal(mapped.code, "IMPORT_SERVICE_UNAVAILABLE");
});

test("a source with no recipe is reported as such when the video was heard or has no speech", () => {
  for (const failure of [
    "Error: RECIPE_NOT_IN_SOURCE",
    "Error: INSUFFICIENT_TEXT_CONTEXT",
    "Error: RECIPE_NOT_IN_SOURCE Generated recipe did not pass validation constraints.",
  ]) {
    assert.equal(mapPipelineError(failure).code, "RECIPE_NOT_FOUND");
  }
});

test("a missing recipe is blamed on the transcript when the video could not be listened to", () => {
  const mapped = mapPipelineError("Error: RECIPE_NOT_IN_SOURCE", { transcriptUnavailable: true });
  assert.equal(mapped.code, "TRANSCRIPTION_UNAVAILABLE");
  assert.match(mapped.message, /try again/i);
});

test("scraper failures tell the user the post could not be opened", () => {
  const cases = {
    "Error: TIKTOK_APIFY_FAILED Error: APIFY_RUN_FAILED 400 {}": "TIKTOK_APIFY_FAILED",
    "Error: APIFY_RUN_FAILED 500 boom": "APIFY_FAILED",
    "Error: APIFY_TIMEOUT": "APIFY_FAILED",
    "Error: POST_NOT_FOUND": "POST_UNAVAILABLE",
  };
  for (const [failure, code] of Object.entries(cases)) {
    const mapped = mapPipelineError(failure);
    assert.equal(mapped.code, code);
    assert.match(mapped.message, /couldn't open this post/);
  }
});

test("known rejections keep their own codes and unknown failures fall back to a generic one", () => {
  assert.equal(mapPipelineError("Error: SHORT_TOO_LONG").code, "SHORT_TOO_LONG");
  assert.equal(mapPipelineError("Error: something unexpected").code, "AI_EXTRACTION_FAILED");
});

test("no message shown to a user mentions the pipeline's internals", () => {
  for (const failure of ["Error: RECIPE_NOT_IN_SOURCE", "Error: APIFY_TIMEOUT", "Error: TIKTOK_APIFY_FAILED", "402"]) {
    assert.doesNotMatch(mapPipelineError(failure).message, /apify|schema|parser|actor|openrouter/i);
  }
});
