// Turns a failure inside the import pipeline into the code and message stored on the job.
// The app shows its own translated text for each code; the message is the English fallback.

/** True when the AI provider refused the request because the account is out of credit. */
export function isProviderCreditError(error: unknown): boolean {
  return /\b402\b|requires more credits|requires at least \$|insufficient credits/i.test(String(error));
}

// Shown when the source text has no recipe and the transcript is missing for a reason
// that a later attempt can fix.
const TRANSCRIPT_UNAVAILABLE_ERROR = {
  code: "TRANSCRIPTION_UNAVAILABLE",
  message: "We couldn't listen to this video right now. Please try again in a few minutes.",
};

const RECIPE_NOT_FOUND_ERROR = {
  code: "RECIPE_NOT_FOUND",
  message:
    "We couldn't find a recipe in this video. The ingredients need to be spoken in the video or written in its caption.",
};

const POST_UNAVAILABLE_MESSAGE =
  "We couldn't open this post. It may be private or deleted, or the link may be wrong.";

export function mapPipelineError(
  error: unknown,
  context: { transcriptUnavailable?: boolean } = {}
): { code: string; message: string } {
  const raw = String(error);
  if (raw.includes("SHORT_TOO_LONG")) {
    return {
      code: "SHORT_TOO_LONG",
      message: "This video is longer than 3 minutes. Only YouTube Shorts can be imported.",
    };
  }
  if (raw.includes("APIFY_TOKEN_MISSING")) {
    return {
      code: "APIFY_NOT_CONFIGURED",
      message: "APIFY_TOKEN is not set on the server.",
    };
  }
  if (raw.includes("TIKTOK_APIFY_FAILED")) {
    return { code: "TIKTOK_APIFY_FAILED", message: POST_UNAVAILABLE_MESSAGE };
  }
  if (raw.includes("APIFY_RUN_FAILED") || raw.includes("APIFY_TIMEOUT") || raw.includes("APIFY_INVALID_JSON")) {
    return { code: "APIFY_FAILED", message: POST_UNAVAILABLE_MESSAGE };
  }
  if (raw.includes("POST_NOT_FOUND")) {
    return { code: "POST_UNAVAILABLE", message: POST_UNAVAILABLE_MESSAGE };
  }
  if (
    raw.includes("RECIPE_NOT_IN_SOURCE") ||
    raw.includes("INSUFFICIENT_TEXT_CONTEXT") ||
    raw.includes("Generated recipe did not pass")
  ) {
    return context.transcriptUnavailable ? TRANSCRIPT_UNAVAILABLE_ERROR : RECIPE_NOT_FOUND_ERROR;
  }
  if (isProviderCreditError(error)) {
    return {
      code: "IMPORT_SERVICE_UNAVAILABLE",
      message: "Recipe import is temporarily unavailable. Please try again later.",
    };
  }
  if (raw.includes("OPENROUTER_TIMEOUT")) {
    return {
      code: "AI_EXTRACTION_FAILED",
      message: "The recipe import provider timed out before finishing the recipe.",
    };
  }
  return {
    code: "AI_EXTRACTION_FAILED",
    message: "Automatic extraction failed for this video URL. Please try another URL.",
  };
}
