import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("pipeline records non-blocking sanity check telemetry and confidence", () => {
  const pipeline = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");
  const sanityCheck = readFileSync(new URL("./sanityCheck.ts", import.meta.url), "utf8");

  assert.match(sanityCheck, /SANITY_CHECK_MODEL\s*=\s*"anthropic\/claude-haiku-4\.5"/);
  assert.match(sanityCheck, /catch\s*{/);
  assert.match(sanityCheck, /sanity_check_unavailable/);

  assert.match(pipeline, /runSanityCheck/);
  assert.match(pipeline, /stage:\s*"sanity_check"/);
  assert.match(pipeline, /passed:\s*sanityCheck\.passed/);
  assert.match(pipeline, /issue_count:\s*sanityCheck\.issues\.length/);
  assert.match(pipeline, /issues:\s*sanityCheck\.issues/);
  assert.match(pipeline, /sanity_check:\s*{\s*passed:\s*sanityCheck\.passed,\s*issue_count:\s*sanityCheck\.issues\.length/s);
});
