import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { CookingFrequency, saveOnboardingAnswers } from "@/lib/onboarding/answers";
import { onboardingColors } from "@/lib/theme/onboarding";

type FrequencyOption = {
  id: CookingFrequency;
  label: string;
  subLabel: string;
  insight: string;
};

export default function FrequencyOnboardingScreen() {
  const { isRTL, t } = useLanguage();
  const [selected, setSelected] = useState<CookingFrequency | null>(null);
  const textAlign = isRTL ? "right" : "left";

  const options = useMemo<FrequencyOption[]>(
    () => [
      {
        id: "rarely",
        label: t("frequencyRarely"),
        subLabel: t("frequencyRarelyRange"),
        insight: t("frequencyRarelyInsight"),
      },
      {
        id: "sometimes",
        label: t("frequencySometimes"),
        subLabel: t("frequencySometimesRange"),
        insight: t("frequencySometimesInsight"),
      },
      {
        id: "often",
        label: t("frequencyOften"),
        subLabel: t("frequencyOftenRange"),
        insight: t("frequencyOftenInsight"),
      },
    ],
    [t]
  );

  const insightText = selected
    ? options.find((option) => option.id === selected)?.insight
    : t("frequencyDefaultInsight");

  async function continueNext() {
    if (!selected) return;
    await saveOnboardingAnswers({ frequency: selected });
    router.push("/(onboarding)/value");
  }

  return (
    <OnboardingScaffold
      progress={0.6}
      title={t("onFrequencyTitle")}
      onBack={() => router.back()}
      onContinue={() => void continueNext()}
      continueDisabled={!selected}
    >
      <View style={styles.optionsWrap}>
        {options.map((option) => {
          const active = selected === option.id;

          return (
            <Pressable
              key={option.id}
              style={[styles.optionCard, active && styles.optionCardActive]}
              onPress={() => setSelected(option.id)}
            >
              <Text style={[styles.optionTitle, { textAlign }, active && styles.optionTitleActive]}>
                {option.label}
              </Text>
              <Text style={[styles.optionSub, { textAlign }, active && styles.optionSubActive]}>
                {option.subLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.insightCard}>
        <Text style={[styles.insightTitle, { textAlign }]}>{t("onFrequencyInsightTitle")}</Text>
        <Text style={[styles.insightText, { textAlign }]}>{insightText}</Text>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  optionsWrap: {
    marginTop: 20,
    gap: 10,
  },
  optionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionCardActive: {
    borderColor: onboardingColors.accentBorder,
    backgroundColor: onboardingColors.accent,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: onboardingColors.text,
  },
  optionTitleActive: {
    color: onboardingColors.accentBorder,
  },
  optionSub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "500",
    color: onboardingColors.textMuted,
  },
  optionSubActive: {
    color: "#4F7050",
  },
  insightCard: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    padding: 14,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: onboardingColors.primaryAccent,
    textTransform: "uppercase",
  },
  insightText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    color: onboardingColors.text,
  },
});
