import { useEffect, useState } from "react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { ImageOptionGrid } from "@/components/onboarding/ImageOptionGrid";
import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  DietOption,
  getOnboardingAnswers,
  saveOnboardingAnswers,
} from "@/lib/onboarding/answers";
import { setQuestionnaireStep } from "@/lib/onboarding/storage";
import { dietImages } from "@/lib/theme/onboarding";

export default function QuestionnaireDietScreen() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<DietOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void getOnboardingAnswers().then((answers) => setSelected(answers.diet));
  }, []);

  const dietOptions = [
    { id: "halal", label: t("dietHalal"), image: dietImages.halal },
    { id: "omnivore", label: t("dietOmnivore"), image: dietImages.omnivore },
    { id: "vegetarian", label: t("dietVegetarian"), image: dietImages.vegetarian },
    { id: "vegan", label: t("dietVegan"), image: dietImages.vegan },
    { id: "keto", label: t("dietKeto"), image: dietImages.keto },
    { id: "pescatarian", label: t("dietPescatarian"), image: dietImages.pescatarian },
  ];

  const handleToggle = (id: string) => {
    const option = id as DietOption;
    setSelected((prev) => {
      if (prev.includes(option)) {
        return prev.filter((item) => item !== option);
      }
      if (prev.length >= 2) {
        return prev;
      }
      return [...prev, option];
    });
  };

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      await saveOnboardingAnswers({ diet: selected });
      await setQuestionnaireStep(6);
      router.push("/(questionnaire)/allergies");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OnboardingScaffold
      title={t("qDietTitle")}
      subtitle={t("qDietSubtitle")}
      onBack={() => router.back()}
      onContinue={handleContinue}
      continueDisabled={isSaving}
    >
      <View style={styles.content}>
        <ImageOptionGrid
          options={dietOptions}
          selected={selected}
          onToggle={handleToggle}
          maxSelect={2}
        />
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    marginTop: 8,
  },
});
