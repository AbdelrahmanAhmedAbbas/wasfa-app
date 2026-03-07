import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors } from "@/lib/theme/onboarding";

export default function ProofOnboardingScreen() {
  const { isRTL, t } = useLanguage();
  const textAlign = isRTL ? "right" : "left";
  const align = isRTL ? "flex-end" : "flex-start";

  return (
    <OnboardingScaffold
      progress={0.9}
      title={t("onProofTitle")}
      onBack={() => router.back()}
      onContinue={() => router.push("/(onboarding)/getstarted")}
      continueLabel={t("commonContinue")}
    >
      <View style={[styles.badgeRow, isRTL && styles.badgeRowRtl]}>
        <Text style={styles.badge}>5,000+ {t("onProofUsers")}</Text>
        <Text style={styles.badge}>4.8 ★ {t("onProofRating")}</Text>
      </View>

      <View style={[styles.quoteCard, styles.quoteBig]}>
        <Text style={[styles.quoteText, { textAlign }]}>{t("onProofQuoteOne")}</Text>
        <Text style={[styles.byText, { textAlign, alignSelf: align }]}>{t("onProofQuoteOneBy")}</Text>
      </View>

      <View style={[styles.row, isRTL && styles.rowRtl]}>
        <View style={[styles.quoteCard, styles.quoteSmall]}>
          <Text style={[styles.quoteText, { textAlign }]}>{t("onProofQuoteTwo")}</Text>
          <Text style={[styles.byText, { textAlign, alignSelf: align }]}>{t("onProofQuoteTwoBy")}</Text>
        </View>
        <View style={[styles.quoteCard, styles.quoteSmall]}>
          <Text style={[styles.quoteText, { textAlign }]}>{t("onProofQuoteThree")}</Text>
          <Text style={[styles.byText, { textAlign, alignSelf: align }]}>{t("onProofQuoteThreeBy")}</Text>
        </View>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
  badgeRowRtl: {
    flexDirection: "row-reverse",
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "700",
    color: onboardingColors.text,
  },
  quoteCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    padding: 14,
    marginTop: 10,
  },
  quoteBig: {
    minHeight: 118,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  rowRtl: {
    flexDirection: "row-reverse",
  },
  quoteSmall: {
    flex: 1,
    minHeight: 138,
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 20,
    color: onboardingColors.text,
    fontWeight: "500",
  },
  byText: {
    marginTop: 10,
    fontSize: 12,
    color: onboardingColors.textMuted,
    fontWeight: "700",
  },
});
