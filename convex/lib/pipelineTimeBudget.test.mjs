import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pipeline = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");
const imports = readFileSync(new URL("../imports.ts", import.meta.url), "utf8");

test("the pipeline fails a slow job long before the platform would cut it off", () => {
  const budget = pipeline.match(/const PIPELINE_TIME_BUDGET_MS = ([\d_]+);/);
  assert.ok(budget, "a time budget should be defined");
  const budgetMs = Number(budget[1].replaceAll("_", ""));
  assert.ok(budgetMs <= 300_000, "nobody should wait more than five minutes for a recipe");
  assert.ok(budgetMs < 600_000, "the budget must end before Convex's ten minute action limit");
  assert.ok(budgetMs >= 120_000, "the budget should leave normal imports room to finish");

  const wrapper = pipeline.match(/export async function runImportPipeline\([\s\S]*?\n\}\n/);
  assert.ok(wrapper, "runImportPipeline should exist");
  assert.match(wrapper[0], /Promise\.race\(\[/);
  assert.match(wrapper[0], /runPipelineSteps\(\{ \.\.\.params, budget \}\)/);
  assert.match(wrapper[0], /failJobIfStillProcessing\(/);
  assert.match(wrapper[0], /errorCode: PIPELINE_TIMED_OUT_CODE/);
  assert.match(wrapper[0], /clearTimeout\(budgetTimer\)/);
  assert.match(pipeline, /const PIPELINE_TIMED_OUT_CODE = "IMPORT_TIMED_OUT"/);
});

test("a timed-out job is only failed while it is still processing", () => {
  const helper = imports.match(/export const failJobIfProcessing = internalMutation\(\{[\s\S]*?\n\}\);/);
  assert.ok(helper, "failJobIfProcessing should exist");
  assert.match(helper[0], /status: "failed"/);
  assert.match(helper[0], /if \(!job \|\| job\.status !== "processing"\) return false;/);
});

test("steps stop at checkpoints and do not overwrite a timed-out job", () => {
  const checkpoints = pipeline.match(/throwIfOutOfTime\(params\.budget\);/g) ?? [];
  assert.ok(checkpoints.length >= 3, "expected checkpoints before extraction, content generation and saving");

  const lastCheckpoint = pipeline.lastIndexOf("throwIfOutOfTime(params.budget);");
  assert.ok(lastCheckpoint < pipeline.indexOf('stage: "save_draft"'), "a checkpoint should guard the final writes");

  assert.match(
    pipeline,
    /\} catch \(error\) \{\n\s+\/\/ Once the time budget has run out the job is already marked failed\.\n\s+if \(params\.budget\.expired\) return;/
  );
});
