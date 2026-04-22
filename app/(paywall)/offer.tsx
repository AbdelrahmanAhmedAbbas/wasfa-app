import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, View } from "react-native";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { setPaywallSeen } from "@/lib/onboarding/storage";
import { onboardingColors } from "@/lib/theme/onboarding";

export default function PaywallOfferScreen() {
  const { t } = useLanguage();

  const continueToSetup = async () => {
    await setPaywallSeen(true);
    router.replace("/(questionnaire)/setup");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.badge}>
          <FontAwesome name="star" size={13} color="#FFFFFF" />
          <Text style={styles.badgeText}>{t("qPaywallBadge")}</Text>
        </View>

        <Text style={styles.title}>{t("qPaywallTitle")}</Text>
        <Text style={styles.subtitle}>{t("qPaywallSubtitle")}</Text>

        <View style={styles.featureStack}>
          {[
            t("qPaywallFeatureOne"),
            t("qPaywallFeatureTwo"),
            t("qPaywallFeatureThree"),
            t("qPaywallFeatureFour"),
          ].map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <View style={styles.check}>
                <FontAwesome name="check" size={12} color="#FFFFFF" />
              </View>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.cta} onPress={continueToSetup}>
          <Text style={styles.ctaText}>{t("qPaywallTrialCta")}</Text>
        </Pressable>
        <Text style={styles.price}>{t("qPaywallPrice")}</Text>
        <Pressable style={styles.skip} onPress={continueToSetup}>
          <Text style={styles.skipText}>{t("qPaywallSkip")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#132416",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 74,
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: onboardingColors.teal,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  title: {
    marginTop: 26,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "900",
    color: "#F7FFE8",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 25,
    color: "#CFE2C8",
  },
  featureStack: {
    marginTop: 34,
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: onboardingColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    gap: 10,
  },
  cta: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: "#F3D179",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#132416",
  },
  price: {
    fontSize: 13,
    color: "#CFE2C8",
    textAlign: "center",
  },
  skip: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#EAF5E5",
  },
});
