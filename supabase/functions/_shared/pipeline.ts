import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { estimateNutrition, extractRecipe } from "./ai.ts";
import {
  confirmRecipeFromDraft,
  logJobEvent,
  updateJobStatus,
  upsertRecipeDraft,
} from "./db.ts";
import type { ImportJobRow } from "./types.ts";

const OPENROUTER_TRANSCRIBE_MODEL = "google/gemini-2.0-flash-001";
// Allow reasonably large source downloads so we can still extract metadata/captions
// even when transcription upload limits are lower.
const MAX_MEDIA_DOWNLOAD_BYTES = 64 * 1024 * 1024;
// Transcription: upload and transcribe whenever we have media, up to API limit (OpenAI 25 MB).
const MAX_TRANSCRIPTION_UPLOAD_BYTES = 25 * 1024 * 1024;
const APIFY_ACTOR_ID = "nH2AHrwxeTRJoN5hX";

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
  mediaOrigin?: "opengraph" | "apify";
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env variable: ${name}`);
  return value;
}

function extractMetaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const match = html.match(regex);
  return match?.[1]?.trim() || null;
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
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
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

async function safeFetch(url: string): Promise<Response | null> {
  try {
    return await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (MealPlannerBot/1.0)",
      },
      redirect: "follow",
    });
  } catch {
    return null;
  }
}

async function fetchOEmbedMetadata(sourceUrl: string): Promise<Partial<SourceMetadata>> {
  const endpoint = `https://noembed.com/embed?url=${encodeURIComponent(sourceUrl)}`;
  const response = await safeFetch(endpoint);
  if (!response?.ok) return {};

  try {
    const data = await response.json();
    return {
      title: typeof data?.title === "string" ? data.title : undefined,
      description: typeof data?.author_name === "string" ? `By ${data.author_name}` : undefined,
    };
  } catch {
    return {};
  }
}

async function fetchOpenGraphMetadata(sourceUrl: string): Promise<Partial<SourceMetadata>> {
  const response = await safeFetch(sourceUrl);
  if (!response?.ok) return {};

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return {};

  const html = await response.text();
  const ogTitle = extractMetaContent(html, "og:title");
  const ogDescription = extractMetaContent(html, "og:description");
  const twitterDescription = extractMetaContent(html, "twitter:description");
  const description = extractMetaContent(html, "description");
  const ogVideoSecure = extractMetaContent(html, "og:video:secure_url");
  const ogVideo = extractMetaContent(html, "og:video");
  const twitterStream = extractMetaContent(html, "twitter:player:stream");
  const ogImageSecure = extractMetaContent(html, "og:image:secure_url");
  const ogImage = extractMetaContent(html, "og:image");
  const twitterImage = extractMetaContent(html, "twitter:image");
  const mediaType =
    extractMetaContent(html, "og:video:type") ||
    extractMetaContent(html, "twitter:player:stream:content_type") ||
    undefined;

  return {
    title: ogTitle || undefined,
    description: ogDescription || twitterDescription || description || undefined,
    caption: ogDescription || twitterDescription || description || undefined,
    mediaUrl: ogVideoSecure || ogVideo || twitterStream || undefined,
    mediaType,
    thumbnailUrl: ogImageSecure || ogImage || twitterImage || undefined,
  };
}

