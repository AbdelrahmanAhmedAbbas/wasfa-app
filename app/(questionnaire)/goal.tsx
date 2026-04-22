import { useEffect, useState } from "react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { SelectionCard } from "@/components/onboarding/SelectionCard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  getOnboardingAnswers,
  GoalOption,
  saveOnboardingAnswers,
} from "@/lib/onboarding/answers";
import { setQuestionnaireStep } from "@/lib/onboarding/storage";

const GOAL_OPTIONS: { id: GoalOption; labelKey: string; emoji: string }[] = [
  { id: "save_social", labelKey: "qGoalSaveSocial", emoji: "📲" },
  { id: "meal_plan", labelKey: "qGoalMealPlan", emoji: "🗓️" },
  { id: "eat_better", labelKey: "qGoalEatBetter", emoji: "🥗" },
  { id: "save_money", labelKey: "qGoalSaveMoney", emoji: "🛒" },
  { id: "family", labelKey: "qGoalFamily", emoji: "🍽️" },
];

export default function GoalQuestionnaireScreen() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<GoalOption | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void getOnboardingAnswers().then((answers) => setSelected(answers.goal));
  }, []);

  const handleContinue = async () => {
    if (!selected) return;

    setIsSaving(true);
    try {
      await saveOnboardingAnswers({ goal: selected });
      await setQuestionnaireStep(2);
      router.push("/(questionnaire)/pain");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OnboardingScaffold
      title={t("qGoalTitle")}
      subtitle={t("qGoalSubtitle")}
      onBack={() => router.back()}
      onContinue={handleContinue}
      continueDisabled={!selected || isSaving}
    >
      <View style={styles.stack}>
        {GOAL_OPTIONS.map((option) => (
          <SelectionCard
            key={option.id}
            label={t(option.labelKey as any)}
            emoji={option.emoji}
            selected={selected === option.id}
            onPress={() => setSelected(option.id)}
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
