import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { saveOnboardingAnswers } from "@/lib/onboarding/answers";
import { onboardingColors } from "@/lib/theme/onboarding";

type GoalOption = {
  id: string;
  label: string;
};

export default function GoalsOnboardingScreen() {
  const { isRTL, t } = useLanguage();
  const textAlign = isRTL ? "right" : "left";
  const [selected, setSelected] = useState<string[]>([]);

  const options = useMemo<GoalOption[]>(
    () => [
      { id: "quick", label: t("goalQuick") },
      { id: "budget", label: t("goalBudget") },
      { id: "healthy", label: t("goalHealthy") },
      { id: "new_things", label: t("goalNewThings") },
      { id: "easy", label: t("goalEasy") },
      { id: "variety", label: t("goalVariety") },
      { id: "waste", label: t("goalWaste") },
      { id: "other", label: t("goalOther") },
    ],
    [t]
  );

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  async function continueNext() {
    await saveOnboardingAnswers({ goals: selected });
    router.push("/(onboarding)/location");
  }

  return (
    <OnboardingScaffold
      progress={0.3}
      title={t("onGoalsTitle")}
      onBack={() => router.back()}
      onContinue={() => void continueNext()}
      continueDisabled={selected.length === 0}
      continueLabel={t("commonContinue")}
    >
      <View style={[styles.pillsWrap, isRTL && styles.pillsWrapRtl]}>
        {options.map((option) => {
          const active = selected.includes(option.id);
          return (
            <Pressable
              key={option.id}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => toggle(option.id)}
            >
              <Text style={[styles.pillText, { textAlign }, active && styles.pillTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  pillsWrap: {
    marginTop: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pillsWrapRtl: {
    flexDirection: "row-reverse",
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: onboardingColors.primaryAccent,
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: onboardingColors.card,
  },
  pillActive: {
    backgroundColor: onboardingColors.accent,
    borderColor: onboardingColors.accentBorder,
  },
  pillText: {
    color: onboardingColors.primaryAccent,
    fontSize: 14,
    fontWeight: "600",
  },
  pillTextActive: {
    color: onboardingColors.accentBorder,
  },
});