async function fetchSourceMetadata(sourceUrl: string): Promise<SourceMetadata> {
  const [oembed, openGraph] = await Promise.all([
    fetchOEmbedMetadata(sourceUrl),
    fetchOpenGraphMetadata(sourceUrl),
  ]);

  return {
    title: openGraph.title || oembed.title,
    description: openGraph.description || oembed.description,
    caption: openGraph.caption,
    mediaUrl: openGraph.mediaUrl,
    mediaType: openGraph.mediaType,
    mediaOrigin: openGraph.mediaUrl ? "opengraph" : undefined,
  };
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

async function fetchApifyMetadata(sourceUrl: string): Promise<Partial<SourceMetadata>> {
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) {
    throw new Error("APIFY_TOKEN_MISSING");
  }

  const response = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?format=json&clean=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apifyToken}`,
      },
      body: JSON.stringify({
        resultsLimit: 24,
        skipPinnedPosts: false,
        username: [sourceUrl],
      }),
    }
  );

  const rawBody = await response.text();
  console.log("[import][apify] run-sync response", {
    status: response.status,
    ok: response.ok,
    bytes: rawBody.length,
    url: sourceUrl,
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
      url: sourceUrl,
      error: String(error),
      preview: truncateForLog(rawBody, 1500),
    });
    throw new Error("APIFY_INVALID_JSON");
  }

  const record = extractApifyPrimaryRecord(payload);
  const videoUrl = sanitizeHttpUrl(record?.videoUrl);
  const audioUrl = sanitizeHttpUrl(record?.audioUrl);
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
          "downloadurl",
          "downloadvideourl",
          "playaddr",
          "mediaurl",
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
    findFirstStringByKeys(payload, new Set(["caption", "description", "text", "videodescription"]));
  const firstComment =
    asString(record?.firstComment) ||
    (record ? extractApifyLatestComment(record) : undefined);
  const hashtags = asStringArray(record?.hashtags);
  const sourcePostId = asString(record?.id);
  const shortCode = asString(record?.shortCode);
  const creatorUsername = asString(record?.ownerUsername);
  const postedAt = asString(record?.timestamp);
  const videoDurationSeconds = asNumber(record?.videoDuration);
  const likesCount = asNumber(record?.likesCount);
  const commentsCount = asNumber(record?.commentsCount);
  const videoViewCount = asNumber(record?.videoViewCount);
  const videoPlayCount = asNumber(record?.videoPlayCount);
  const thumbnailUrl =
    sanitizeHttpUrl(asString(record?.thumbnailUrl)) ||
    sanitizeHttpUrl(asString(record?.displayUrl)) ||
    sanitizeHttpUrl(asString(record?.coverUrl)) ||
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

async function downloadMediaForTranscription(metadata: SourceMetadata): Promise<{
  buffer: Uint8Array;
  mimeType: string;
  filename: string;
}> {
  if (!metadata.mediaUrl) {
    console.error("[import][download] no mediaUrl in metadata");
    throw new Error("MEDIA_NOT_AVAILABLE");
  }

  console.log("[import][download] fetching media", {
    mediaUrl: metadata.mediaUrl.slice(0, 200),
    mediaType: metadata.mediaType,
    mediaOrigin: metadata.mediaOrigin,
  });

  const response = await safeFetch(metadata.mediaUrl);
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

async function transcribeWithOpenRouter(media: {
  buffer: Uint8Array;
  mimeType: string;
  filename: string;
}): Promise<string> {
  const apiKey = requiredEnv("OPENROUTER_API_KEY");

  const base64Data = uint8ToBase64(media.buffer);

  const audioFormat = media.mimeType.includes("mp4")
    ? "mp4"
    : media.mimeType.includes("m4a")
      ? "m4a"
      : media.mimeType.includes("webm")
        ? "webm"
        : media.mimeType.includes("wav")
          ? "wav"
          : media.mimeType.includes("mp3") || media.mimeType.includes("mpeg")
            ? "mp3"
            : "mp4";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://meal-planner.app",
      "X-Title": "Meal Planner Import",
    },
    body: JSON.stringify({
      model: OPENROUTER_TRANSCRIBE_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcribe all spoken words in this audio/video exactly as said. Return ONLY the transcript text, nothing else. If the speech is in Arabic or any non-English language, transcribe it in that language.",
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
  });

  const body = await response.text();
  if (!response.ok) {
    console.error("[import][openrouter-transcribe] failed", {
      status: response.status,
      body: truncateForLog(body, 800),
      fileBytes: media.buffer.byteLength,
      format: audioFormat,
    });
    if (response.status === 413) {
      throw new Error(`MEDIA_TOO_LARGE_OPENROUTER ${truncateForLog(body, 1200)}`);
    }
    throw new Error(`TRANSCRIPTION_FAILED ${response.status} ${body}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = JSON.parse(body);
  } catch {
    console.error("[import][openrouter-transcribe] invalid json", {
      body: truncateForLog(body, 500),
    });
    throw new Error(`TRANSCRIPTION_FAILED 200 invalid_json ${body}`);
  }

  const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    console.warn("[import][openrouter-transcribe] empty text", { body: truncateForLog(body, 300) });
    throw new Error("TRANSCRIPTION_EMPTY");
  }
  return text;
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
    lines.push("Transcript: unavailable (transcription skipped).");
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

function isTranscriptionOversizeError(error: unknown): boolean {
  const raw = String(error);
  return (
    raw.includes("MEDIA_TOO_LARGE") ||
    raw.includes("MEDIA_TOO_LARGE_OPENROUTER") ||
    raw.includes("TRANSCRIPTION_FAILED 413")
  );
}

