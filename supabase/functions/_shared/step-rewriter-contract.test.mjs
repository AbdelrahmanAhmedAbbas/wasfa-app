import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("pipeline rewrites procedural steps in English and Arabic with telemetry", () => {
  const pipeline = readFileSync(new URL("./pipeline.ts", import.meta.url), "utf8");
  const rewriter = readFileSync(new URL("./step-rewriter.ts", import.meta.url), "utf8");

  assert.match(rewriter, /STEP_REWRITER_MODEL/);
  assert.match(rewriter, /ingredients_used/);
  assert.match(rewriter, /linkStepIngredients/);

  assert.match(pipeline, /rewriteStepsForLanguage/);
  assert.match(pipeline, /rewriteStepsForLanguage\([^)]*,\s*"en"/s);
  assert.match(pipeline, /rewriteStepsForLanguage\([^)]*,\s*"ar"/s);
  assert.match(pipeline, /stage:\s*"step_rewrite"/);
  assert.match(pipeline, /localized:\s*{/);
  assert.match(pipeline, /step_rewrite_models/);
});
