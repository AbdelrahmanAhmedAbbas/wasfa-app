import { ConvexReactClient } from "convex/react";
import { ConvexError } from "convex/values";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL || "";

/** False when the app was built without a Convex deployment URL; nothing can be loaded or saved then. */
export const isConvexConfigured = convexUrl.length > 0;

if (!isConvexConfigured) {
  console.warn("EXPO_PUBLIC_CONVEX_URL is not set. Sign-in and data will not work until it is.");
}

// The one client for the whole app. Sign-in attaches the user's token to it, so calls
// made outside React (the functions in lib/*/client.ts) run as the signed-in user.
export const convex = new ConvexReactClient(convexUrl || "https://not-configured.convex.cloud", {
  unsavedChangesWarning: false,
});

/**
 * The code and message of an error a server function raised on purpose, with anything
 * else it sent along, or null for any other failure.
 */
export function getServerError(
  error: unknown
): { code: string | null; message: string; details: Record<string, unknown> } | null {
  if (!(error instanceof ConvexError)) return null;
  const data = error.data as Record<string, unknown> | string | null;
  if (typeof data === "string") return { code: null, message: data, details: {} };
  return {
    code: typeof data?.code === "string" ? data.code : null,
    message: typeof data?.message === "string" ? data.message : "Request failed.",
    details: data ?? {},
  };
}
