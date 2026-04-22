import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { SetupChecklist } from "@/components/onboarding/SetupChecklist";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { clearOnboardingAnswers, getOnboardingAnswers } from "@/lib/onboarding/answers";
import { saveOnboardingProfile } from "@/lib/onboarding/supabase";

type SetupStep = {
  id: string;
  labelKey: string;
  done: boolean;
};

const STEP_DELAY = 750;

export default function QuestionnaireSetupScreen() {
  const { t } = useLanguage();
  const { user, completeOnboarding } = useAuth();
  const [steps, setSteps] = useState<SetupStep[]>([
    { id: "answers", labelKey: "qSetupAnswers", done: false },
    { id: "profile", labelKey: "qSetupProfile", done: false },
    { id: "library", labelKey: "qSetupLibrary", done: false },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    void runSetup();
  }, []);

  const markStepDone = (stepId: string) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, done: true } : step))
    );
  };

  const runSetup = async () => {
    setError(null);

    try {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      const answers = await getOnboardingAnswers();

      await new Promise((resolve) => setTimeout(resolve, STEP_DELAY));
      markStepDone("answers");

      await new Promise((resolve) => setTimeout(resolve, STEP_DELAY));
      await saveOnboardingProfile(user.id, answers);
      markStepDone("profile");

      await new Promise((resolve) => setTimeout(resolve, STEP_DELAY));
      await clearOnboardingAnswers();
      await completeOnboarding();
      markStepDone("library");

      await new Promise((resolve) => setTimeout(resolve, 300));
      router.replace("/(tabs)");
    } catch (err) {
      console.error("Questionnaire setup error:", err);
      setError(err instanceof Error ? err.message : "Setup failed");
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setSteps([
      { id: "answers", labelKey: "qSetupAnswers", done: false },
      { id: "profile", labelKey: "qSetupProfile", done: false },
      { id: "library", labelKey: "qSetupLibrary", done: false },
    ]);
    await runSetup();
    setIsRetrying(false);
  };

  return (
    <OnboardingScaffold
      title={t("qSetupTitle")}
      subtitle={t("qSetupSubtitle")}
      showContinueButton={!!error}
      continueLabel={t("setupRetry")}
      onContinue={handleRetry}
      continueDisabled={isRetrying}
      onBack={error ? () => router.back() : undefined}
    >
      <View style={styles.container}>
        <SetupChecklist
          items={steps.map((step) => ({
            label: t(step.labelKey as any),
            done: step.done,
          }))}
        />

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
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
  },
  errorText: {
    fontSize: 14,
    color: "#D32F2F",
    textAlign: "center",
  },
});
