import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import {
  completeLocalizedContent,
  estimateNutrition,
  extractRecipe,
  fillMissingRecipeDetails,
  generateRecipeContent,
  getRecipeContentModelCandidates,
  getSourceRecipeLanguage,
} from "./ai.ts";
import { normalizeSourceUrlForCache } from "./cache.ts";
import {
  confirmRecipeFromDraft,
  failJobIfStillProcessing,
  findCachedExtractionByUrl,
  logJobEvent,
  updateJobStatus,
  upsertExtractionCache,
  upsertRecipeDraft,
} from "./db.ts";
import { hasIngredientsNeedingReview } from "./ingredient-details.ts";
import { extractAacFromMp4 } from "./mp4-audio.ts";
import { isProviderCreditError, mapPipelineError } from "./pipeline-errors.ts";
import { runSanityCheck } from "./sanity-check.ts";
import type { ImportJobRow, LocalizedRecipeText, RecipeDraft } from "./types.ts";
import {
  DEFAULT_APIFY_ACTOR_YOUTUBE,
  DEFAULT_APIFY_ACTOR_YOUTUBE_AUDIO,
  SHORT_MAX_DURATION_SECONDS,
  YOUTUBE_AUDIO_MAX_CHARGE_USD,
  buildYouTubeActorInput,
  buildYouTubeAudioActorInput,
  parseDurationSeconds,
  parseYouTubeShortId,
  youTubeThumbnailUrl,
} from "./youtube.ts";

// Tried in order: the second model only runs when the first one fails.
const OPENROUTER_TRANSCRIBE_MODELS = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash"];
const TRANSCRIBE_MAX_TOKENS = 8000;
// What the model answers when the video has no speech to write down.
const NO_SPEECH_MARKER = "[NO_SPEECH]";
// Allow reasonably large source downloads so we can still extract metadata/captions
// even when transcription upload limits are lower.
const MAX_MEDIA_DOWNLOAD_BYTES = 64 * 1024 * 1024;
// Transcription: upload and transcribe whenever we have media, up to API limit (OpenAI 25 MB).
const MAX_TRANSCRIPTION_UPLOAD_BYTES = 25 * 1024 * 1024;
const DEFAULT_APIFY_ACTOR_INSTAGRAM = "nH2AHrwxeTRJoN5hX";
const DEFAULT_APIFY_ACTOR_TIKTOK = "clockworks~tiktok-scraper";
const APIFY_TIMEOUT_MS = 60_000;
const YOUTUBE_APIFY_TIMEOUT_MS = 40_000;
const MEDIA_FETCH_TIMEOUT_MS = 45_000;
const OPENROUTER_TRANSCRIBE_TIMEOUT_MS = 60_000;
// Time kept back for the steps after transcription: extraction, both languages, saving.
const POST_TRANSCRIPTION_RESERVE_MS = 55_000;
const MIN_TRANSCRIBE_ATTEMPT_MS = 10_000;
// Background tasks are cut off at 150 seconds on the Supabase free plan. Failing the job
// before that leaves time to record the failure, instead of a job stuck in "processing".
const PIPELINE_TIME_BUDGET_MS = 135_000;
const PIPELINE_TIMED_OUT_CODE = "IMPORT_TIMED_OUT";

type SourceMetadata = {
  title?: string;
  description?: string;
  caption?: string;
  firstComment?: string;
  hashtags?: string[];
  sourcePostId?: string;
  shortCode?: string;
  creatorUsername?: string;
  postedAt?: string;
  videoDurationSeconds?: number;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  mediaUrl?: string;
  mediaType?: string;
  thumbnailUrl?: string;
  mediaOrigin?: "apify";
  mediaError?: string;
};

type PipelineBudget = { expired: boolean; startedAt: number };

type TranscriptionMedia = {
  buffer: Uint8Array;
  mimeType: string;
  filename: string;
};

// Why an import has no transcript. Only "unavailable" is worth retrying later: the video
// has speech we could not get to (a provider error, a failed download, no time left).
type TranscriptSkipReason = "no_speech" | "no_media" | "media_too_large" | "unavailable";

type TranscriptionOutcome =
  | { transcript: string; model: string; uploadBytes: number; uploadMimeType: string }
  | { transcript: null; reason: TranscriptSkipReason; details: string };

