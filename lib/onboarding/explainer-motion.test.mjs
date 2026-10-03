import test from "node:test";
import assert from "node:assert/strict";

import {
  chipAt,
  EXPLAINER_LOOP_SECONDS,
  EXPLAINER_SHARE_TAP,
  EXPLAINER_STILL_SECONDS,
  MASCOT_POSE,
  mascotAt,
  pillAt,
  recipeCardAt,
  recipeLineAt,
  scanAt,
  shareSheetAt,
  tapAt,
  videoCardAt,
} from "./explainer-motion.ts";

const OFFSCREEN_X = 460;
const FRAME = 1 / 120;

function frames() {
  const times = [];
  for (let T = 0; T <= EXPLAINER_LOOP_SECONDS; T += FRAME) times.push(T);
  return times;
}

function assertClose(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} != ${expected}`);
}

test("the explainer loop ends on the frame it starts from", () => {
  const start = {
    video: videoCardAt(0),
    sheet: shareSheetAt(0),
    scan: scanAt(0),
    pill: pillAt(0),
    recipe: recipeCardAt(0),
    mascot: mascotAt(0, OFFSCREEN_X),
  };
  const end = {
    video: videoCardAt(EXPLAINER_LOOP_SECONDS),
    sheet: shareSheetAt(EXPLAINER_LOOP_SECONDS),
    scan: scanAt(EXPLAINER_LOOP_SECONDS),
    pill: pillAt(EXPLAINER_LOOP_SECONDS),
    recipe: recipeCardAt(EXPLAINER_LOOP_SECONDS),
    mascot: mascotAt(EXPLAINER_LOOP_SECONDS, OFFSCREEN_X),
  };

  for (const key of ["scale", "opacity", "zoom", "progress", "sharePress"]) {
    assertClose(end.video[key], start.video[key], `video ${key}`);
  }
  for (const key of ["x", "y", "rotation", "scale", "stretchX", "stretchY", "pose"]) {
    assertClose(end.mascot[key], start.mascot[key], `mascot ${key}`);
  }
  assert.equal(end.mascot.behindCard, start.mascot.behindCard);
  assert.equal(start.mascot.x, OFFSCREEN_X);

  // Everything that only appears mid-loop is hidden at both ends.
  for (const state of [start, end]) {
    assert.equal(state.sheet.open, 0);
    assert.equal(state.scan.opacity, 0);
    assert.equal(state.pill.opacity, 0);
    assert.equal(state.recipe.opacity, 0);
  }
  for (const index of [0, 1, 2]) {
    assert.equal(chipAt(0, index).opacity, 0);
    assert.equal(chipAt(EXPLAINER_LOOP_SECONDS, index).opacity, 0);
  }
  assert.equal(tapAt(0, EXPLAINER_SHARE_TAP.at).opacity, 0);
  assert.equal(tapAt(EXPLAINER_LOOP_SECONDS, EXPLAINER_SHARE_TAP.at).rippleOpacity, 0);
});

test("the explainer never jumps between frames", () => {
  let previous = null;

  for (const T of frames()) {
    const current = {
      mascot: mascotAt(T, OFFSCREEN_X),
      video: videoCardAt(T),
      recipe: recipeCardAt(T),
      sheet: shareSheetAt(T),
    };

    if (previous) {
      const at = `at ${T.toFixed(3)}s`;
      assert.ok(Math.abs(current.mascot.x - previous.mascot.x) < 30, `mascot x ${at}`);
      assert.ok(Math.abs(current.mascot.y - previous.mascot.y) < 30, `mascot y ${at}`);
      assert.ok(Math.abs(current.mascot.scale - previous.mascot.scale) < 0.03, `mascot scale ${at}`);
      assert.ok(Math.abs(current.video.opacity - previous.video.opacity) < 0.08, `video opacity ${at}`);
      assert.ok(Math.abs(current.video.sharePress - previous.video.sharePress) < 0.05, `share press ${at}`);
      assert.ok(Math.abs(current.recipe.opacity - previous.recipe.opacity) < 0.08, `recipe opacity ${at}`);
      assert.ok(Math.abs(current.sheet.open - previous.sheet.open) < 0.15, `sheet ${at}`);
    }
    previous = current;
  }
});

test("the mascot reads, then writes, then hides behind the saved recipe", () => {
  assert.equal(mascotAt(6, OFFSCREEN_X).pose, MASCOT_POSE.reading);
  assert.equal(mascotAt(7, OFFSCREEN_X).pose, MASCOT_POSE.typing);
  assert.equal(mascotAt(7, OFFSCREEN_X).behindCard, false);

  const perched = mascotAt(10, OFFSCREEN_X);
  assert.equal(perched.pose, MASCOT_POSE.base);
  assert.equal(perched.behindCard, true);
});

test("extraction cycles through the four stage labels in order", () => {
  const seen = [];
  for (const T of frames()) {
    const pill = pillAt(T);
    if (pill.opacity > 0 && seen[seen.length - 1] !== pill.index) seen.push(pill.index);
  }

  assert.deepEqual(seen, [0, 1, 2, 3]);
});

test("the reduced-motion still shows the finished recipe", () => {
  const T = EXPLAINER_STILL_SECONDS;

  assert.equal(recipeCardAt(T).opacity, 1);
  assert.equal(recipeCardAt(T).y, 0);
  assert.equal(videoCardAt(T).opacity, 0);
  assert.equal(shareSheetAt(T).open, 0);
  for (const index of [0, 1, 2, 3, 4]) {
    assert.equal(recipeLineAt(T, index).opacity, 1);
  }
});
