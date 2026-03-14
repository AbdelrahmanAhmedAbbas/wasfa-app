import { useState } from "react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { SelectionCard } from "@/components/onboarding/SelectionCard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors } from "@/lib/theme/onboarding";
import { saveOnboardingAnswers, MeasurementSystem, NutritionDisplay } from "@/lib/onboarding/answers";
import { setOnboardingStep } from "@/lib/onboarding/storage";

export default function PreferencesOnboardingScreen() {
  const { t } = useLanguage();
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem | null>(null);
  const [nutritionDisplay, setNutritionDisplay] = useState<NutritionDisplay | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      await saveOnboardingAnswers({ measurementSystem, nutritionDisplay });
      await setOnboardingStep(7);
      router.push("/(onboarding)/setup");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OnboardingScaffold
      title={t("onStep7Title")}
      subtitle={t("onStep7Subtitle")}
      onBack={handleBack}
      onContinue={handleContinue}
      continueDisabled={isSaving}
    >
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Measurements</Text>
        <SelectionCard
          label={t("measurementImperial")}
          subtitle={t("measurementImperialDesc")}
          selected={measurementSystem === "imperial"}
          onPress={() => setMeasurementSystem("imperial")}
        />
        <SelectionCard
          label={t("measurementMetric")}
          subtitle={t("measurementMetricDesc")}
          selected={measurementSystem === "metric"}
          onPress={() => setMeasurementSystem("metric")}
        />

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Nutrition</Text>
        <SelectionCard
          label={t("nutritionShow")}
          subtitle={t("nutritionShowDesc")}
          selected={nutritionDisplay === "show"}
          onPress={() => setNutritionDisplay("show")}
        />
        <SelectionCard
          label={t("nutritionHide")}
          subtitle={t("nutritionHideDesc")}
          selected={nutritionDisplay === "hide"}
          onPress={() => setNutritionDisplay("hide")}
        />
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: onboardingColors.textMuted,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
