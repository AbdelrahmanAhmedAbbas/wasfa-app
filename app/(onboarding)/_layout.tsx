import { Platform } from "react-native";
import { Stack } from "expo-router";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export default function OnboardingLayout() {
  const { isRTL } = useLanguage();
  const animation =
    Platform.OS === "android"
      ? isRTL
        ? "ios_from_left"
        : "ios_from_right"
      : "default";

  return (
    <Stack initialRouteName="welcome" screenOptions={{ headerShown: false, animation }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="source" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="location" />
      <Stack.Screen name="family" />
      <Stack.Screen name="frequency" />
      <Stack.Screen name="value" />
      <Stack.Screen name="results" />
      <Stack.Screen name="proof" />
      <Stack.Screen name="getstarted" />
    </Stack>
  );
}
