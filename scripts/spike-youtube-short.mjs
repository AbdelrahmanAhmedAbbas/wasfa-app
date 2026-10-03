#!/usr/bin/env node
// Checks the two outside calls a YouTube Shorts import depends on, using the same
// requests the import pipeline sends:
//   1. Gemini reading the Short from its link through OpenRouter
//   2. the Apify actor returning the Short's title, description and duration
//
// Usage:
//   OPENROUTER_API_KEY=... [APIFY_TOKEN=...] node scripts/spike-youtube-short.mjs <short-url>
//
// APIFY_TOKEN is optional; without it only the Gemini read is checked.
// APIFY_ACTOR_YOUTUBE overrides the actor, as it does for the deployed functions.

import {
  DEFAULT_APIFY_ACTOR_YOUTUBE,
  SHORT_MAX_DURATION_SECONDS,
  YOUTUBE_SHORT_READ_PROVIDER,
  YOUTUBE_SHORT_UNREADABLE_MARKER,
  buildYouTubeActorInput,
  buildYouTubeShortReadRequest,
  canonicalYouTubeShortUrl,
  parseDurationSeconds,
  parseYouTubeShortId,
} from "../supabase/functions/_shared/youtube.ts";

const READ_TIMEOUT_MS = 90_000;
const APIFY_TIMEOUT_MS = 90_000;

function seconds(startedAt) {
  return ((Date.now() - startedAt) / 1000).toFixed(1);
}

async function readShort(label, request, apiKey) {
  console.log(`\n--- Gemini read: ${label} ---`);
  const startedAt = Date.now();
  let response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, usage: { include: true } }),
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
  } catch (error) {
    console.log(`FAILED after ${seconds(startedAt)}s: ${String(error)}`);
    return false;
  }

  const body = await response.text();
  if (!response.ok) {
    console.log(`FAILED after ${seconds(startedAt)}s: HTTP ${response.status}`);
    console.log(body.slice(0, 1200));
    return false;
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    console.log(`FAILED after ${seconds(startedAt)}s: response was not JSON`);
    console.log(body.slice(0, 600));
    return false;
  }
  if (data.error) {
    console.log(`FAILED after ${seconds(startedAt)}s: ${JSON.stringify(data.error).slice(0, 1200)}`);
    return false;
  }

  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  const usage = data.usage ?? {};
  console.log(`time:        ${seconds(startedAt)}s`);
  console.log(`served by:   ${data.provider ?? "unknown"} (${data.model ?? "unknown model"})`);
  console.log(
    `tokens:      ${usage.prompt_tokens ?? "?"} in, ${usage.completion_tokens ?? "?"} out` +
      (typeof usage.cost === "number" ? `, cost $${usage.cost.toFixed(5)}` : "")
  );

  if (!text) {
    console.log("FAILED: the model returned no text");
    return false;
  }
  if (text.includes(YOUTUBE_SHORT_UNREADABLE_MARKER)) {
    console.log("FAILED: the model said it could not open the video");
    return false;
  }

  console.log(`characters:  ${text.length}`);
  console.log("text (check it against the real video; a model that cannot see it may invent one):");
  console.log(text.slice(0, 2500));
  return true;
}

