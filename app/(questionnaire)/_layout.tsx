import { Platform } from "react-native";
import { Stack } from "expo-router";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { STEP_ROUTES } from "@/lib/onboarding/flow";

// The opening screen (app/index.tsx) picks the step to resume at.
export default function QuestionnaireLayout() {
  const { isRTL } = useLanguage();

  const animation =
    Platform.OS === "android"
      ? isRTL
        ? "ios_from_left"
        : "ios_from_right"
      : "default";

  return (
    <Stack initialRouteName={STEP_ROUTES[0]} screenOptions={{ headerShown: false, animation }}>
      {STEP_ROUTES.map((route) => (
        <Stack.Screen key={route} name={route} />
      ))}
    </Stack>
  );
}
