import { useSegments } from "expo-router";
import { PostHogProvider } from "posthog-react-native";
import { useEffect, type ReactNode } from "react";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

import { posthog, setAppLanguage, trackScreen } from "./posthog";

/**
 * Records every screen that comes into view. The name is the route, not the address:
 * "/recipe/[id]" for every recipe, so screens can be counted together and nothing a
 * person shared or typed ends up in it.
 */
function ScreenTracker() {
  const segments: string[] = useSegments();
  const screen = `/${segments.join("/")}`;
  const { language } = useLanguage();

  useEffect(() => {
    setAppLanguage(language);
  }, [language]);

  useEffect(() => {
    trackScreen(screen);
  }, [screen]);

  return null;
}

/** Turns on PostHog for everything inside it: screens, taps, and opening or leaving the app. */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  if (!posthog) return <>{children}</>;

  return (
    // Screens are recorded by ScreenTracker; PostHog cannot follow expo-router by itself.
    <PostHogProvider client={posthog} autocapture={{ captureTouches: true, captureScreens: false }}>
      <ScreenTracker />
      {children}
    </PostHogProvider>
  );
}
