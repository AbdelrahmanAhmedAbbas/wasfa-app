import test from "node:test";
import assert from "node:assert/strict";

import { getFinishedImportJobId, getNotificationTarget } from "./targets.ts";

test("a finished import opens its recipe", () => {
  assert.deepEqual(getNotificationTarget({ type: "import_finished", jobId: "j1", recipeId: "r1" }), {
    kind: "recipe",
    recipeId: "r1",
  });
});

test("a failed import opens the library", () => {
  assert.deepEqual(getNotificationTarget({ type: "import_finished", jobId: "j1", recipeId: null }), { kind: "home" });
});

test("a reminder opens the planner", () => {
  assert.deepEqual(getNotificationTarget({ type: "daily_reminder" }), { kind: "planner" });
});

test("anything else opens the library", () => {
  assert.deepEqual(getNotificationTarget(undefined), { kind: "home" });
  assert.deepEqual(getNotificationTarget({ type: "something_new" }), { kind: "home" });
});

test("reads the import a notification reports on", () => {
  assert.equal(getFinishedImportJobId({ type: "import_finished", jobId: "j1", recipeId: "r1" }), "j1");
  assert.equal(getFinishedImportJobId({ type: "daily_reminder" }), null);
  assert.equal(getFinishedImportJobId(null), null);
});
