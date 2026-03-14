import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { getOnboardingStep } from "@/lib/onboarding/storage";
import { useAuth } from "@/lib/auth/AuthProvider";

const STEP_ROUTES = [
  "welcome",
  "savings",
  "diet",
  "allergies",
  "source",
  "age",
  "preferences",
  "setup",
] as const;

export default function OnboardingLayout() {
  const { isRTL } = useLanguage();
  const router = useRouter();
  const segments = useSegments();
  const { hasCompletedOnboarding } = useAuth();
  const [isResuming, setIsResuming] = useState(true);

  const animation =
    Platform.OS === "android"
      ? isRTL
        ? "ios_from_left"
        : "ios_from_right"
      : "default";

  useEffect(() => {
    const resumeFlow = async () => {
      if (hasCompletedOnboarding) {
        setIsResuming(false);
        return;
      }

      const step = await getOnboardingStep();
      if (step > 0 && step < STEP_ROUTES.length) {
        const targetRoute = STEP_ROUTES[step];
        const currentSegment = segments[segments.length - 1];
        if (currentSegment !== targetRoute) {
          router.replace(`/(onboarding)/${targetRoute}` as any);
        }
      }
      setIsResuming(false);
    };

    resumeFlow();
  }, [hasCompletedOnboarding]);

  if (isResuming) {
    return null;
  }

  return (
    <Stack initialRouteName="welcome" screenOptions={{ headerShown: false, animation }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="savings" />
      <Stack.Screen name="diet" />
      <Stack.Screen name="allergies" />
      <Stack.Screen name="source" />
      <Stack.Screen name="age" />
      <Stack.Screen name="preferences" />
      <Stack.Screen name="setup" />
    </Stack>
  );
}
