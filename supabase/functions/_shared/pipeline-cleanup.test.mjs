import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("import pipeline no longer contains OpenGraph, oEmbed, or visual OCR hooks", () => {
  const pipeline = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");
  const ai = readFileSync(new URL("./ai.ts", import.meta.url), "utf8");

  for (const removed of [
    "fetchOEmbedMetadata",
    "fetchOpenGraphMetadata",
    "fetchSourceMetadata",
    "extractVisualRecipeText",
    "VisualRecipeTextResult",
    "MAX_VISUAL_OCR_UPLOAD_BYTES",
    "openrouter_video_ocr",
    "video_ocr_",
    "visualOcr",
    "Video OCR",
  ]) {
    assert.doesNotMatch(pipeline, new RegExp(removed, "i"), `${removed} should be removed from pipeline.ts`);
  }

  assert.doesNotMatch(ai, /extractVisualRecipeText/);
  assert.doesNotMatch(ai, /visualRecipeTextSchema/);
});