type ContentGenerationResult =
  | {
      failed: false;
      content: LocalizedRecipeText;
      model: string;
    }
  | {
      failed: true;
      error: string;
      content?: undefined;
      model?: undefined;
    };

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env variable: ${name}`);
  return value;
}

function normalizeLookupKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sanitizeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => !!entry);
  return result.length > 0 ? result : undefined;
}

function truncateForLog(value: string, max = 800): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutCode: string
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error(timeoutCode)), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(timeoutCode);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseJsonLenient(raw: string): unknown {
  const normalized = raw.trim().replace(/^\uFEFF/, "");
  try {
    return JSON.parse(normalized);
  } catch {
    const firstObject = normalized.indexOf("{");
    const firstArray = normalized.indexOf("[");
    const firstIndex =
      firstObject === -1
        ? firstArray
        : firstArray === -1
          ? firstObject
          : Math.min(firstObject, firstArray);
    if (firstIndex === -1) throw new Error("APIFY_INVALID_JSON");

    const lastObject = normalized.lastIndexOf("}");
    const lastArray = normalized.lastIndexOf("]");
    const lastIndex = Math.max(lastObject, lastArray);
    if (lastIndex <= firstIndex) throw new Error("APIFY_INVALID_JSON");

    const sliced = normalized.slice(firstIndex, lastIndex + 1).trim();
    return JSON.parse(sliced);
  }
}

function findFirstStringValue(input: unknown): string | undefined {
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(input)) {
    let fallback: string | undefined;
    for (const item of input) {
      const found = findFirstStringValue(item);
      if (!found) continue;
      if (/^https?:\/\//i.test(found)) return found;
      fallback ??= found;
    }
    return fallback;
  }

  if (input && typeof input === "object") {
    let fallback: string | undefined;
    for (const value of Object.values(input as Record<string, unknown>)) {
      const found = findFirstStringValue(value);
      if (!found) continue;
      if (/^https?:\/\//i.test(found)) return found;
      fallback ??= found;
    }
    return fallback;
  }

  return undefined;
}

function findFirstStringByKeys(
  input: unknown,
  acceptedKeys: Set<string>
): string | undefined {
  if (!input) return undefined;
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findFirstStringByKeys(item, acceptedKeys);
      if (found) return found;
    }
    return undefined;
  }

  if (typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;

  for (const [key, value] of Object.entries(record)) {
    if (!acceptedKeys.has(normalizeLookupKey(key))) continue;
    const found = findFirstStringValue(value);
    if (found) return found;
  }

  for (const value of Object.values(record)) {
    const found = findFirstStringByKeys(value, acceptedKeys);
    if (found) return found;
  }

  return undefined;
}

function isMediaContentType(type: string): boolean {
  return type.startsWith("audio/") || type.startsWith("video/");
}

async function safeFetch(url: string, headers: Record<string, string> = {}): Promise<Response | null> {
  try {
    return await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (MealPlannerBot/1.0)",
          ...headers,
        },
        redirect: "follow",
      },
      MEDIA_FETCH_TIMEOUT_MS,
      "MEDIA_FETCH_TIMEOUT"
    );
  } catch {
    return null;
  }
}

// Media an actor stored for us sits in Apify storage, which can require the account token.
function apifyStorageHeaders(url: string): Record<string, string> {
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken || new URL(url).hostname !== "api.apify.com") return {};
  return { Authorization: `Bearer ${apifyToken}` };
}

function extractApifyPrimaryRecord(payload: unknown): Record<string, unknown> | null {
  if (Array.isArray(payload)) {
    return asRecord(payload[0]);
  }

  const root = asRecord(payload);
  if (!root) return null;

  if (Array.isArray(root.items)) {
    return asRecord(root.items[0]);
  }
  if (Array.isArray(root.data)) {
    return asRecord(root.data[0]);
  }

  return root;
}

function extractApifyLatestComment(record: Record<string, unknown>): string | undefined {
  const latestComments = record.latestComments;
  if (!Array.isArray(latestComments)) return undefined;
  for (const entry of latestComments) {
    const comment = asRecord(entry);
    const text = asString(comment?.text);
    if (text) return text;
  }
  return undefined;
}

function getApifyActorId(envName: string, fallback: string): string {
  const configured = Deno.env.get(envName)?.trim();
  if (configured) return configured;
  console.warn("[import][apify] actor env missing, using fallback", { envName, fallback });
  return fallback;
}

async function runApifyActor(params: {
  actorId: string;
  sourceUrl: string;
  body: Record<string, unknown>;
  timeoutMs?: number;
  maxTotalChargeUsd?: number;
}): Promise<unknown> {
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) {
    throw new Error("APIFY_TOKEN_MISSING");
  }

  const chargeCap =
    typeof params.maxTotalChargeUsd === "number" ? `&maxTotalChargeUsd=${params.maxTotalChargeUsd}` : "";
  const response = await fetchWithTimeout(
    `https://api.apify.com/v2/acts/${params.actorId}/run-sync-get-dataset-items?format=json&clean=true${chargeCap}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apifyToken}`,
      },
      body: JSON.stringify(params.body),
    },
    params.timeoutMs ?? APIFY_TIMEOUT_MS,
    "APIFY_TIMEOUT"
  );

  const rawBody = await response.text();
  console.log("[import][apify] run-sync response", {
    status: response.status,
    ok: response.ok,
    bytes: rawBody.length,
    actorId: params.actorId,
    url: params.sourceUrl,
  });
  console.log("[import][apify] raw body preview", truncateForLog(rawBody, 4000));

  if (!response.ok) {
    throw new Error(`APIFY_RUN_FAILED ${response.status} ${truncateForLog(rawBody)}`);
  }

  let payload: unknown;
  try {
    payload = parseJsonLenient(rawBody);
  } catch (error) {
    console.error("[import][apify] invalid json payload", {
      url: params.sourceUrl,
      error: String(error),
      preview: truncateForLog(rawBody, 1500),
    });
    throw new Error("APIFY_INVALID_JSON");
  }

  return payload;
}

function parseApifyMetadata(sourceUrl: string, payload: unknown): SourceMetadata {
  const record = extractApifyPrimaryRecord(payload);
  const videoMeta = asRecord(record?.videoMeta) ?? {};
  const musicMeta = asRecord(record?.musicMeta) ?? {};
  const authorMeta = asRecord(record?.authorMeta) ?? {};

  // A TikTok video the actor downloaded is listed in mediaUrls; TikTok's own links expire
  // and refuse plain downloads, so the stored copy comes first.
  const videoUrl =
    sanitizeHttpUrl(asStringArray(record?.mediaUrls)?.[0]) ||
    sanitizeHttpUrl(record?.videoUrl) ||
    sanitizeHttpUrl(videoMeta.downloadAddr) ||
    sanitizeHttpUrl(record?.["videoMeta.downloadAddr"]);
  const audioUrl =
    sanitizeHttpUrl(record?.audioUrl) ||
    sanitizeHttpUrl(musicMeta.playUrl) ||
    sanitizeHttpUrl(record?.["musicMeta.playUrl"]);
  const mediaUrl =
    videoUrl ||
    audioUrl ||
    sanitizeHttpUrl(
      findFirstStringByKeys(
        payload,
        new Set([
          "videourl",
          "video",
          "videosrc",
          "downloadaddr",
          "videometadownloadaddr",
          "downloadurl",
          "downloadvideourl",
          "playaddr",
          "musicmetaplayurl",
          "mediaurl",
          "mediaurls",
          "mp4url",
          "audiourl",
        ])
      )
    );
  const title =
    asString(record?.title) ||
    findFirstStringByKeys(payload, new Set(["title", "videotitle", "name"]));
  const caption =
    asString(record?.caption) ||
    asString(record?.text) ||
    findFirstStringByKeys(payload, new Set(["caption", "description", "text", "videodescription"]));
  const firstComment =
    asString(record?.firstComment) ||
    (record ? extractApifyLatestComment(record) : undefined);
  const hashtags = asStringArray(record?.hashtags);
  const sourcePostId = asString(record?.id);
  const shortCode = asString(record?.shortCode);
  const creatorUsername =
    asString(record?.ownerUsername) ||
    asString(authorMeta.name) ||
    asString(record?.["authorMeta.name"]);
  const postedAt = asString(record?.timestamp) || asString(record?.createTimeISO);
  const videoDurationSeconds =
    asNumber(record?.videoDuration) ??
    asNumber(videoMeta.duration) ??
    asNumber(record?.["videoMeta.duration"]);
  const likesCount = asNumber(record?.likesCount) ?? asNumber(record?.diggCount);
  const commentsCount = asNumber(record?.commentsCount) ?? asNumber(record?.commentCount);
  const videoViewCount = asNumber(record?.videoViewCount) ?? asNumber(record?.playCount);
  const videoPlayCount = asNumber(record?.videoPlayCount) ?? asNumber(record?.playCount);
  const thumbnailUrl =
    sanitizeHttpUrl(asString(record?.thumbnailUrl)) ||
    sanitizeHttpUrl(asString(record?.displayUrl)) ||
    sanitizeHttpUrl(asString(record?.coverUrl)) ||
    sanitizeHttpUrl(videoMeta.coverUrl) ||
    sanitizeHttpUrl(record?.["videoMeta.coverUrl"]) ||
    sanitizeHttpUrl(asString(record?.coverImageUrl)) ||
    sanitizeHttpUrl(
      findFirstStringByKeys(
        payload,
        new Set(["thumbnailurl", "displayurl", "coverurl", "coverimageurl", "imageurl"])
      )
    );

  console.log("[import][apify] parsed metadata", {
    hasRecord: !!record,
    recordKeys: record ? Object.keys(record).slice(0, 40) : [],
    hasVideoUrl: !!videoUrl,
    hasAudioUrl: !!audioUrl,
    hasCaption: !!caption,
    hasThumbnailUrl: !!thumbnailUrl,
    hasFirstComment: !!firstComment,
    hashtagsCount: hashtags?.length ?? 0,
    sourceUrl,
  });

  if (!mediaUrl && !title && !caption && !firstComment) return {};

  return {
    title: title || undefined,
    description: caption || undefined,
    caption: caption || undefined,
    firstComment,
    hashtags,
    sourcePostId,
    shortCode,
    creatorUsername,
    postedAt,
    videoDurationSeconds,
    likesCount,
    commentsCount,
    videoViewCount,
    videoPlayCount,
    mediaUrl,
    mediaType: videoUrl ? "video/mp4" : audioUrl ? "audio/mp4" : undefined,
    thumbnailUrl,
    mediaOrigin: mediaUrl ? "apify" : undefined,
  };
}

