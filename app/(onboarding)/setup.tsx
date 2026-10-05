import { useEffect, useState } from "react";
import { router } from "expo-router";
import { StyleSheet, View, Pressable, ActivityIndicator } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { SetupChecklist } from "@/components/onboarding/SetupChecklist";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors } from "@/lib/theme/onboarding";
import { getOnboardingAnswers, clearOnboardingAnswers } from "@/lib/onboarding/answers";
import { saveOnboardingProfile } from "@/lib/onboarding/profile";
import { useAuth } from "@/lib/auth/AuthProvider";

type SetupStep = {
  id: string;
  labelKey: string;
  done: boolean;
};

const STEP_DELAY = 800;

export default function SetupOnboardingScreen() {
  const { t } = useLanguage();
  const { user, completeOnboarding } = useAuth();
  const [steps, setSteps] = useState<SetupStep[]>([
    { id: "dietary", labelKey: "setupDietaryPrefs", done: false },
    { id: "app", labelKey: "setupAppPrefs", done: false },
    { id: "recommendations", labelKey: "setupRecommendations", done: false },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    runSetup();
  }, []);

  const markStepDone = (stepId: string) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, done: true } : step
      )
    );
  };

  const runSetup = async () => {
    setError(null);

    try {
      const answers = await getOnboardingAnswers();

      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      await new Promise((resolve) => setTimeout(resolve, STEP_DELAY));
      markStepDone("dietary");

      await new Promise((resolve) => setTimeout(resolve, STEP_DELAY));
      await saveOnboardingProfile(user.id, answers);
      markStepDone("app");

      await new Promise((resolve) => setTimeout(resolve, STEP_DELAY));
      await clearOnboardingAnswers();
      await completeOnboarding();
      markStepDone("recommendations");

      await new Promise((resolve) => setTimeout(resolve, 300));
      router.replace("/(tabs)");
    } catch (err) {
      console.error("Setup error:", err);
      setError(err instanceof Error ? err.message : "Setup failed");
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setSteps([
      { id: "dietary", labelKey: "setupDietaryPrefs", done: false },
      { id: "app", labelKey: "setupAppPrefs", done: false },
      { id: "recommendations", labelKey: "setupRecommendations", done: false },
    ]);
    await runSetup();
    setIsRetrying(false);
  };

  const checklistItems = steps.map((step) => ({
    label: t(step.labelKey as any),
    done: step.done,
  }));

  return (
    <OnboardingScaffold
      title={t("onStep8Title")}
      subtitle={t("onStep8Subtitle")}
      showContinueButton={!!error}
      continueLabel={t("setupRetry")}
      onContinue={handleRetry}
      continueDisabled={isRetrying}
      onBack={error ? () => router.back() : undefined}
    >
      <View style={styles.container}>
        <SetupChecklist items={checklistItems} />

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
  },
  errorContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#D32F2F",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: onboardingColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: 120,
    alignItems: "center",
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: onboardingColors.textOnDark,
  },
});
