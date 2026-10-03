// YouTube's own upper bound for a Short.
export const SHORT_MAX_DURATION_SECONDS = 180;

export const DEFAULT_APIFY_ACTOR_YOUTUBE = "streamers~youtube-scraper";

// Downloads a Short's audio so it can be transcribed the way an Instagram reel is.
export const DEFAULT_APIFY_ACTOR_YOUTUBE_AUDIO = "marielise.dev~youtube-video-downloader";
// The audio actor bills per minute; three minutes of MP3 is the most a Short can cost.
export const YOUTUBE_AUDIO_MAX_CHARGE_USD = 0.05;

// Hosts a Short can be shared from. Matched exactly so other YouTube properties
// (music.youtube.com, youtube-nocookie.com) are not accepted by accident.
const SHORT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

const SHORT_PATH_PATTERN = /^\/shorts\/([A-Za-z0-9_-]{11})\/?$/;

function parseHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isYouTubeShortHost(hostname: string): boolean {
  return SHORT_HOSTS.has(hostname.toLowerCase());
}

/** True for any YouTube-owned link, including the forms that are not importable. */
export function isYouTubeUrl(url: string): boolean {
  const host = parseHost(url);
  if (!host) return false;
  return (
    host === "youtu.be" ||
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtube-nocookie.com" ||
    host.endsWith(".youtube-nocookie.com")
  );
}

/** Returns the video id when the link is a Short (`/shorts/<id>` on an accepted host). */
export function parseYouTubeShortId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!isYouTubeShortHost(parsed.hostname)) return null;
    const match = parsed.pathname.match(SHORT_PATH_PATTERN);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** The one stored form of a Short's link, so dedupe and the extraction cache see a single URL. */
export function canonicalYouTubeShortUrl(videoId: string): string {
  return `https://www.youtube.com/shorts/${videoId}`;
}

export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Reads a duration as seconds from the shapes scrapers return: a number of seconds,
 * a clock string ("00:03:17", "3:17", "45") or ISO 8601 ("PT1M5S").
 */
export function parseDurationSeconds(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^\d+(?::\d{1,2}){0,2}$/.test(trimmed)) {
    return trimmed.split(":").reduce((total, part) => total * 60 + Number(part), 0);
  }

  const iso = trimmed.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (iso && (iso[1] || iso[2] || iso[3])) {
    return Number(iso[1] ?? 0) * 3600 + Number(iso[2] ?? 0) * 60 + Math.round(Number(iso[3] ?? 0));
  }

  return undefined;
}

/** The linked video is always sent in watch form, which both actors accept. */
function youTubeLinkForServices(sourceUrl: string): string {
  const videoId = parseYouTubeShortId(sourceUrl);
  return videoId ? youTubeWatchUrl(videoId) : sourceUrl;
}

/** Input for the Apify YouTube actor: one video, with its paid subtitle options left off. */
export function buildYouTubeActorInput(sourceUrl: string): Record<string, unknown> {
  return {
    startUrls: [{ url: youTubeLinkForServices(sourceUrl) }],
    maxResults: 1,
    maxResultsShorts: 1,
    maxResultStreams: 0,
  };
}

/** Input for the Apify audio actor: the Short as MP3, with its paid proxy fallback left off. */
export function buildYouTubeAudioActorInput(sourceUrl: string): Record<string, unknown> {
  return {
    urls: [{ url: youTubeLinkForServices(sourceUrl) }],
    format: "mp3",
    residentialProxyMode: "disabled",
  };
}
