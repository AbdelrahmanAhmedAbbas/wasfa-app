import type { TranslationKey } from "@/lib/i18n/translations";

/** An import request the server rejected, with its machine-readable code when it sent one. */
export class ImportRequestError extends Error {
  code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "ImportRequestError";
    this.code = code;
  }
}

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