async function fetchInstagramViaApify(sourceUrl: string): Promise<SourceMetadata> {
  const actorId = getApifyActorId("APIFY_ACTOR_INSTAGRAM", DEFAULT_APIFY_ACTOR_INSTAGRAM);
  const payload = await runApifyActor({
    actorId,
    sourceUrl,
    body: {
      resultsLimit: 24,
      skipPinnedPosts: false,
      username: [sourceUrl],
    },
  });
  return parseApifyMetadata(sourceUrl, payload);
}

async function fetchTikTokViaApify(sourceUrl: string): Promise<SourceMetadata> {
  const actorId = getApifyActorId("APIFY_ACTOR_TIKTOK", DEFAULT_APIFY_ACTOR_TIKTOK);

  try {
    const payload = await runApifyActor({
      actorId,
      sourceUrl,
      body: {
        postURLs: [sourceUrl],
        resultsPerPage: 1,
        shouldDownloadVideos: true,
        shouldDownloadCovers: false,
        shouldDownloadSlideshowImages: false,
        downloadSubtitlesOptions: "NEVER_DOWNLOAD_SUBTITLES",
      },
    });
    return parseApifyMetadata(sourceUrl, payload);
  } catch (error) {
    if (String(error).includes("APIFY_TOKEN_MISSING")) throw error;
    throw new Error(`TIKTOK_APIFY_FAILED ${String(error)}`);
  }
}

function parseYouTubeApifyMetadata(payload: unknown): SourceMetadata {
  const record = extractApifyPrimaryRecord(payload);
  if (!record) return {};

  return {
    title: asString(record.title),
    description: asString(record.text) ?? asString(record.description),
    hashtags: asStringArray(record.hashtags),
    sourcePostId: asString(record.id),
    creatorUsername: asString(record.channelName),
    postedAt: asString(record.date),
    videoDurationSeconds: parseDurationSeconds(record.duration),
    likesCount: asNumber(record.likes),
    commentsCount: asNumber(record.commentsCount),
    videoViewCount: asNumber(record.viewCount),
    thumbnailUrl: sanitizeHttpUrl(record.thumbnailUrl),
  };
}

async function fetchYouTubeAudioViaApify(
  sourceUrl: string
): Promise<Pick<SourceMetadata, "mediaUrl" | "mediaType" | "mediaOrigin" | "mediaError">> {
  const actorId = getApifyActorId("APIFY_ACTOR_YOUTUBE_AUDIO", DEFAULT_APIFY_ACTOR_YOUTUBE_AUDIO);

  try {
    const payload = await runApifyActor({
      actorId,
      sourceUrl,
      body: buildYouTubeAudioActorInput(sourceUrl),
      maxTotalChargeUsd: YOUTUBE_AUDIO_MAX_CHARGE_USD,
    });
    const record = extractApifyPrimaryRecord(payload);
    const mediaUrl = sanitizeHttpUrl(record?.downloadUrl);
    if (!mediaUrl) {
      return { mediaError: asString(record?.error) ?? "YOUTUBE_AUDIO_NOT_RETURNED" };
    }
    return {
      mediaUrl,
      mediaType: asString(record?.contentType) ?? "audio/mpeg",
      mediaOrigin: "apify",
    };
  } catch (error) {
    if (String(error).includes("APIFY_TOKEN_MISSING")) throw error;
    console.warn("[import][apify] YouTube audio actor failed, continuing without audio", {
      actorId,
      error: truncateForLog(String(error), 800),
    });
    return { mediaError: truncateForLog(String(error), 300) };
  }
}

async function fetchYouTubeDetailsViaApify(sourceUrl: string): Promise<SourceMetadata> {
  const actorId = getApifyActorId("APIFY_ACTOR_YOUTUBE", DEFAULT_APIFY_ACTOR_YOUTUBE);

  try {
    const payload = await runApifyActor({
      actorId,
      sourceUrl,
      body: buildYouTubeActorInput(sourceUrl),
      timeoutMs: YOUTUBE_APIFY_TIMEOUT_MS,
    });
    return parseYouTubeApifyMetadata(payload);
  } catch (error) {
    if (String(error).includes("APIFY_TOKEN_MISSING")) throw error;
    // The audio comes from its own actor, so a failed scrape loses the description
    // and the duration check but does not have to fail the import.
    console.warn("[import][apify] YouTube actor failed, continuing without metadata", {
      actorId,
      error: truncateForLog(String(error), 800),
    });
    return {};
  }
}

