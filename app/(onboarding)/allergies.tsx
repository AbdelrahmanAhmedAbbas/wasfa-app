import { useState } from "react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { SelectionCard } from "@/components/onboarding/SelectionCard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors } from "@/lib/theme/onboarding";
import { saveOnboardingAnswers, AllergyOption } from "@/lib/onboarding/answers";
import { setOnboardingStep } from "@/lib/onboarding/storage";

const ALLERGY_OPTIONS: { id: AllergyOption; labelKey: string }[] = [
  { id: "shellfish", labelKey: "allergyShellfish" },
  { id: "seafood", labelKey: "allergySeafood" },
  { id: "dairy", labelKey: "allergyDairy" },
  { id: "peanut", labelKey: "allergyPeanut" },
  { id: "tree_nut", labelKey: "allergyTreeNut" },
  { id: "egg", labelKey: "allergyEgg" },
  { id: "gluten", labelKey: "allergyGluten" },
  { id: "wheat", labelKey: "allergyWheat" },
];

export default function AllergiesOnboardingScreen() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      await saveOnboardingAnswers({ allergies: selected as AllergyOption[] });
      await setOnboardingStep(4);
      router.push("/(onboarding)/source");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OnboardingScaffold
      title={t("onStep4Title")}
      subtitle={t("onStep4Subtitle")}
      onBack={handleBack}
      onContinue={handleContinue}
      continueDisabled={isSaving}
    >
      <View style={styles.container}>
        {ALLERGY_OPTIONS.map((option) => (
          <SelectionCard
            key={option.id}
            label={t(option.labelKey as any)}
            selected={selected.includes(option.id)}
            onPress={() => handleToggle(option.id)}
          />
        ))}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
});
