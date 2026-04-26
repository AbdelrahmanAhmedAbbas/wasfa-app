import { Image, StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";
import { ScreenTransition } from "@/components/navigation/ScreenTransition";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";

export default function PlannerScreen() {
  const { isRTL, t } = useLanguage();
  return (
    <ScreenTransition>
      <View style={styles.container}>
        <Image source={onboardingImages.mascotTyping} resizeMode="contain" style={styles.image} />
        <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>
          {t("screenComingSoonTitle")}
        </Text>
        <Text style={[styles.subtitle, { textAlign: isRTL ? "right" : "left" }]}>
          {t("screenComingSoonBody")}
        </Text>
      </View>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: onboardingColors.backgroundBase,
    paddingHorizontal: 24,
  },
  image: {
    width: 150,
    height: 150,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: onboardingColors.primaryDark,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: onboardingColors.textSecondary,
  },
});
