import type { AppLanguage, TranslationKey } from "@/lib/i18n/translations";
import { toArabicIndicDigits } from "../recipes/numerals.ts";

/** An import request the server rejected, with its machine-readable code when it sent one. */
export class ImportRequestError extends Error {
  code: string | null;
  /** Anything else the server sent with the rejection, such as the daily limit. */
  details: Record<string, unknown>;

  constructor(message: string, code: string | null = null, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ImportRequestError";
    this.code = code;
    this.details = details;
  }
}

export const DAILY_IMPORT_LIMIT = "DAILY_IMPORT_LIMIT";

// Server error codes the app shows in its own language. A request rejected without a
// code keeps the server's message.
const LOCALIZED_IMPORT_ERRORS: Record<string, TranslationKey> = {
  YOUTUBE_NOT_A_SHORT: "importErrorYoutubeNotShort",
  SHORT_TOO_LONG: "importErrorShortTooLong",
  IMPORT_TIMED_OUT: "importErrorTimedOut",
  RECIPE_NOT_FOUND: "importErrorRecipeNotFound",
  TRANSCRIPTION_UNAVAILABLE: "importErrorTranscriptUnavailable",
  POST_UNAVAILABLE: "importErrorPostUnavailable",
  APIFY_FAILED: "importErrorPostUnavailable",
  TIKTOK_APIFY_FAILED: "importErrorPostUnavailable",
  MEDIA_NOT_AVAILABLE: "importErrorPostUnavailable",
  IMPORT_SERVICE_UNAVAILABLE: "importErrorServiceUnavailable",
  APIFY_NOT_CONFIGURED: "importErrorServiceUnavailable",
  RATE_LIMITED: "importErrorRateLimited",
  UNSUPPORTED_URL: "importErrorUnsupportedUrl",
};

export function getImportErrorCode(error: unknown): string | null {
  return error instanceof ImportRequestError ? error.code : null;
}

/** The plan's daily limit and when the next import opens up, when that is why the request was rejected. */
export function getDailyImportLimit(error: unknown): { limit: number; resetsAt: number } | null {
  if (!(error instanceof ImportRequestError) || error.code !== DAILY_IMPORT_LIMIT) return null;
  const { limit, resets_at: resetsAt } = error.details;
  if (typeof limit !== "number" || typeof resetsAt !== "number") return null;
  return { limit, resetsAt };
}

/** A time of day on the reader's own clock, such as "6:05 PM" or "٦:٠٥ م". */
export function formatTimeOfDay(timestamp: number, language: AppLanguage): string {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const clock = `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")}`;
  if (language === "ar") return `${toArabicIndicDigits(clock)} ${hours < 12 ? "ص" : "م"}`;
  return `${clock} ${hours < 12 ? "AM" : "PM"}`;
}

/** Fills a message's {count}, {limit} and {time} with the reader's digits and clock. */
export function fillImportLimitMessage(
  template: string,
  values: { count?: number; limit: number; resetsAt?: number | null },
  language: AppLanguage
): string {
  const digits = (value: number) => (language === "ar" ? toArabicIndicDigits(String(value)) : String(value));
  return template
    .replace("{count}", digits(values.count ?? values.limit))
    .replace("{limit}", digits(values.limit))
    .replace("{time}", values.resetsAt ? formatTimeOfDay(values.resetsAt, language) : "");
}

export function getImportErrorTranslationKey(code: string | null | undefined): TranslationKey | null {
  if (!code) return null;
  return Object.hasOwn(LOCALIZED_IMPORT_ERRORS, code) ? LOCALIZED_IMPORT_ERRORS[code] : null;
}

/**
 * The message for an import job that failed. Every failed job gets a message in the
 * reader's language: a code the app does not know falls back to a general one, never to
 * the server's English text.
 */
export function getJobFailureTranslationKey(code: string | null | undefined): TranslationKey {
  return getImportErrorTranslationKey(code) ?? "importErrorGeneric";
}