// One actor gives a Short's description and duration, another its audio. They run
// together so a Short takes about as long to fetch as an Instagram reel.
async function fetchYouTubeViaApify(sourceUrl: string): Promise<SourceMetadata> {
  const videoId = parseYouTubeShortId(sourceUrl);
  const fallbackThumbnailUrl = videoId ? youTubeThumbnailUrl(videoId) : undefined;

  const [details, audio] = await Promise.all([
    fetchYouTubeDetailsViaApify(sourceUrl),
    fetchYouTubeAudioViaApify(sourceUrl),
  ]);

  return {
    ...details,
    ...audio,
    sourcePostId: details.sourcePostId ?? videoId ?? undefined,
    thumbnailUrl: details.thumbnailUrl ?? fallbackThumbnailUrl,
  };
}

async function fetchApifyMetadata(params: {
  sourceUrl: string;
  sourcePlatform: ImportJobRow["source_platform"];
}): Promise<SourceMetadata> {
  if (params.sourcePlatform === "tiktok") return fetchTikTokViaApify(params.sourceUrl);
  if (params.sourcePlatform === "youtube") return fetchYouTubeViaApify(params.sourceUrl);
  return fetchInstagramViaApify(params.sourceUrl);
}

async function downloadMediaForTranscription(metadata: SourceMetadata): Promise<TranscriptionMedia> {
  if (!metadata.mediaUrl) {
    console.error("[import][download] no mediaUrl in metadata");
    throw new Error("MEDIA_NOT_AVAILABLE");
  }

  console.log("[import][download] fetching media", {
    mediaUrl: metadata.mediaUrl.slice(0, 200),
    mediaType: metadata.mediaType,
    mediaOrigin: metadata.mediaOrigin,
  });

  const response = await safeFetch(metadata.mediaUrl, apifyStorageHeaders(metadata.mediaUrl));
  if (!response?.ok) {
    console.error("[import][download] fetch failed", {
      status: response?.status ?? "null",
      mediaUrl: metadata.mediaUrl.slice(0, 200),
    });
    throw new Error("MEDIA_DOWNLOAD_FAILED");
  }

  const mimeType = (response.headers.get("content-type") || metadata.mediaType || "").toLowerCase();
  console.log("[import][download] response received", {
    status: response.status,
    contentType: mimeType,
    contentLength: response.headers.get("content-length"),
  });

  if (!isMediaContentType(mimeType)) {
    console.error("[import][download] not a media content type", { contentType: mimeType });
    throw new Error("MEDIA_TYPE_NOT_SUPPORTED");
  }

  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_MEDIA_DOWNLOAD_BYTES) {
      throw new Error("MEDIA_DOWNLOAD_TOO_LARGE");
    }
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_MEDIA_DOWNLOAD_BYTES) {
    throw new Error("MEDIA_DOWNLOAD_TOO_LARGE");
  }

  const extension = mimeType.includes("audio") ? "m4a" : "mp4";
  console.log("[import][download] download complete", {
    bytes: arrayBuffer.byteLength,
    extension,
    sendMime: mimeType || "video/mp4",
  });
  return {
    buffer: new Uint8Array(arrayBuffer),
    mimeType: mimeType || "video/mp4",
    filename: `source.${extension}`,
  };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * The uploads to try for one downloaded file, smallest first: the audio track on its
 * own, then the file as downloaded when it fits the upload limit.
 */
function buildTranscriptionCandidates(media: TranscriptionMedia): TranscriptionMedia[] {
  const candidates: TranscriptionMedia[] = [];
  const isMp4 = media.mimeType.includes("mp4") || media.mimeType.startsWith("video/");

  if (isMp4) {
    const audio = extractAacFromMp4(media.buffer);
    if (audio && audio.byteLength <= MAX_TRANSCRIPTION_UPLOAD_BYTES) {
      candidates.push({ buffer: audio, mimeType: "audio/aac", filename: "source.aac" });
    }
  }
  if (media.buffer.byteLength <= MAX_TRANSCRIPTION_UPLOAD_BYTES) candidates.push(media);

  return candidates;
}

function audioFormatFor(mimeType: string): string {
  if (mimeType.includes("aac")) return "aac";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mp3") || mimeType.includes("mpeg")) return "mp3";
  return "mp4";
}

async function transcribeWithOpenRouter(
  media: TranscriptionMedia,
  model: string,
  timeoutMs: number
): Promise<string> {
  const apiKey = requiredEnv("OPENROUTER_API_KEY");

  const base64Data = uint8ToBase64(media.buffer);
  const audioFormat = audioFormatFor(media.mimeType);

  const response = await fetchWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://meal-planner.app",
        "X-Title": "Meal Planner Import",
      },
      body: JSON.stringify({
        model,
        max_tokens: TRANSCRIBE_MAX_TOKENS,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Transcribe every spoken word in this recording exactly as said, in the language and dialect it is spoken in. Arabic speech, including Egyptian, Gulf and Levantine dialects, must be written in Arabic script and never translated. Keep every ingredient, amount and number the speaker says. Return ONLY the transcript text. If nobody speaks (music or silence only), return exactly ${NO_SPEECH_MARKER}.`,
              },
              {
                type: "input_audio",
                input_audio: {
                  data: base64Data,
                  format: audioFormat,
                },
              },
            ],
          },
        ],
      }),
    },
    timeoutMs,
    "TRANSCRIPTION_TIMEOUT"
  );

  const body = await response.text();
  if (!response.ok) {
    console.error("[import][openrouter-transcribe] failed", {
      status: response.status,
      body: truncateForLog(body, 800),
      fileBytes: media.buffer.byteLength,
      format: audioFormat,
      model,
    });
    if (response.status === 413) {
      throw new Error(`MEDIA_TOO_LARGE_OPENROUTER ${truncateForLog(body, 1200)}`);
    }
    throw new Error(`TRANSCRIPTION_FAILED ${response.status} ${truncateForLog(body, 1200)}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = JSON.parse(body);
  } catch {
    console.error("[import][openrouter-transcribe] invalid json", {
      body: truncateForLog(body, 500),
    });
    throw new Error(`TRANSCRIPTION_FAILED 200 invalid_json ${truncateForLog(body, 500)}`);
  }

  const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text || text.includes(NO_SPEECH_MARKER)) {
    console.warn("[import][openrouter-transcribe] no speech", { body: truncateForLog(body, 300) });
    throw new Error("TRANSCRIPTION_NO_SPEECH");
  }
  return text;
}

