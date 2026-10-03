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

// Server error codes the app shows in its own language. Any other failure keeps the
// server's message.
const LOCALIZED_IMPORT_ERRORS: Record<string, TranslationKey> = {
  YOUTUBE_NOT_A_SHORT: "importErrorYoutubeNotShort",
  SHORT_TOO_LONG: "importErrorShortTooLong",
  IMPORT_TIMED_OUT: "importErrorTimedOut",
};

export function getImportErrorCode(error: unknown): string | null {
  return error instanceof ImportRequestError ? error.code : null;
}

export function getImportErrorTranslationKey(code: string | null | undefined): TranslationKey | null {
  if (!code) return null;
  return Object.hasOwn(LOCALIZED_IMPORT_ERRORS, code) ? LOCALIZED_IMPORT_ERRORS[code] : null;
}
