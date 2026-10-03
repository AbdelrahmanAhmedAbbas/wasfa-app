#!/usr/bin/env node
// Checks the two Apify calls a YouTube Shorts import depends on, using the same
// requests the import pipeline sends:
//   1. the audio actor returning a downloadable MP3 of the Short
//   2. the metadata actor returning the Short's title, description and duration
//
// Usage:
//   APIFY_TOKEN=... node scripts/spike-youtube-short.mjs <short-url>
//
// APIFY_ACTOR_YOUTUBE and APIFY_ACTOR_YOUTUBE_AUDIO override the actors, as they do
// for the deployed functions.

import {
  DEFAULT_APIFY_ACTOR_YOUTUBE,
  DEFAULT_APIFY_ACTOR_YOUTUBE_AUDIO,
  SHORT_MAX_DURATION_SECONDS,
  YOUTUBE_AUDIO_MAX_CHARGE_USD,
  buildYouTubeActorInput,
  buildYouTubeAudioActorInput,
  canonicalYouTubeShortUrl,
  parseDurationSeconds,
  parseYouTubeShortId,
} from "../supabase/functions/_shared/youtube.ts";

const APIFY_TIMEOUT_MS = 90_000;

function seconds(startedAt) {
  return ((Date.now() - startedAt) / 1000).toFixed(1);
}

async function downloadAudio(sourceUrl, apifyToken) {
  const actorId = process.env.APIFY_ACTOR_YOUTUBE_AUDIO?.trim() || DEFAULT_APIFY_ACTOR_YOUTUBE_AUDIO;
  console.log(`\n--- Apify audio: ${actorId} ---`);
  const startedAt = Date.now();
  let response;
  try {
    response = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?format=json&clean=true&maxTotalChargeUsd=${YOUTUBE_AUDIO_MAX_CHARGE_USD}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apifyToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildYouTubeAudioActorInput(sourceUrl)),
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
  console.log(`time:        ${seconds(startedAt)}s (the pipeline allows 60s)`);
  if (!record || typeof record !== "object") {
    console.log("FAILED: the actor returned no item for this link");
    return false;
  }
  console.log(`status:      ${record.status ?? "MISSING"}${record.error ? ` (${record.error})` : ""}`);
  console.log(`duration:    ${record.duration ?? "MISSING"}`);
  console.log(`file:        ${record.fileSize ?? "?"} ${record.contentType ?? ""}`);
  if (!record.downloadUrl) {
    console.log("FAILED: no downloadUrl in the result");
    return false;
  }

  // The pipeline fetches the file with the token when it sits in Apify storage.
  const fromApifyStorage = new URL(record.downloadUrl).hostname === "api.apify.com";
  const file = await fetch(record.downloadUrl, {
    headers: fromApifyStorage ? { Authorization: `Bearer ${apifyToken}` } : {},
  });
  const bytes = file.ok ? (await file.arrayBuffer()).byteLength : 0;
  console.log(`download:    HTTP ${file.status}, ${file.headers.get("content-type")}, ${bytes} bytes`);
  return file.ok && bytes > 0 && /^(audio|video)\//.test(file.headers.get("content-type") ?? "");
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
const apifyToken = process.env.APIFY_TOKEN;

if (!sourceUrl || !apifyToken) {
  console.error("Usage: APIFY_TOKEN=... node scripts/spike-youtube-short.mjs <short-url>");
  process.exit(2);
}

const shortId = parseYouTubeShortId(sourceUrl);
if (!shortId) {
  console.error("That link is not a YouTube Short (expected https://youtube.com/shorts/<id>).");
  process.exit(2);
}
const canonicalUrl = canonicalYouTubeShortUrl(shortId);
console.log(`Short: ${canonicalUrl}`);

const audioOk = await downloadAudio(canonicalUrl, apifyToken);
const scrapeOk = await scrapeShort(canonicalUrl, apifyToken);

console.log("\n=== Result ===");
console.log(`Apify audio:    ${audioOk ? "works as built" : "did not return a downloadable audio file: check the output above"}`);
console.log(`Apify metadata: ${scrapeOk ? "works as built" : "did not return a title and a readable duration: check the fields above"}`);
process.exit(audioOk && scrapeOk ? 0 : 1);
