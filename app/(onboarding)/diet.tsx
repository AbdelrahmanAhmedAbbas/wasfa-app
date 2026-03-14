import { useState } from "react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { ImageOptionGrid } from "@/components/onboarding/ImageOptionGrid";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors, dietImages } from "@/lib/theme/onboarding";
import { saveOnboardingAnswers, DietOption } from "@/lib/onboarding/answers";
import { setOnboardingStep } from "@/lib/onboarding/storage";

const mascotImage = require("../../assets/images/mascot.png");

export default function DietOnboardingScreen() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const dietOptions = [
    { id: "halal", label: t("dietHalal"), image: dietImages.halal },
    { id: "omnivore", label: t("dietOmnivore"), image: dietImages.omnivore },
    { id: "vegetarian", label: t("dietVegetarian"), image: dietImages.vegetarian },
    { id: "vegan", label: t("dietVegan"), image: dietImages.vegan },
    { id: "keto", label: t("dietKeto"), image: dietImages.keto },
    { id: "pescatarian", label: t("dietPescatarian"), image: dietImages.pescatarian },
  ];

  const handleToggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 2) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      await saveOnboardingAnswers({ diet: selected as DietOption[] });
      await setOnboardingStep(3);
      router.push("/(onboarding)/allergies");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OnboardingScaffold
      title={t("onStep3Title")}
      subtitle={t("onStep3Subtitle")}
      onBack={handleBack}
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