function mapPipelineError(error: unknown): { code: string; message: string } {
  const raw = String(error);
  if (raw.includes("MEDIA_NOT_AVAILABLE")) {
    return {
      code: "MEDIA_NOT_AVAILABLE",
      message: "Could not resolve a downloadable media URL from this post.",
    };
  }
  if (raw.includes("APIFY_RUN_FAILED")) {
    return {
      code: "APIFY_FAILED",
      message: "Apify scraping failed while resolving this media URL.",
    };
  }
  if (raw.includes("APIFY_TOKEN_MISSING")) {
    return {
      code: "APIFY_NOT_CONFIGURED",
      message: "APIFY_TOKEN is missing in Edge Function secrets.",
    };
  }
  if (raw.includes("APIFY_INVALID_JSON")) {
    return {
      code: "APIFY_FAILED",
      message: "Apify returned an invalid response payload.",
    };
  }
  if (raw.includes("MEDIA_DOWNLOAD_FAILED")) {
    return {
      code: "MEDIA_NOT_AVAILABLE",
      message: "Found a media URL but failed to download it.",
    };
  }
  if (raw.includes("MEDIA_DOWNLOAD_TOO_LARGE")) {
    return {
      code: "MEDIA_TOO_LARGE",
      message: "Media file is too large to download in the current pipeline limits.",
    };
  }
  if (raw.includes("MEDIA_TOO_LARGE")) {
    return {
      code: "MEDIA_TOO_LARGE",
      message: "Media file is too large for transcription upload limits.",
    };
  }
  if (raw.includes("TRANSCRIPTION_REQUIRED")) {
    return {
      code: "TRANSCRIPTION_FAILED",
      message:
        "Could not produce a transcript for this media. Transcript is required for extraction.",
    };
  }
  if (raw.includes("INSUFFICIENT_CONTEXT_AFTER_TRANSCRIPTION_SKIP")) {
    return {
      code: "TRANSCRIPTION_FAILED",
      message:
        "Transcription couldn't be used and the post has no caption or text to extract a recipe from. Try a link that has a caption or description.",
    };
  }
  if (raw.includes("MEDIA_TYPE_NOT_SUPPORTED")) {
    return {
      code: "MEDIA_TYPE_NOT_SUPPORTED",
      message: "Resolved media type is not supported for transcription.",
    };
  }
  if (raw.includes("TRANSCRIPTION")) {
    return {
      code: "TRANSCRIPTION_FAILED",
      message: "Audio transcription failed for this media.",
    };
  }
  if (raw.includes("Generated recipe did not pass validation")) {
    return {
      code: "PARSER_SCHEMA_FAILED",
      message: "Recipe parser output did not meet schema requirements.",
    };
  }
  return {
    code: "AI_EXTRACTION_FAILED",
    message: "Automatic extraction failed for this video URL. Please try another URL.",
  };
}

