import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { SetupChecklist } from "@/components/onboarding/SetupChecklist";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { setQuestionnaireStep } from "@/lib/onboarding/storage";

const STEP_DELAY = 850;

export default function ProcessingQuestionnaireScreen() {
  const { t } = useLanguage();
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    const timers = [1, 2, 3].map((count) =>
      setTimeout(() => setDoneCount(count), STEP_DELAY * count)
    );
    const finishTimer = setTimeout(async () => {
      await setQuestionnaireStep(8);
      router.replace("/(questionnaire)/demo");
    }, 3500);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finishTimer);
    };
  }, []);

  return (
    <OnboardingScaffold
      title={t("qProcessingTitle")}
      subtitle={t("qProcessingSubtitle")}
      showContinueButton={false}
    >
      <View style={styles.content}>
        <SetupChecklist
          items={[
            { label: t("qProcessingProfile"), done: doneCount >= 1 },
            { label: t("qProcessingImport"), done: doneCount >= 2 },
            { label: t("qProcessingPlan"), done: doneCount >= 3 },
          ]}
        />
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    marginTop: 42,
  },
});