/**
 * Downloads the post's media and transcribes it, trying a smaller upload and a second
 * model before giving up. Never throws: a missing transcript comes back with its reason.
 */
async function transcribeSourceMedia(
  metadata: SourceMetadata,
  budget: PipelineBudget,
  onDownloaded: (media: TranscriptionMedia, candidates: TranscriptionMedia[]) => Promise<void>
): Promise<TranscriptionOutcome> {
  if (!metadata.mediaUrl) {
    // A media error means the post has audio that the downloader failed to fetch.
    return metadata.mediaError
      ? { transcript: null, reason: "unavailable", details: metadata.mediaError }
      : { transcript: null, reason: "no_media", details: "MEDIA_NOT_AVAILABLE" };
  }

  let candidates: TranscriptionMedia[];
  try {
    const media = await downloadMediaForTranscription(metadata);
    candidates = buildTranscriptionCandidates(media);
    await onDownloaded(media, candidates);
  } catch (error) {
    const raw = String(error);
    const reason = raw.includes("MEDIA_DOWNLOAD_TOO_LARGE")
      ? "media_too_large"
      : raw.includes("MEDIA_TYPE_NOT_SUPPORTED")
        ? "no_media"
        : "unavailable";
    return { transcript: null, reason, details: truncateForLog(raw, 1200) };
  }

  if (candidates.length === 0) {
    return { transcript: null, reason: "media_too_large", details: "MEDIA_TOO_LARGE_FOR_TRANSCRIPTION_UPLOAD" };
  }

  // The smallest upload goes to each model first; the file as downloaded is the last resort.
  const attempts = [
    ...OPENROUTER_TRANSCRIBE_MODELS.map((model) => ({ model, media: candidates[0] })),
    ...(candidates.length > 1 ? [{ model: OPENROUTER_TRANSCRIBE_MODELS[0], media: candidates[1] }] : []),
  ];

  let lastError = "";
  for (const attempt of attempts) {
    const remainingMs =
      PIPELINE_TIME_BUDGET_MS - (Date.now() - budget.startedAt) - POST_TRANSCRIPTION_RESERVE_MS;
    if (remainingMs < MIN_TRANSCRIBE_ATTEMPT_MS) {
      lastError = lastError || "TRANSCRIPTION_OUT_OF_TIME";
      break;
    }

    try {
      const transcript = await transcribeWithOpenRouter(
        attempt.media,
        attempt.model,
        Math.min(OPENROUTER_TRANSCRIBE_TIMEOUT_MS, remainingMs)
      );
      return {
        transcript,
        model: attempt.model,
        uploadBytes: attempt.media.buffer.byteLength,
        uploadMimeType: attempt.media.mimeType,
      };
    } catch (error) {
      lastError = truncateForLog(String(error), 1200);
      if (lastError.includes("TRANSCRIPTION_NO_SPEECH")) {
        return { transcript: null, reason: "no_speech", details: lastError };
      }
      // Another model or a smaller file does not help an account that is out of credit.
      if (isProviderCreditError(error)) break;
    }
  }

  return { transcript: null, reason: "unavailable", details: lastError };
}

function buildCombinedContext(params: {
  sourceUrl: string;
  sourcePlatform: ImportJobRow["source_platform"];
  metadata: SourceMetadata;
  transcript?: string | null;
  sharedText?: string | null;
}): string {
  const lines: string[] = [
    `Source URL: ${params.sourceUrl}`,
    `Source platform: ${params.sourcePlatform}`,
  ];

  if (params.metadata.title) lines.push(`Title: ${params.metadata.title}`);
  if (params.metadata.description) lines.push(`Description: ${params.metadata.description}`);
  if (params.metadata.caption) lines.push(`Caption: ${params.metadata.caption}`);
  if (params.metadata.firstComment) lines.push(`First comment: ${params.metadata.firstComment}`);
  if (params.metadata.hashtags?.length) {
    lines.push(`Hashtags: ${params.metadata.hashtags.join(", ")}`);
  }
  if (params.metadata.creatorUsername) {
    lines.push(`Creator username: ${params.metadata.creatorUsername}`);
  }
  if (typeof params.metadata.videoDurationSeconds === "number") {
    lines.push(`Video duration seconds: ${params.metadata.videoDurationSeconds}`);
  }
  if (params.sharedText?.trim()) lines.push(`Shared text: ${params.sharedText.trim()}`);
  if (params.transcript?.trim()) {
    lines.push(`Transcript:\n${params.transcript.trim()}`);
  } else {
    lines.push("Transcript: none. Nothing spoken in the video is known, so use only the text above.");
  }

  return lines.join("\n\n");
}

function hasExtractionTextContext(params: {
  metadata: SourceMetadata;
  sharedText?: string | null;
  transcript?: string | null;
}): boolean {
  if (params.transcript?.trim()) return true;
  if (params.sharedText?.trim()) return true;
  if (params.metadata.caption?.trim()) return true;
  if (params.metadata.firstComment?.trim()) return true;
  if (params.metadata.description?.trim()) return true;
  if (params.metadata.title?.trim()) return true;
  return false;
}

function applySourceLanguageContent(
  draft: RecipeDraft,
  language: "en" | "ar",
  localized: LocalizedRecipeText
): RecipeDraft {
  if (language !== "en" && language !== "ar") return draft;

  return {
    ...draft,
    title: localized.title || draft.title,
    description: localized.description ?? draft.description,
    cuisine: localized.cuisine ?? draft.cuisine,
    meal_type: localized.meal_type ?? draft.meal_type,
    steps: localized.steps.length === draft.steps.length ? localized.steps : draft.steps,
  };
}

function throwIfOutOfTime(budget: PipelineBudget) {
  if (budget.expired) throw new Error(PIPELINE_TIMED_OUT_CODE);
}

