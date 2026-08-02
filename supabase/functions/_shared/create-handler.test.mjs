import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("import handler resolves TikTok share links before creating jobs", () => {
  const source = readFileSync(new URL("./create-handler.ts", import.meta.url), "utf8");

  assert.match(source, /resolveTikTokSourceUrl/);
  assert.match(source, /submittedPlatform === "tiktok"[\s\S]*resolveTikTokSourceUrl\(submittedUrl\)/);
  assert.match(source, /sourceUrl:\s*normalizedUrl/);
  assert.match(source, /stage:\s*"share_url_resolved"/);
  assert.match(source, /original_url:\s*submittedUrl/);
  assert.match(source, /resolved_url:\s*normalizedUrl/);
});
