import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { saveOnboardingAnswers } from "@/lib/onboarding/answers";
import { onboardingColors } from "@/lib/theme/onboarding";

type SourceOption = {
  id: string;
  label: string;
  icon: ComponentProps<typeof FontAwesome>["name"];
};

export default function SourceOnboardingScreen() {
  const { isRTL, t } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const textAlign = isRTL ? "right" : "left";

  const options = useMemo<SourceOption[]>(
    () => [
      { id: "instagram", label: t("sourceInstagram"), icon: "instagram" },
      { id: "tiktok", label: t("sourceTiktok"), icon: "music" },
      { id: "youtube", label: t("sourceYoutube"), icon: "youtube-play" },
      { id: "app_store", label: t("sourceAppStoreSearch"), icon: "search" },
      { id: "friends", label: t("sourceFriendsFamily"), icon: "users" },
      { id: "other", label: t("sourceOther"), icon: "ellipsis-h" },
    ],
    [t]
  );

  async function continueNext() {
    if (!selected) return;
    await saveOnboardingAnswers({ source: selected });
    router.push("/(onboarding)/goals");
  }

  async function skipSource() {
    await saveOnboardingAnswers({ source: "skipped" });
    router.push("/(onboarding)/goals");
  }

  return (
    <OnboardingScaffold
      progress={0.2}
      title={t("onSourceTitle")}
      onBack={() => router.back()}
      onContinue={() => void continueNext()}
      continueLabel={t("onNext")}
      continueDisabled={!selected}
      showContinueButton={Boolean(selected)}
      footerContent={
        <Pressable style={styles.skipButton} onPress={() => void skipSource()}>
          <Text style={styles.skipText}>{t("onSkip")}</Text>
        </Pressable>
      }
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
              <View style={[styles.optionRow, isRTL && styles.optionRowRtl]}>
                <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                  <FontAwesome
                    name={option.icon}
                    size={15}
                    color={active ? onboardingColors.accentBorder : onboardingColors.textMuted}
                  />
                </View>
                <Text style={[styles.optionText, { textAlign }, active && styles.optionTextActive]}>
                  {option.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  optionsWrap: {
    marginTop: 18,
    gap: 12,
  },
  optionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    minHeight: 58,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  optionCardActive: {
    backgroundColor: onboardingColors.accent,
    borderColor: onboardingColors.accentBorder,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionRowRtl: {
    flexDirection: "row-reverse",
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F5F1EA",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: "#D7ECCD",
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: onboardingColors.text,
    fontWeight: "600",
  },
  optionTextActive: {
    color: onboardingColors.accentBorder,
  },
  skipButton: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  skipText: {
    color: onboardingColors.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
});
