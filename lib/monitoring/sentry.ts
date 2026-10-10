import * as Sentry from "@sentry/react-native";
import * as Updates from "expo-updates";

import { getServerError } from "@/lib/convex/client";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN || "";

/**
 * Follows the screens expo-router opens, so an error report shows the screens
 * that led to it. Registered with the navigation container in the root layout.
 */
export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

/**
 * Sends crashes, unhandled promise errors and errors reported with reportError to
 * Sentry. Nothing is sent when the app was bundled without EXPO_PUBLIC_SENTRY_DSN,
 * which keeps local runs out of the reports: leave the DSN out of .env.local.
 */
Sentry.init({
  dsn,
  enabled: dsn !== "",
  // The EAS build channel: production, preview or development.
  environment: Updates.channel || "development",
  // Account ids are attached by identifyErrorUser; emails and IP addresses are not sent.
  sendDefaultPii: false,
  integrations: [navigationIntegration],
  // A tenth of sessions are traced for slow screens; every error is still sent.
  tracesSampleRate: 0.1,
});

export const wrapRoot = Sentry.wrap;

type ErrorContext = {
  /** The part of the app that failed, snake_case: "price_estimate", "recipe_import". */
  feature: string;
  [key: string]: string | number | boolean | null | undefined;
};

/**
 * Records a failure the app caught and showed to the person. Crashes are sent on
 * their own; a caught error only reaches Sentry through here. An error a server
 * function raised on purpose is grouped by its code.
 */
export function reportError(error: unknown, { feature, ...extra }: ErrorContext): void {
  const serverError = getServerError(error);
  Sentry.captureException(error, {
    tags: { feature, ...(serverError?.code ? { server_code: serverError.code } : {}) },
    extra,
    ...(serverError?.code ? { fingerprint: ["{{ default }}", feature, serverError.code] } : {}),
  });
}

/** Ties the reports from this device to the account, by id only. */
export function identifyErrorUser(userId: string): void {
  Sentry.setUser({ id: userId });
}

/** Forgets the account on sign-out. */
export function forgetErrorUser(): void {
  Sentry.setUser(null);
}