export async function runImportPipeline(params: {
  adminClient: SupabaseClient;
  job: ImportJobRow;
  sharedText?: string | null;
}) {
  let mediaBuffer: Uint8Array | null = null;
  let transcript: string | null = null;

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

    let metadata = await fetchSourceMetadata(params.job.source_url);
    let apifyUsed = false;
    if (!metadata.mediaUrl) {
      const apifyMetadata = await fetchApifyMetadata(params.job.source_url);
      if (apifyMetadata.mediaUrl || apifyMetadata.caption || apifyMetadata.title) {
        metadata = {
          title: metadata.title || apifyMetadata.title,
          description: metadata.description || apifyMetadata.description,
          caption: metadata.caption || apifyMetadata.caption,
          firstComment: metadata.firstComment || apifyMetadata.firstComment,
          hashtags: metadata.hashtags?.length ? metadata.hashtags : apifyMetadata.hashtags,
          sourcePostId: metadata.sourcePostId || apifyMetadata.sourcePostId,
          shortCode: metadata.shortCode || apifyMetadata.shortCode,
          creatorUsername: metadata.creatorUsername || apifyMetadata.creatorUsername,
          postedAt: metadata.postedAt || apifyMetadata.postedAt,
          videoDurationSeconds: metadata.videoDurationSeconds || apifyMetadata.videoDurationSeconds,
          likesCount: metadata.likesCount || apifyMetadata.likesCount,
          commentsCount: metadata.commentsCount || apifyMetadata.commentsCount,
          videoViewCount: metadata.videoViewCount || apifyMetadata.videoViewCount,
          videoPlayCount: metadata.videoPlayCount || apifyMetadata.videoPlayCount,
          mediaUrl: metadata.mediaUrl || apifyMetadata.mediaUrl,
          mediaType: metadata.mediaType || apifyMetadata.mediaType,
          thumbnailUrl: metadata.thumbnailUrl || apifyMetadata.thumbnailUrl,
          mediaOrigin: metadata.mediaOrigin || apifyMetadata.mediaOrigin,
        };
        apifyUsed = !!apifyMetadata.mediaUrl;
      }
    }

    await logJobEvent(params.adminClient, params.job.id, "normalized", {
      stage: "metadata_fetch",
      has_media_candidate: !!metadata.mediaUrl,
      has_title: !!metadata.title,
      has_caption: !!metadata.caption,
      has_first_comment: !!metadata.firstComment,
      hashtags_count: metadata.hashtags?.length ?? 0,
      media_origin: metadata.mediaOrigin ?? null,
      has_thumbnail: !!metadata.thumbnailUrl,
      apify_used: apifyUsed,
    });

    await logJobEvent(params.adminClient, params.job.id, "normalized", {
      stage: "media_access_check",
      media_url_present: !!metadata.mediaUrl,
      media_type: metadata.mediaType ?? null,
    });

    let transcriptionSkippedReason: string | null = null;
    try {
      const media = await downloadMediaForTranscription(metadata);
      mediaBuffer = media.buffer;
      const mediaEligibleForTranscription =
        media.buffer.byteLength <= MAX_TRANSCRIPTION_UPLOAD_BYTES;
      await logJobEvent(params.adminClient, params.job.id, "normalized", {
        stage: "audio_extract",
        mime_type: media.mimeType,
        media_bytes: media.buffer.byteLength,
        transcription_eligible: mediaEligibleForTranscription,
        transcription_upload_limit_bytes: MAX_TRANSCRIPTION_UPLOAD_BYTES,
      });

      if (mediaEligibleForTranscription) {
        transcript = await transcribeWithOpenRouter(media);
        await logJobEvent(params.adminClient, params.job.id, "normalized", {
          stage: "openrouter_transcribe",
          transcript_length: transcript.length,
          model: OPENROUTER_TRANSCRIBE_MODEL,
        });
      } else {
        transcriptionSkippedReason = "media_too_large_for_transcription_upload";
        transcript = null;
        await logJobEvent(params.adminClient, params.job.id, "normalized", {
          stage: "openrouter_transcribe_skipped",
          reason: transcriptionSkippedReason,
          model: OPENROUTER_TRANSCRIBE_MODEL,
          media_bytes: media.buffer.byteLength,
          transcription_upload_limit_bytes: MAX_TRANSCRIPTION_UPLOAD_BYTES,
        });
      }
    } catch (error) {
      transcriptionSkippedReason = isTranscriptionOversizeError(error)
        ? "media_too_large"
        : "transcription_error";
      transcript = null;
      await logJobEvent(params.adminClient, params.job.id, "normalized", {
        stage: "openrouter_transcribe_failed",
        reason: transcriptionSkippedReason,
        model: OPENROUTER_TRANSCRIBE_MODEL,
        details: truncateForLog(String(error), 1200),
      });
    }

    if (!transcript?.trim()) {
      throw new Error("TRANSCRIPTION_REQUIRED");
    }

    if (
      !hasExtractionTextContext({
        metadata,
        sharedText: params.sharedText,
        transcript,
      })
    ) {
      if (transcriptionSkippedReason) {
        throw new Error("INSUFFICIENT_CONTEXT_AFTER_TRANSCRIPTION_SKIP");
      }
      throw new Error("INSUFFICIENT_TEXT_CONTEXT");
    }

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
    });

    const nutrition = await estimateNutrition(extraction.draft);

    const enrichedDraft = {
      ...extraction.draft,
      nutrition_estimate: nutrition,
    };
    await logJobEvent(params.adminClient, params.job.id, "normalized", {
      stage: "gemini_localize_en_ar",
      has_localized_ar: !!enrichedDraft.localized?.ar,
      has_localized_en: !!enrichedDraft.localized?.en,
    });

    await logJobEvent(params.adminClient, params.job.id, "normalized", {
      stage: "save_draft",
    });
    await upsertRecipeDraft(params.adminClient, {
      jobId: params.job.id,
      userId: params.job.user_id,
      payload: enrichedDraft,
      confidence: {
        ...extraction.confidence,
        transcription_model: transcript ? OPENROUTER_TRANSCRIBE_MODEL : null,
        transcription_provider: transcript ? "openrouter" : "skipped",
        transcription_chars: transcript?.length ?? 0,
        transcription_skipped: !transcript,
        nutrition_provider: extraction.provider,
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
    });

    await logJobEvent(params.adminClient, params.job.id, "ai_extracted", {
      provider: extraction.provider,
      model: extraction.model,
      ingredient_count: enrichedDraft.ingredients.length,
      step_count: enrichedDraft.steps.length,
      has_localized_ar: !!enrichedDraft.localized?.ar,
      has_localized_en: !!enrichedDraft.localized?.en,
      recipe_id: recipeId,
    });
  } catch (error) {
    const mapped = mapPipelineError(error);
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
    mediaBuffer = null;
    transcript = null;
    try {
      await logJobEvent(params.adminClient, params.job.id, "normalized", {
        stage: "cleanup_artifacts",
        media_cleared: true,
        transcript_cleared: true,
      });
    } catch {
      // Ignore cleanup event logging failures to avoid masking job outcome.
    }
  }
}
