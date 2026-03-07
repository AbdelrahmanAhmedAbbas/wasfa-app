import { router } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors } from "@/lib/theme/onboarding";

const onboardingOneImage = require("../../assets/images/onboarding-1.png");

export default function WelcomeOnboardingScreen() {
  const { t } = useLanguage();
  const textAlign = "center" as const;

  return (
    <OnboardingScaffold
      progress={0.1}
      title=""
      showContinueButton={false}
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        router.replace("/(auth)/welcome");
      }}
      onContinue={() => router.push("/(onboarding)/source")}
    >
      <View style={styles.contentWrap}>
        <View style={styles.heroCard}>
          <Image source={onboardingOneImage} style={styles.heroImage} resizeMode="cover" />
        </View>

        <Text style={[styles.title, { textAlign }]}>{t("onWelcomeTrackTitle")}</Text>
        <Text style={[styles.subtitle, { textAlign }]}>{t("onWelcomeTrackSubtitle")}</Text>

        <Pressable style={styles.nextButton} onPress={() => router.push("/(onboarding)/source")}>
          <Text style={styles.nextButtonText}>{t("onWelcomeCta")} ›</Text>
        </Pressable>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  contentWrap: {
    marginTop: 0,
    alignItems: "center",
    width: "100%",
  },
  heroCard: {
    width: "106%",
    maxWidth: 316,
    height: 404,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: onboardingColors.card,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  title: {
    marginTop: 16,
    fontSize: 45,
    lineHeight: 47,
    letterSpacing: -1,
    fontWeight: "900",
    color: onboardingColors.primaryDark,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "500",
    color: onboardingColors.textSecondary,
    maxWidth: 300,
  },
  nextButton: {
    marginTop: 16,
    minWidth: 200,
    height: 52,
    borderRadius: 26,
    backgroundColor: onboardingColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  nextButtonText: {
    fontSize: 19,
    lineHeight: 21,
    fontWeight: "700",
    color: onboardingColors.textOnDark,
    letterSpacing: 0,
  },
});
