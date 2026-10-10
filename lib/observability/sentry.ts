import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// Leave the DSN unset in local development to keep local errors out of launch data.
if (dsn) {
  Sentry.init({
    dsn,
    enabled: !__DEV__,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

export function setCrashUser(userId: string | null): void {
  if (dsn) Sentry.setUser(userId ? { id: userId } : null);
}

export const withCrashReporting = dsn ? Sentry.wrap : <T,>(component: T): T => component;
