import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { DAY_MS, PLANS, importAllowance } from "./plans.ts";

const NOW = Date.UTC(2026, 9, 6, 12, 0, 0);
const HOUR = 60 * 60 * 1000;
const hoursAgo = (hours, status = "confirmed") => ({ createdAt: NOW - hours * HOUR, status });

test("the free plan allows four imports a day", () => {
  assert.equal(PLANS.free.importsPerDay, 4);

  const allowance = importAllowance("free", [hoursAgo(1), hoursAgo(2)], NOW);
  assert.deepEqual(allowance, { plan: "free", limit: 4, used: 2, remaining: 2, resetsAt: null });
});

test("the fifth import is refused until the oldest one is a day old", () => {
  const imports = [hoursAgo(20), hoursAgo(10), hoursAgo(3), hoursAgo(1)];
  const allowance = importAllowance("free", imports, NOW);

  assert.equal(allowance.remaining, 0);
  assert.equal(allowance.resetsAt, NOW - 20 * HOUR + DAY_MS);
});

test("imports older than a day are free again", () => {
  const imports = [hoursAgo(30), hoursAgo(25), hoursAgo(24.5), hoursAgo(3), hoursAgo(1)];
  assert.equal(importAllowance("free", imports, NOW).remaining, 2);
});

test("a failed import does not use up the day's allowance", () => {
  const imports = [hoursAgo(5, "failed"), hoursAgo(4, "failed"), hoursAgo(3), hoursAgo(2), hoursAgo(1, "failed")];
  assert.equal(importAllowance("free", imports, NOW).remaining, 2);
});

test("an import that is still running counts", () => {
  const imports = [hoursAgo(0.1, "queued"), hoursAgo(0.1, "processing"), hoursAgo(2), hoursAgo(3, "awaiting_user_review")];
  assert.equal(importAllowance("free", imports, NOW).remaining, 0);
});

test("the premium plan has no daily limit", () => {
  const imports = Array.from({ length: 12 }, (_, index) => hoursAgo(index + 1));
  const allowance = importAllowance("premium", imports, NOW);

  assert.equal(allowance.limit, null);
  assert.equal(allowance.remaining, null);
  assert.equal(allowance.resetsAt, null);
});

test("the daily limit is enforced where the import job is recorded", () => {
  const source = readFileSync(new URL("../imports.ts", import.meta.url), "utf8");
  const start = source.match(/export const start = internalMutation\(\{[\s\S]*?\n\}\);/);
  assert.ok(start);

  // Sending a link that is already importing returns that import, even at the limit.
  assert.ok(
    start[0].indexOf("deduplicated: true") < start[0].indexOf('refused: "daily"'),
    "a repeated link must be recognised before the daily limit is checked"
  );
  assert.ok(
    start[0].indexOf('refused: "daily"') < start[0].indexOf('ctx.db.insert("import_jobs"'),
    "the limit must be checked before the job is recorded"
  );
  // The clock is the server's; the app cannot move it.
  assert.doesNotMatch(start[0].match(/args: \{[\s\S]*?\n  \},/)[0], /now/);
});
