import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("starting an import resolves a TikTok share link before the job is created", () => {
  const source = readFileSync(new URL("../imports.ts", import.meta.url), "utf8");

  assert.match(source, /detectSourcePlatform\(submittedUrl\) === "tiktok"\s*\? await resolveTikTokSourceUrl\(submittedUrl\)/);
  assert.match(source, /sourceUrl:\s*resolution\.url/);
  assert.match(source, /stage:\s*"share_url_resolved"/);
  assert.match(source, /original_url:\s*args\.submittedUrl/);
  assert.match(source, /resolved_url:\s*args\.sourceUrl/);
  assert.ok(
    source.indexOf("resolveTikTokSourceUrl(submittedUrl)") < source.indexOf("ctx.runMutation(internal.imports.start"),
    "the link must be resolved before the job is recorded"
  );
});

test("an import can only be started and read by its signed-in owner", () => {
  const source = readFileSync(new URL("../imports.ts", import.meta.url), "utf8");

  const create = source.match(/export const create = action\(\{[\s\S]*?\n\}\);/);
  assert.ok(create);
  assert.match(create[0], /const userId = await requireUserId\(ctx\);/);
  // The user comes from the session, never from an argument.
  assert.doesNotMatch(create[0].match(/args: \{[\s\S]*?\n  \},/)[0], /userId/);

  const get = source.match(/export const get = query\(\{[\s\S]*?\n\}\);/);
  assert.ok(get);
  assert.match(get[0], /if \(!job \|\| job\.user_id !== userId\) return null;/);
});
