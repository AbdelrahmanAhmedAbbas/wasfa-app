import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { getQuestionnaireStep } from "@/lib/onboarding/storage";

const STEP_ROUTES = [
  "welcome",
  "goal",
  "pain",
  "proof",
  "solution",
  "diet",
  "allergies",
  "processing",
  "demo",
  "value",
  "setup",
] as const;

export default function QuestionnaireLayout() {
  const { isRTL } = useLanguage();
  const router = useRouter();
  const segments = useSegments();
  const [isResuming, setIsResuming] = useState(true);

  const animation =
    Platform.OS === "android"
      ? isRTL
        ? "ios_from_left"
        : "ios_from_right"
      : "default";

  useEffect(() => {
    let isMounted = true;

    async function resumeFlow() {
      const step = await getQuestionnaireStep();
      if (step > 0 && step < STEP_ROUTES.length) {
        const targetRoute = STEP_ROUTES[step];
        const currentSegment = segments[segments.length - 1];
        if (currentSegment !== targetRoute) {
          router.replace(`/(questionnaire)/${targetRoute}` as any);
        }
      }

      if (isMounted) {
        setIsResuming(false);
      }
    }

    void resumeFlow();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isResuming) {
    return null;
  }

  return (
    <Stack initialRouteName="welcome" screenOptions={{ headerShown: false, animation }}>
      {STEP_ROUTES.map((route) => (
        <Stack.Screen key={route} name={route} />
      ))}
    </Stack>
  );
}
