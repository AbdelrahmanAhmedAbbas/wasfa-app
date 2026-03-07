import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { ReligionPreference, saveOnboardingAnswers } from "@/lib/onboarding/answers";
import { onboardingColors } from "@/lib/theme/onboarding";

export default function LocationOnboardingScreen() {
  const { isRTL, t } = useLanguage();
  const [religion, setReligion] = useState<ReligionPreference | null>(null);

  async function continueNext() {
    if (!religion) return;

    await saveOnboardingAnswers({
      religion,
    });

    router.push("/(onboarding)/family");
  }

  return (
    <OnboardingScaffold
      progress={0.4}
      title={t("onLocationReligionSubtitle")}
      subtitle={t("onLocationHelper")}
      onBack={() => router.back()}
      onContinue={() => void continueNext()}
      continueDisabled={!religion}
    >
      <View style={styles.religionWrap}>
        <ReligionCard
          title={t("onReligionIslam")}
          badge={t("onReligionHalalBadge")}
          active={religion === "islam"}
          onPress={() => setReligion("islam")}
          rtl={isRTL}
        />
        <ReligionCard
          title={t("onReligionNone")}
          active={religion === "none"}
          onPress={() => setReligion("none")}
          rtl={isRTL}
        />
        <ReligionCard
          title={t("onReligionOther")}
          active={religion === "other"}
          onPress={() => setReligion("other")}
          rtl={isRTL}
        />
      </View>
    </OnboardingScaffold>
  );
}

function ReligionCard({
  title,
  badge,
  active,
  onPress,
  rtl,
}: {
  title: string;
  badge?: string;
  active: boolean;
  onPress: () => void;
  rtl: boolean;
}) {
  const textAlign = rtl ? "right" : "left";

  return (
    <Pressable
      style={[styles.religionCard, active && styles.religionCardActive]}
      onPress={onPress}
    >
      <View style={[styles.religionRow, rtl && styles.religionRowRtl]}>
        <Text style={[styles.religionTitle, { textAlign }]}>{title}</Text>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  religionWrap: {
    marginTop: 20,
    gap: 10,
  },
  religionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  religionCardActive: {
    backgroundColor: onboardingColors.accent,
    borderColor: onboardingColors.accentBorder,
  },
  religionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  religionRowRtl: {
    flexDirection: "row-reverse",
  },
  religionTitle: {
    flex: 1,
    fontSize: 15,
    color: onboardingColors.text,
    fontWeight: "600",
  },
  badge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3B7A3B",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#A9D3A9",
    backgroundColor: "#E8F5E0",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
});