export async function runImportPipeline(params: {
  adminClient: SupabaseClient;
  job: ImportJobRow;
  sharedText?: string | null;
}) {
  const budget: PipelineBudget = { expired: false, startedAt: Date.now() };
  let budgetTimer: ReturnType<typeof setTimeout> | undefined;
  const budgetExpiry = new Promise<"expired">((resolve) => {
    budgetTimer = setTimeout(() => {
      budget.expired = true;
      resolve("expired");
    }, PIPELINE_TIME_BUDGET_MS);
  });

  try {
    const outcome = await Promise.race([
      runPipelineSteps({ ...params, budget }).then(() => "finished" as const),
      budgetExpiry,
    ]);
    if (outcome !== "expired") return;

    const failed = await failJobIfStillProcessing(params.adminClient, {
      jobId: params.job.id,
      errorCode: PIPELINE_TIMED_OUT_CODE,
      errorMessage: "This import took too long. Please try again.",
    });
    if (failed) {
      await logJobEvent(params.adminClient, params.job.id, "failed", {
        reason: PIPELINE_TIMED_OUT_CODE,
        time_budget_ms: PIPELINE_TIME_BUDGET_MS,
      });
    }
  } finally {
    clearTimeout(budgetTimer);
  }
}

async function runPipelineSteps(params: {
  adminClient: SupabaseClient;
  job: ImportJobRow;
  sharedText?: string | null;
  budget: PipelineBudget;
}) {
  let transcript: string | null = null;
  // Set when the video's speech could not be reached this time, so the failure message
  // and the shared cache can tell a missed transcript from a video with nothing to hear.
  let transcriptUnavailable = false;

  await updateJobStatus(params.adminClient, {
    jobId: params.job.id,
    status: "processing",
    errorCode: null,
    errorMessage: null,
  });

  try {
    await logJobEvent(params.adminClient, params.job.id, "normalized", {
      stage: "ingest_url",
      source_url: params.job.source_url,
      source_platform: params.job.source_platform,
    });

    const normalizedCacheUrl = normalizeSourceUrlForCache(params.job.source_url);
    const cachedExtraction = await findCachedExtractionByUrl(params.adminClient, normalizedCacheUrl);
    await logJobEvent(params.adminClient, params.job.id, "normalized", {
      stage: "cache_lookup",
      cache_hit: !!cachedExtraction,
      normalized_source_url: normalizedCacheUrl,
    });

    if (cachedExtraction) {
      // A cached recipe can lack a language: it was stored by an older import,
      // or one generation failed that day. Fill the gap once, for everyone.
      const completion = await completeLocalizedContent(cachedExtraction.payload);
      const cachedDraft = completion.draft;
      if (completion.filled.length > 0 || completion.failed.length > 0) {
        if (completion.filled.length > 0) {
          await upsertExtractionCache(params.adminClient, {
            normalizedUrl: normalizedCacheUrl,
            payload: cachedDraft,
            sourcePlatform: cachedExtraction.source_platform,
            sourcePostId: cachedExtraction.source_post_id,
            sourceThumbnailUrl: cachedExtraction.source_thumbnail_url,
            modelInfo: { extractionModel: cachedExtraction.extraction_model },
          });
        }
        await logJobEvent(params.adminClient, params.job.id, "normalized", {
          stage: "cache_localization_repair",
          filled: completion.filled,
          failed: completion.failed,
        });
        throwIfOutOfTime(params.budget);
      }

      await upsertRecipeDraft(params.adminClient, {
        jobId: params.job.id,
        userId: params.job.user_id,
        payload: cachedDraft,
        confidence: {
          cache_hit: true,
          cache_source_url: normalizedCacheUrl,
          extraction_model_used: cachedExtraction.extraction_model,
        },
        language: cachedDraft.source.language ?? null,
      });

      const recipeId = await confirmRecipeFromDraft(params.adminClient, {
        job: params.job,
        payload: cachedDraft,
        sourceThumbnailUrl: cachedExtraction.source_thumbnail_url ?? null,
        sourceReelUrl: params.job.source_url,
      });

      await updateJobStatus(params.adminClient, {
        jobId: params.job.id,
        status: "confirmed",
        errorCode: null,
        errorMessage: null,
      });

      await logJobEvent(params.adminClient, params.job.id, "confirmed", {
        recipe_id: recipeId,
        auto_confirmed: true,
        cache_hit: true,
      });
      return;
    }

    const metadata = await fetchApifyMetadata({
      sourceUrl: params.job.source_url,
      sourcePlatform: params.job.source_platform,
    });

    await logJobEvent(params.adminClient, params.job.id, "normalized", {
      stage: "metadata_fetch",
      has_media_candidate: !!metadata.mediaUrl,
      has_title: !!metadata.title,
      has_caption: !!metadata.caption,
      has_first_comment: !!metadata.firstComment,
      hashtags_count: metadata.hashtags?.length ?? 0,
      media_origin: metadata.mediaOrigin ?? null,
      has_thumbnail: !!metadata.thumbnailUrl,
      media_error: metadata.mediaError ?? null,
      apify_used: true,
    });

    await logJobEvent(params.adminClient, params.job.id, "normalized", {
      stage: "media_access_check",
      media_url_present: !!metadata.mediaUrl,
      media_type: metadata.mediaType ?? null,
    });

    // The scraper found nothing at this link: a private or deleted post, or a wrong link.
    if (Object.keys(metadata).length === 0) throw new Error("POST_NOT_FOUND");

    if (
      params.job.source_platform === "youtube" &&
      typeof metadata.videoDurationSeconds === "number" &&
      metadata.videoDurationSeconds > SHORT_MAX_DURATION_SECONDS
    ) {
      throw new Error("SHORT_TOO_LONG");
    }

    const transcription = await transcribeSourceMedia(metadata, params.budget, async (media, candidates) => {
      await logJobEvent(params.adminClient, params.job.id, "normalized", {
        stage: "audio_extract",
        mime_type: media.mimeType,
        media_bytes: media.buffer.byteLength,
        audio_track_extracted: candidates[0]?.mimeType === "audio/aac",
        upload_bytes: candidates[0]?.buffer.byteLength ?? null,
        transcription_eligible: candidates.length > 0,
        transcription_upload_limit_bytes: MAX_TRANSCRIPTION_UPLOAD_BYTES,
      });
    });

    if (transcription.transcript !== null) {
      transcript = transcription.transcript;
      await logJobEvent(params.adminClient, params.job.id, "normalized", {
        stage: "openrouter_transcribe",
        transcript_length: transcript.length,
        model: transcription.model,
        upload_bytes: transcription.uploadBytes,
        upload_mime_type: transcription.uploadMimeType,
      });
    } else {
      transcriptUnavailable = transcription.reason === "unavailable";
      await logJobEvent(params.adminClient, params.job.id, "normalized", {
        stage: transcriptUnavailable ? "openrouter_transcribe_failed" : "openrouter_transcribe_skipped",
        reason: transcription.reason,
        details: transcription.details,
      });
    }

    if (
      !hasExtractionTextContext({
        metadata,
        sharedText: params.sharedText,
        transcript,
      })
    ) {
      throw new Error("INSUFFICIENT_TEXT_CONTEXT");
    }

    throwIfOutOfTime(params.budget);

    const combinedContext = buildCombinedContext({
      sourceUrl: params.job.source_url,
      sourcePlatform: params.job.source_platform,
      metadata,
      transcript,
      sharedText: params.sharedText,
    });

    const extraction = await extractRecipe({
      sourceUrl: params.job.source_url,
      sourcePlatform: params.job.source_platform,
      sourceText: combinedContext,
    });
    await logJobEvent(params.adminClient, params.job.id, "normalized", {
      stage: "gemini_parse",
      model: extraction.model,
      provider: extraction.provider,
      failed_models: extraction.confidence.extraction_failed_models ?? [],
    });
    await logJobEvent(params.adminClient, params.job.id, "normalized", {
      stage: "web_measurement_fill",
      ingredients_filled:
        typeof extraction.confidence.ingredient_review === "object" &&
        extraction.confidence.ingredient_review !== null &&
        "web_research_ingredients" in extraction.confidence.ingredient_review
          ? extraction.confidence.ingredient_review.web_research_ingredients
          : 0,
      citations_count:
        typeof extraction.confidence.ingredient_review === "object" &&
        extraction.confidence.ingredient_review !== null &&
        "web_research_citations" in extraction.confidence.ingredient_review &&
        Array.isArray(extraction.confidence.ingredient_review.web_research_citations)
          ? extraction.confidence.ingredient_review.web_research_citations.length
          : 0,
    });

    throwIfOutOfTime(params.budget);

    await logJobEvent(params.adminClient, params.job.id, "normalized", {
      stage: "post_extraction_parallel",
    });

    const englishContentPromise: Promise<ContentGenerationResult> = generateRecipeContent(
      extraction.draft,
      "en",
      combinedContext
    )
      .then(async (result) => {
        await logJobEvent(params.adminClient, params.job.id, "normalized", {
          stage: "content_generation_en",
          model: result.model,
          failed: false,
        });
        return {
          content: result.content,
          model: result.model,
          failed: false,
        };
      })
      .catch(async (error) => {
        await logJobEvent(params.adminClient, params.job.id, "normalized", {
          stage: "content_generation_en_failed",
          failed: true,
          error: truncateForLog(String(error), 1200),
        });
        return {
          failed: true,
          error: String(error),
        };
      });

    const arabicContentPromise: Promise<ContentGenerationResult> = generateRecipeContent(
      extraction.draft,
      "ar",
      combinedContext,
      {
        modelNames: getRecipeContentModelCandidates("ar").slice(0, 1),
      }
    )
      .then(async (result) => {
        await logJobEvent(params.adminClient, params.job.id, "normalized", {
          stage: "content_generation_ar",
          model: result.model,
          failed: false,
        });
        return {
          content: result.content,
          model: result.model,
          failed: false,
        };
      })
      .catch(async (error) => {
        await logJobEvent(params.adminClient, params.job.id, "normalized", {
          stage: "content_generation_ar_failed",
          failed: true,
          error: truncateForLog(String(error), 1200),
        });
        return {
          failed: true,
          error: String(error),
        };
      });

    const nutritionPromise = estimateNutrition(extraction.draft).then(async (nutrition) => {
      await logJobEvent(params.adminClient, params.job.id, "normalized", {
        stage: "nutrition_estimate",
        estimated: nutrition.estimated,
        confidence: nutrition.confidence,
      });
      return nutrition;
    });

    const missingDetailsPromise = fillMissingRecipeDetails(extraction.draft, combinedContext).then(
      async (result) => {
        await logJobEvent(params.adminClient, params.job.id, "normalized", {
          stage: "fill_missing_details",
          filled_description: result.filledDescription,
          filled_prep_minutes: result.filledPrepMinutes,
          filled_cook_minutes: result.filledCookMinutes,
        });
        return result;
      }
    );

    const [englishContent, arabicContent, nutrition, detailCompletion] = await Promise.all([
      englishContentPromise,
      arabicContentPromise,
      nutritionPromise,
      missingDetailsPromise,
    ]);

    const localized: Partial<Record<"en" | "ar", LocalizedRecipeText>> = {};
    if (!englishContent.failed && englishContent.content) localized.en = englishContent.content;
    if (!arabicContent.failed && arabicContent.content) localized.ar = arabicContent.content;

    const sourceLanguage = getSourceRecipeLanguage(extraction.draft);
    let enrichedDraft: RecipeDraft = {
      ...detailCompletion.draft,
      nutrition_estimate: nutrition,
      localized: Object.keys(localized).length > 0 ? localized : undefined,
    };

    const sourceLocalizedContent = localized[sourceLanguage];
    if (sourceLocalizedContent) {
      enrichedDraft = applySourceLanguageContent(enrichedDraft, sourceLanguage, sourceLocalizedContent);
      enrichedDraft.localized = Object.keys(localized).length > 0 ? localized : undefined;
    }

    let sanityCheck = await runSanityCheck(enrichedDraft);
    const arabicFallbackModels = getRecipeContentModelCandidates("ar").slice(1);

    if (sanityCheck.shouldRetryArabic && arabicFallbackModels.length > 0) {
      try {
        const retriedArabic = await generateRecipeContent(
          detailCompletion.draft,
          "ar",
          combinedContext,
          { modelNames: arabicFallbackModels }
        );
        localized.ar = retriedArabic.content;
        enrichedDraft = {
          ...enrichedDraft,
          localized,
        };
        if (sourceLanguage === "ar") {
          enrichedDraft = applySourceLanguageContent(enrichedDraft, "ar", retriedArabic.content);
          enrichedDraft.localized = localized;
        }
        await logJobEvent(params.adminClient, params.job.id, "normalized", {
          stage: "content_generation_ar_retry",
          model: retriedArabic.model,
          failed: false,
        });
        sanityCheck = await runSanityCheck(enrichedDraft);
      } catch (error) {
        await logJobEvent(params.adminClient, params.job.id, "normalized", {
          stage: "content_generation_ar_retry_failed",
          failed: true,
          error: truncateForLog(String(error), 1200),
        });
      }
    }

    await logJobEvent(params.adminClient, params.job.id, "normalized", {
      stage: "sanity_check",
      passed: sanityCheck.passed,
      issue_count: sanityCheck.issues.length,
      issues: sanityCheck.issues,
      retry_arabic: sanityCheck.shouldRetryArabic,
      arabic_issues: sanityCheck.arabicIssues,
    });

    await logJobEvent(params.adminClient, params.job.id, "normalized", {
      stage: "recipe_content_ready",
      has_localized_ar: !!enrichedDraft.localized?.ar,
      has_localized_en: !!enrichedDraft.localized?.en,
    });

    throwIfOutOfTime(params.budget);

    await logJobEvent(params.adminClient, params.job.id, "normalized", {
      stage: "save_draft",
    });
    await upsertRecipeDraft(params.adminClient, {
      jobId: params.job.id,
      userId: params.job.user_id,
      payload: enrichedDraft,
      confidence: {
        ...extraction.confidence,
        cache_hit: false,
        cache_source_url: normalizedCacheUrl,
        transcription_model: transcription.transcript !== null ? transcription.model : null,
        transcription_provider: transcript ? "openrouter" : "skipped",
        transcription_chars: transcript?.length ?? 0,
        transcription_skipped: !transcript,
        transcription_skip_reason: transcription.transcript === null ? transcription.reason : null,
        missing_fields_completed: {
          description: detailCompletion.filledDescription,
          prep_minutes: detailCompletion.filledPrepMinutes,
          cook_minutes: detailCompletion.filledCookMinutes,
        },
        nutrition_provider: "openrouter",
        nutrition_model: "google/gemini-3-flash-preview",
        content_generation_models: {
          en: englishContent.failed ? null : englishContent.model ?? null,
          ar: arabicContent.failed ? null : arabicContent.model ?? null,
        },
        content_generation_failed: {
          en: englishContent.failed,
          ar: arabicContent.failed,
        },
        sanity_check: {
          passed: sanityCheck.passed,
          issue_count: sanityCheck.issues.length,
          retry_arabic: sanityCheck.shouldRetryArabic,
        },
        source_metadata: {
          source_post_id: metadata.sourcePostId ?? null,
          short_code: metadata.shortCode ?? null,
          creator_username: metadata.creatorUsername ?? null,
          posted_at: metadata.postedAt ?? null,
          video_duration_seconds: metadata.videoDurationSeconds ?? null,
          likes_count: metadata.likesCount ?? null,
          comments_count: metadata.commentsCount ?? null,
          video_view_count: metadata.videoViewCount ?? null,
          video_play_count: metadata.videoPlayCount ?? null,
          hashtags_count: metadata.hashtags?.length ?? 0,
          media_origin: metadata.mediaOrigin ?? null,
          thumbnail_url: metadata.thumbnailUrl ?? null,
          has_caption: !!metadata.caption,
          has_first_comment: !!metadata.firstComment,
        },
      },
      language: extraction.draft.source.language ?? null,
    });

    // A recipe built without the speech we failed to reach stays out of the shared cache,
    // so the next import of this link listens to the video again.
    if (!transcriptUnavailable) {
      await upsertExtractionCache(params.adminClient, {
        normalizedUrl: normalizedCacheUrl,
        payload: enrichedDraft,
        sourcePlatform: params.job.source_platform,
        sourcePostId: metadata.sourcePostId ?? null,
        sourceThumbnailUrl: metadata.thumbnailUrl ?? null,
        modelInfo: { extractionModel: extraction.model },
      });
    }
    await logJobEvent(params.adminClient, params.job.id, "normalized", {
      stage: "cache_write",
      model: extraction.model,
      payload_bytes: JSON.stringify(enrichedDraft).length,
      skipped: transcriptUnavailable,
    });

    const needsIngredientReview = hasIngredientsNeedingReview(enrichedDraft.ingredients);
    const recipeId = await confirmRecipeFromDraft(params.adminClient, {
      job: params.job,
      payload: enrichedDraft,
      sourceThumbnailUrl: metadata.thumbnailUrl ?? null,
      sourceReelUrl: params.job.source_url,
    });

    await updateJobStatus(params.adminClient, {
      jobId: params.job.id,
      status: "confirmed",
      errorCode: null,
      errorMessage: null,
    });

    await logJobEvent(params.adminClient, params.job.id, "confirmed", {
      recipe_id: recipeId,
      auto_confirmed: true,
      ingredient_review_remaining: needsIngredientReview,
    });

    await logJobEvent(params.adminClient, params.job.id, "ai_extracted", {
      provider: extraction.provider,
      model: extraction.model,
      ingredient_count: enrichedDraft.ingredients.length,
      step_count: enrichedDraft.steps.length,
      has_localized_ar: !!enrichedDraft.localized?.ar,
      has_localized_en: !!enrichedDraft.localized?.en,
      recipe_id: recipeId,
      needs_ingredient_review: needsIngredientReview,
    });
  } catch (error) {
    // Once the time budget has run out the job is already marked failed.
    if (params.budget.expired) return;

    const mapped = mapPipelineError(error, { transcriptUnavailable });
    await updateJobStatus(params.adminClient, {
      jobId: params.job.id,
      status: "failed",
      errorCode: mapped.code,
      errorMessage: mapped.message,
    });
    await logJobEvent(params.adminClient, params.job.id, "failed", {
      reason: mapped.code,
      details: String(error),
    });
  } finally {
    // Immediate cleanup: temporary media and transcript are memory-only and
    // explicitly cleared after each attempt.
    transcript = null;
    try {
      await logJobEvent(params.adminClient, params.job.id, "normalized", {
        stage: "cleanup_artifacts",
        transcript_cleared: true,
      });
    } catch {
      // Ignore cleanup event logging failures to avoid masking job outcome.
    }
  }
}
