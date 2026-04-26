import { useEffect, useState } from "react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { SelectionCard } from "@/components/onboarding/SelectionCard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  AllergyOption,
  getOnboardingAnswers,
  saveOnboardingAnswers,
} from "@/lib/onboarding/answers";
import { setQuestionnaireStep } from "@/lib/onboarding/storage";

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

export default function QuestionnaireAllergiesScreen() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<AllergyOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void getOnboardingAnswers().then((answers) => setSelected(answers.allergies));
  }, []);

  const handleToggle = (id: AllergyOption) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      await saveOnboardingAnswers({ allergies: selected });
      await setQuestionnaireStep(7);
      router.push("/(questionnaire)/processing");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OnboardingScaffold
      title={t("qAllergiesTitle")}
      subtitle={t("qAllergiesSubtitle")}
      onBack={() => router.back()}
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
