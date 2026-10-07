import test from "node:test";
import assert from "node:assert/strict";

import { getCookStepAfterTap } from "./cook-mode.ts";

const screenWidth = 390;

test("in English a tap on the right goes forward and a tap on the left goes back", () => {
  const tap = { screenWidth, isRTL: false, index: 2, total: 5 };
  assert.equal(getCookStepAfterTap({ ...tap, x: 300 }), 3);
  assert.equal(getCookStepAfterTap({ ...tap, x: 90 }), 1);
});

test("in Arabic the sides swap: left goes forward, right goes back", () => {
  const tap = { screenWidth, isRTL: true, index: 2, total: 5 };
  assert.equal(getCookStepAfterTap({ ...tap, x: 90 }), 3);
  assert.equal(getCookStepAfterTap({ ...tap, x: 300 }), 1);
});

test("a tap past the first or last step stays on it", () => {
  assert.equal(getCookStepAfterTap({ x: 90, screenWidth, isRTL: false, index: 0, total: 5 }), 0);
  assert.equal(getCookStepAfterTap({ x: 300, screenWidth, isRTL: false, index: 4, total: 5 }), 4);
  assert.equal(getCookStepAfterTap({ x: 90, screenWidth, isRTL: true, index: 4, total: 5 }), 4);
  assert.equal(getCookStepAfterTap({ x: 300, screenWidth, isRTL: true, index: 0, total: 5 }), 0);
  assert.equal(getCookStepAfterTap({ x: 300, screenWidth, isRTL: false, index: 0, total: 1 }), 0);
});
