import { useState } from "react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { SelectionCard } from "@/components/onboarding/SelectionCard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { saveOnboardingAnswers, AgeRange } from "@/lib/onboarding/answers";
import { setOnboardingStep } from "@/lib/onboarding/storage";

const AGE_OPTIONS: { id: AgeRange; labelKey: string }[] = [
  { id: "<18", labelKey: "ageUnder18" },
  { id: "18-25", labelKey: "age18to25" },
  { id: "25-30", labelKey: "age25to30" },
  { id: "30-35", labelKey: "age30to35" },
  { id: "35-40", labelKey: "age35to40" },
  { id: "40+", labelKey: "age40plus" },
];

export default function AgeOnboardingScreen() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSelect = (id: string) => {
    setSelected(id);
  };

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      await saveOnboardingAnswers({ ageRange: selected as AgeRange | null });
      await setOnboardingStep(6);
      router.push("/(onboarding)/preferences");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OnboardingScaffold
      title={t("onStep6Title")}
      subtitle={t("onStep6Subtitle")}
      onBack={handleBack}
      onContinue={handleContinue}
      continueDisabled={isSaving}
    >
      <View style={styles.container}>
        {AGE_OPTIONS.map((option) => (
          <SelectionCard
            key={option.id}
            label={t(option.labelKey as any)}
            selected={selected === option.id}
            onPress={() => handleSelect(option.id)}
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
