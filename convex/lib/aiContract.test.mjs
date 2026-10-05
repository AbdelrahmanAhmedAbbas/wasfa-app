import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("recipe extraction schemas use the new ingredient source contract", () => {
  const source = readFileSync(new URL("./ai.ts", import.meta.url), "utf8");
  const sourceEnumLines = source
    .split("\n")
    .filter((line) => line.includes("source: z.enum"));

  assert.ok(sourceEnumLines.length >= 1);
  for (const line of sourceEnumLines) {
    assert.match(line, /ai_estimate/);
    assert.doesNotMatch(line, /video_ocr/);
  }
});
