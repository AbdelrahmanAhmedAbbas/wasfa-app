import test from "node:test";
import assert from "node:assert/strict";

import { normalizeFeedback } from "./feedback.ts";

test("feedback trims whitespace and accepts a useful report", () => {
  assert.deepEqual(normalizeFeedback("  Missing   import  ", "  Instagram links fail   sometimes  "), {
    title: "Missing import",
    detail: "Instagram links fail sometimes",
  });
});

test("feedback rejects empty, oversized, and unhelpful reports", () => {
  assert.throws(() => normalizeFeedback(" ", "Details here"));
  assert.throws(() => normalizeFeedback("Bug", " "));
  assert.throws(() => normalizeFeedback("x".repeat(101), "Details here"));
  assert.throws(() => normalizeFeedback("Bug", "x".repeat(1001)));
});
