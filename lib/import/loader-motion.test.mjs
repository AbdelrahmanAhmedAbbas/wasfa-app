import test from "node:test";
import assert from "node:assert/strict";

import {
  LOADER_CHIPS,
  LOADER_LOOP_SECONDS,
  LOADER_SIZE,
  LOADER_SPARKS,
  LOADER_STILL_SECONDS,
  loaderBeatAt,
  loaderBodyAt,
  loaderChipAt,
  loaderPageAt,
  loaderPenAt,
  loaderRowAt,
  loaderShadowAt,
  loaderSparkAt,
} from "./loader-motion.ts";

const FRAME = 1 / 120;
const HALF = LOADER_LOOP_SECONDS / 2;

function frames() {
  const times = [];
  for (let t = 0; t <= LOADER_LOOP_SECONDS; t += FRAME) times.push(t);
  return times;
}

function assertClose(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} != ${expected}`);
}

test("the loader loop ends on the frame it starts from", () => {
  const start = loaderBodyAt(0);
  const end = loaderBodyAt(LOADER_LOOP_SECONDS);

  for (const key of ["y", "rotation", "stretchX", "stretchY"]) {
    assertClose(end[key], start[key], `body ${key}`);
  }
  for (let index = 0; index < LOADER_CHIPS; index++) {
    assert.equal(loaderChipAt(0, index, start.y).opacity, 0);
    assert.equal(loaderChipAt(LOADER_LOOP_SECONDS - FRAME, index, end.y).opacity, 0);
  }
  assert.equal(loaderPageAt(0).visible, false);
});

test("the mascot never jumps between frames, and swaps pose mid-hop", () => {
  let previous = null;

  for (const t of frames()) {
    const body = loaderBodyAt(t);
    if (previous) {
      const at = `at ${t.toFixed(3)}s`;
      assert.ok(Math.abs(body.y - previous.y) < 2, `body y ${at}`);
      assert.ok(Math.abs(body.rotation - previous.rotation) < 1, `body rotation ${at}`);
      // The crouch is released in a single frame at take-off, hence the looser bound.
      assert.ok(Math.abs(body.stretchY - previous.stretchY) < 0.08, `body stretch ${at}`);
    }
    previous = body;
  }

  assert.equal(loaderBeatAt(HALF - FRAME), 0);
  assert.equal(loaderBeatAt(HALF), 1);
  // Feet are at the top of the hop when the pose changes.
  assert.ok(loaderBodyAt(HALF).y < -15);
  assert.ok(loaderShadowAt(loaderBodyAt(HALF)).scale < 1);
});

test("chips hand over from reading to writing without moving", () => {
  for (let index = 0; index < LOADER_CHIPS; index++) {
    const before = loaderChipAt(HALF - 1e-9, index, 0);
    const after = loaderChipAt(HALF, index, 0);

    assert.equal(before.opacity, 1);
    assert.equal(after.opacity, 1);
    assert.ok(Math.abs(before.x - after.x) < 1e-3, `chip ${index} x`);
    assert.ok(Math.abs(before.y - after.y) < 1e-3, `chip ${index} y`);
    assertClose(before.scale, after.scale, `chip ${index} scale`);
  }
});

test("each chip is written down, checked off and gone by the end", () => {
  for (let index = 0; index < LOADER_CHIPS; index++) {
    assert.deepEqual(loaderRowAt(0, index), { firstLine: 0, secondLine: 0, check: 0 });

    const done = loaderRowAt(LOADER_LOOP_SECONDS - FRAME, index);
    assert.equal(done.firstLine, 1);
    assert.equal(done.secondLine, 1);
    assert.equal(done.check, 1);
  }

  // Rows fill in order.
  const midway = [0, 1, 2].map((index) => loaderRowAt(HALF + 2, index).check);
  assert.deepEqual(midway, [1, 0, 0]);
});

test("a page turns for every ingredient found, and only while reading", () => {
  let turns = 0;
  let wasVisible = false;

  for (const t of frames()) {
    const page = loaderPageAt(t);
    if (page.visible && !wasVisible) turns += 1;
    if (page.visible) assert.equal(loaderBeatAt(t), 0);
    wasVisible = page.visible;
  }

  assert.equal(turns, LOADER_CHIPS);
});

test("the pen rests while the mascot reads", () => {
  assert.deepEqual(loaderPenAt(2), { x: 0, y: 0, rotation: 0 });
  assert.notEqual(loaderPenAt(HALF + 0.8).rotation, 0);
});

test("sparks stay near the mascot and are hidden between bursts", () => {
  let shown = 0;

  for (const t of frames()) {
    for (let index = 0; index < LOADER_SPARKS; index++) {
      const spark = loaderSparkAt(t, index, 0);
      if (spark.opacity === 0) continue;
      shown += 1;
      assert.ok(spark.x > 0 && spark.x < LOADER_SIZE, `spark x at ${t.toFixed(3)}s`);
      assert.ok(spark.y > 0 && spark.y < LOADER_SIZE, `spark y at ${t.toFixed(3)}s`);
    }
  }

  assert.ok(shown > 0);
  assert.equal(loaderSparkAt(0.5, 0, 0).opacity, 0);
});

test("the reduced-motion still shows the mascot reading with chips out", () => {
  assert.equal(loaderBeatAt(LOADER_STILL_SECONDS), 0);
  assert.equal(loaderPageAt(LOADER_STILL_SECONDS).visible, false);
  for (let index = 0; index < LOADER_CHIPS; index++) {
    assert.equal(loaderChipAt(LOADER_STILL_SECONDS, index, 0).opacity, 1);
  }
});
