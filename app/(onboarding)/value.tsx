import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import { Image, StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";

export default function ValueOnboardingScreen() {
  const { isRTL, t } = useLanguage();
  const textAlign = isRTL ? "right" : "left";

  const cards = [
    {
      id: "discovery",
      icon: "compass",
      title: t("onValueFeatureOneTitle"),
      body: t("onValueFeatureOneBody"),
    },
    {
      id: "plan",
      icon: "bolt",
      title: t("onValueFeatureTwoTitle"),
      body: t("onValueFeatureTwoBody"),
    },
    {
      id: "list",
      icon: "shopping-basket",
      title: t("onValueFeatureThreeTitle"),
      body: t("onValueFeatureThreeBody"),
    },
  ] as const;

  return (
    <OnboardingScaffold
      progress={0.7}
      title={t("onValueTitle")}
      onBack={() => router.back()}
      onContinue={() => router.push("/(onboarding)/results")}
      continueLabel={t("onLetsGo")}
    >
      <View style={styles.illustrationCard}>
        <View style={[styles.workflowRow, isRTL && styles.workflowRowRtl]}>
          <View style={styles.workflowDot} />
          <View style={styles.workflowLine} />
          <View style={styles.workflowDot} />
          <View style={styles.workflowLine} />
          <View style={[styles.workflowDot, styles.workflowDotAccent]} />
        </View>
        <Image source={onboardingImages.mascotReading} style={styles.illustration} resizeMode="contain" />
      </View>

      <View style={styles.cardsWrap}>
        {cards.map((item) => (
          <View key={item.id} style={[styles.featureCard, isRTL && styles.featureCardRtl]}>
            <View style={styles.iconWrap}>
              <FontAwesome name={item.icon} size={16} color={onboardingColors.primaryAccent} />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={[styles.featureTitle, { textAlign }]}>{item.title}</Text>
              <Text style={[styles.featureBody, { textAlign }]}>{item.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  illustrationCard: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    padding: 14,
    alignItems: "center",
  },
  workflowRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  workflowRowRtl: {
    flexDirection: "row-reverse",
  },
  workflowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#CABFAE",
  },
  workflowDotAccent: {
    backgroundColor: onboardingColors.primaryAccent,
  },
  workflowLine: {
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#D7CFBF",
  },
  illustration: {
    marginTop: 6,
    width: 160,
    height: 160,
  },
  cardsWrap: {
    marginTop: 14,
    gap: 10,
  },
  featureCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureCardRtl: {
    flexDirection: "row-reverse",
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F8F2E8",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTextWrap: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: onboardingColors.text,
  },
  featureBody: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 19,
    color: onboardingColors.textMuted,
    fontWeight: "500",
  },
});
