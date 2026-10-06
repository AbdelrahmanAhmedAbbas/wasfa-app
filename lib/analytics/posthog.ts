import PostHog from "posthog-react-native";

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY || "";
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/**
 * The one PostHog client for the whole app, or null when the app was bundled without
 * EXPO_PUBLIC_POSTHOG_KEY. Nothing is recorded then, which is how local runs stay out
 * of the numbers: leave the key out of .env.local.
 */
export const posthog = apiKey ? new PostHog(apiKey, { host, captureAppLifecycleEvents: true }) : null;

type EventProperties = Record<string, string | number | boolean | null>;

/** Records something the user did. Names are snake_case, past tense: "import_started". */
export function track(event: string, properties?: EventProperties): void {
  posthog?.capture(event, properties);
}

/** Records the screen now on show. */
export function trackScreen(name: string): void {
  void posthog?.screen(name);
}

/** Ties everything recorded on this device, before and after sign-in, to the account. */
export function identifyUser(user: { id: string; email: string | null; name: string | null }): void {
  posthog?.identify(user.id, { email: user.email, name: user.name });
}

/** Forgets the account on sign-out, so the next person on this device starts as a stranger. */
export function forgetUser(): void {
  posthog?.reset();
}

/** Sent with every event from now on: the app language the person is using. */
export function setAppLanguage(language: string): void {
  void posthog?.register({ app_language: language });
}
