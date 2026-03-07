import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors } from "@/lib/theme/onboarding";

export default function ResultsOnboardingScreen() {
  const { isRTL, t } = useLanguage();
  const textAlign = isRTL ? "right" : "left";

  return (
    <OnboardingScaffold
      progress={0.8}
      title={t("onResultsTitle")}
      onBack={() => router.back()}
      onContinue={() => router.push("/(onboarding)/proof")}
      continueLabel={t("onNext")}
    >
      <View style={styles.chartCard}>
        <View style={styles.sparkleLeft}>
          <Text style={styles.sparkleText}>✦</Text>
        </View>
        <View style={styles.sparkleRight}>
          <Text style={styles.sparkleText}>✦</Text>
        </View>

        <View style={styles.chartArea}>
          <View style={styles.lineWithoutWasfa} />
          <View style={styles.lineWithWasfa} />

          <View style={styles.legendWrap}>
            <View style={styles.legendRow}>
              <View style={styles.legendDotWithWasfa} />
              <Text style={styles.legendText}>{t("onResultsLegendWithWasfa")}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendDotWithoutWasfa} />
              <Text style={styles.legendText}>{t("onResultsLegendWithoutWasfa")}</Text>
            </View>
          </View>
        </View>

        <View style={styles.axisRow}>
          <Text style={styles.axisLabel}>{t("onResultsMonthOne")}</Text>
          <Text style={styles.axisLabel}>{t("onResultsMonthSix")}</Text>
        </View>
      </View>

      <View style={styles.statBadge}>
        <Text style={[styles.statText, { textAlign }]}>{t("onResultsStat")}</Text>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    padding: 16,
    position: "relative",
  },
  sparkleLeft: {
    position: "absolute",
    left: 10,
    top: 8,
  },
  sparkleRight: {
    position: "absolute",
    right: 10,
    top: 8,
  },
  sparkleText: {
    color: onboardingColors.accentBorder,
    fontSize: 14,
  },
  chartArea: {
    marginTop: 16,
    height: 180,
    borderRadius: 12,
    backgroundColor: "#F6FAF1",
    borderWidth: 1,
    borderColor: "#E1EBD7",
    overflow: "hidden",
    justifyContent: "center",
  },
  lineWithWasfa: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: onboardingColors.primaryAccent,
    transform: [{ rotate: "-20deg" }],
  },
  lineWithoutWasfa: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 52,
    height: 0,
    borderTopWidth: 2,
    borderTopColor: "#8E8A87",
    borderStyle: "dashed",
  },
  legendWrap: {
    position: "absolute",
    right: 12,
    top: 12,
    gap: 6,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDotWithWasfa: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: onboardingColors.primaryAccent,
  },
  legendDotWithoutWasfa: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#8E8A87",
  },
  legendText: {
    fontSize: 11,
    color: onboardingColors.textMuted,
    fontWeight: "600",
  },
  axisRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  axisLabel: {
    fontSize: 13,
    color: onboardingColors.textMuted,
    fontWeight: "600",
  },
  statBadge: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A9D3A9",
    backgroundColor: onboardingColors.accent,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statText: {
    color: "#3C6E3C",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
});