async function scrapeShort(sourceUrl, apifyToken) {
  const actorId = process.env.APIFY_ACTOR_YOUTUBE?.trim() || DEFAULT_APIFY_ACTOR_YOUTUBE;
  console.log(`\n--- Apify metadata: ${actorId} ---`);
  const startedAt = Date.now();
  let response;
  try {
    response = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?format=json&clean=true`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apifyToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildYouTubeActorInput(sourceUrl)),
        signal: AbortSignal.timeout(APIFY_TIMEOUT_MS),
      }
    );
  } catch (error) {
    console.log(`FAILED after ${seconds(startedAt)}s: ${String(error)}`);
    return false;
  }

  const body = await response.text();
  if (!response.ok) {
    console.log(`FAILED after ${seconds(startedAt)}s: HTTP ${response.status}`);
    console.log(body.slice(0, 1200));
    return false;
  }

  let items;
  try {
    items = JSON.parse(body);
  } catch {
    console.log(`FAILED after ${seconds(startedAt)}s: response was not JSON`);
    return false;
  }
  const record = Array.isArray(items) ? items[0] : items;
  console.log(`time:        ${seconds(startedAt)}s (the pipeline allows 40s)`);
  if (!record || typeof record !== "object") {
    console.log("FAILED: the actor returned no item for this link");
    return false;
  }

  const duration = parseDurationSeconds(record.duration);
  console.log(`fields:      ${Object.keys(record).join(", ")}`);
  console.log(`id:          ${record.id ?? "MISSING"}`);
  console.log(`title:       ${record.title ?? "MISSING"}`);
  console.log(`description: ${typeof record.text === "string" ? `${record.text.length} characters` : "MISSING (field 'text')"}`);
  console.log(`thumbnail:   ${record.thumbnailUrl ?? "MISSING"}`);
  console.log(
    `duration:    ${JSON.stringify(record.duration)} -> ${duration ?? "NOT PARSED"} seconds` +
      (typeof duration === "number"
        ? duration > SHORT_MAX_DURATION_SECONDS
          ? " (over the limit: this link would be rejected)"
          : " (within the 3-minute limit)"
        : " (the 3-minute check would be skipped)")
  );
  return Boolean(record.title) && typeof duration === "number";
}

const sourceUrl = process.argv[2];
const openRouterKey = process.env.OPENROUTER_API_KEY;
const apifyToken = process.env.APIFY_TOKEN;

if (!sourceUrl || !openRouterKey) {
  console.error("Usage: OPENROUTER_API_KEY=... [APIFY_TOKEN=...] node scripts/spike-youtube-short.mjs <short-url>");
  process.exit(2);
}

const shortId = parseYouTubeShortId(sourceUrl);
if (!shortId) {
  console.error("That link is not a YouTube Short (expected https://youtube.com/shorts/<id>).");
  process.exit(2);
}
const canonicalUrl = canonicalYouTubeShortUrl(shortId);
console.log(`Short: ${canonicalUrl}`);

const production = buildYouTubeShortReadRequest(canonicalUrl);
const withShortsLink = structuredClone(production);
withShortsLink.messages[0].content[1].video_url.url = canonicalUrl;
const { provider: _pinned, ...withoutProviderPin } = production;

let readVerdict = "FAILED in every form: use the Apify subtitle fallback";
if (await readShort(`as the pipeline sends it (watch link, ${YOUTUBE_SHORT_READ_PROVIDER} only)`, production, openRouterKey)) {
  readVerdict = "works as built";
} else if (await readShort(`/shorts/ link, ${YOUTUBE_SHORT_READ_PROVIDER} only`, withShortsLink, openRouterKey)) {
  readVerdict = "works only with the /shorts/ link: youTubeLinkForServices in youtube.ts needs changing";
} else if (await readShort("watch link, no provider pin", withoutProviderPin, openRouterKey)) {
  readVerdict = `works only without the provider pin: YOUTUBE_SHORT_READ_PROVIDER ("${YOUTUBE_SHORT_READ_PROVIDER}") is the wrong slug`;
}

let scrapeVerdict = "not checked (no APIFY_TOKEN)";
if (apifyToken) {
  scrapeVerdict = (await scrapeShort(canonicalUrl, apifyToken))
    ? "works as built"
    : "did not return a title and a readable duration: check the fields above";
}

console.log("\n=== Result ===");
console.log(`Gemini read:    ${readVerdict}`);
console.log(`Apify metadata: ${scrapeVerdict}`);
process.exit(readVerdict === "works as built" && scrapeVerdict !== "did not return a title and a readable duration: check the fields above" ? 0 : 1);
