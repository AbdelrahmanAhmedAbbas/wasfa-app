import { useEffect, useState } from "react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { SelectionCard } from "@/components/onboarding/SelectionCard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  getOnboardingAnswers,
  PainPoint,
  saveOnboardingAnswers,
} from "@/lib/onboarding/answers";
import { setQuestionnaireStep } from "@/lib/onboarding/storage";

const PAIN_OPTIONS: { id: PainPoint; labelKey: string; emoji: string }[] = [
  { id: "lost_recipes", labelKey: "qPainLostRecipes", emoji: "🔎" },
  { id: "daily_decisions", labelKey: "qPainDailyDecisions", emoji: "🤔" },
  { id: "grocery_waste", labelKey: "qPainGroceryWaste", emoji: "🥬" },
  { id: "picky_family", labelKey: "qPainPickyFamily", emoji: "👨‍👩‍👧‍👦" },
  { id: "no_time", labelKey: "qPainNoTime", emoji: "⏱️" },
];

export default function PainQuestionnaireScreen() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<PainPoint[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void getOnboardingAnswers().then((answers) => setSelected(answers.painPoints));
  }, []);

  const handleToggle = (id: PainPoint) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      await saveOnboardingAnswers({ painPoints: selected });
      await setQuestionnaireStep(3);
      router.push("/(questionnaire)/proof");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OnboardingScaffold
      title={t("qPainTitle")}
      subtitle={t("qPainSubtitle")}
      onBack={() => router.back()}
      onContinue={handleContinue}
      continueDisabled={selected.length === 0 || isSaving}
    >
      <View style={styles.stack}>
        {PAIN_OPTIONS.map((option) => (
          <SelectionCard
            key={option.id}
            label={t(option.labelKey as any)}
            emoji={option.emoji}
            selected={selected.includes(option.id)}
            onPress={() => handleToggle(option.id)}
          />
        ))}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  stack: {
    marginTop: 20,
  },
});
