import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { getResumeRoute, STEP_ROUTES } from "@/lib/onboarding/flow";
import { getQuestionnaireStep } from "@/lib/onboarding/storage";

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
      // Only a launch that lands on the first step is resumed. Explicit
      // entries (e.g. the paywall opening "ready") stay where they were sent.
      const currentSegment = segments[segments.length - 1];
      if (currentSegment === STEP_ROUTES[0]) {
        const targetRoute = getResumeRoute(await getQuestionnaireStep());
        if (targetRoute) {
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
    <Stack initialRouteName={STEP_ROUTES[0]} screenOptions={{ headerShown: false, animation }}>
      {STEP_ROUTES.map((route) => (
        <Stack.Screen key={route} name={route} />
      ))}
    </Stack>
  );
}
