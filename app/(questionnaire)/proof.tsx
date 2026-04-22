import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { setQuestionnaireStep } from "@/lib/onboarding/storage";
import { onboardingColors } from "@/lib/theme/onboarding";

export default function ProofQuestionnaireScreen() {
  const { t } = useLanguage();

  const handleContinue = async () => {
    await setQuestionnaireStep(4);
    router.push("/(questionnaire)/solution");
  };

  return (
    <OnboardingScaffold
      title={t("qProofTitle")}
      subtitle={t("qProofSubtitle")}
      onBack={() => router.back()}
      onContinue={handleContinue}
    >
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>12k+</Text>
          <Text style={styles.statLabel}>{t("qProofStatOne")}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>82%</Text>
          <Text style={styles.statLabel}>{t("qProofStatTwo")}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>3x</Text>
          <Text style={styles.statLabel}>{t("qProofStatThree")}</Text>
        </View>
      </View>

      <View style={styles.quotes}>
        {[
          ["qProofQuoteA", "qProofQuoteABy"],
          ["qProofQuoteB", "qProofQuoteBBy"],
          ["qProofQuoteC", "qProofQuoteCBy"],
        ].map(([quoteKey, byKey]) => (
          <View key={quoteKey} style={styles.quoteCard}>
            <FontAwesome name="star" size={16} color="#E8A23A" />
            <Text style={styles.quote}>{t(quoteKey as any)}</Text>
            <Text style={styles.byline}>{t(byKey as any)}</Text>
          </View>
        ))}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  stats: {
    marginTop: 28,
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: onboardingColors.primaryDark,
    padding: 14,
    minHeight: 104,
    justifyContent: "center",
  },
  statNumber: {
    fontSize: 25,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
  },
  statLabel: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
    color: "#E8F5E0",
    textAlign: "center",
  },
  quotes: {
    marginTop: 24,
    gap: 12,
  },
  quoteCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: onboardingColors.border,
    padding: 16,
  },
  quote: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
    color: onboardingColors.text,
  },
  byline: {
    marginTop: 8,
    fontSize: 13,
    color: onboardingColors.textMuted,
  },
});
