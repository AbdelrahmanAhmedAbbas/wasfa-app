import test from "node:test";
import assert from "node:assert/strict";

import { getGuideSlideAfterSwipe, getImportGuidePlatformLink, getImportGuideSlides } from "./guide.ts";

const PLATFORMS = ["tiktok", "instagram", "youtube"];

test("every platform's guide walks from the video to the saved recipe", () => {
  for (const platform of PLATFORMS) {
    for (const os of ["ios", "android"]) {
      const scenes = getImportGuideSlides(platform, os).map((slide) => slide.scene);
      assert.deepEqual(scenes, ["video", "sharePanel", "systemSheet", "recipe"], `${platform} on ${os}`);
    }
  }
});

test("the step for finding Wasfa in the share sheet is worded for the phone in hand", () => {
  const bodyOn = (os) => getImportGuideSlides("tiktok", os).find((slide) => slide.scene === "systemSheet").bodyKey;
  assert.equal(bodyOn("ios"), "importGuidePickWasfaBodyIos");
  assert.equal(bodyOn("android"), "importGuidePickWasfaBodyAndroid");
});

test("every platform opens through a web address", () => {
  for (const platform of PLATFORMS) {
    assert.match(getImportGuidePlatformLink(platform), /^https:\/\/www\./, platform);
  }
});

test("in English dragging left turns to the next slide and dragging right goes back", () => {
  const swipe = { isRTL: false, index: 1, total: 4 };
  assert.equal(getGuideSlideAfterSwipe({ ...swipe, dx: -80 }), 2);
  assert.equal(getGuideSlideAfterSwipe({ ...swipe, dx: 80 }), 0);
});

test("in Arabic the drag directions swap", () => {
  const swipe = { isRTL: true, index: 1, total: 4 };
  assert.equal(getGuideSlideAfterSwipe({ ...swipe, dx: 80 }), 2);
  assert.equal(getGuideSlideAfterSwipe({ ...swipe, dx: -80 }), 0);
});

test("a short drag, or one past either end, stays on the slide", () => {
  assert.equal(getGuideSlideAfterSwipe({ dx: -20, isRTL: false, index: 1, total: 4 }), 1);
  assert.equal(getGuideSlideAfterSwipe({ dx: 80, isRTL: false, index: 0, total: 4 }), 0);
  assert.equal(getGuideSlideAfterSwipe({ dx: -80, isRTL: false, index: 3, total: 4 }), 3);
});
