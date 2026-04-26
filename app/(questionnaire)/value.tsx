import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { demoRecipe } from "@/lib/onboarding/demo-data";
import { setQuestionnaireComplete, setQuestionnaireStep } from "@/lib/onboarding/storage";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";

export default function ValueQuestionnaireScreen() {
  const { language, t } = useLanguage();
  const textKey = language === "ar" ? "ar" : "en";

  const finishQuestionnaire = async () => {
    await setQuestionnaireComplete(true);
    await setQuestionnaireStep(10);
    router.replace("/(auth)/signup");
  };

  return (
    <OnboardingScaffold
      title={t("qValueTitle")}
      subtitle={t("qValueSubtitle")}
      showContinueButton={false}
    >
      <View style={styles.recipeCard}>
        <Image source={onboardingImages.demoKabsaSocial} style={styles.recipeImage} resizeMode="cover" />
        <View style={styles.recipeCopy}>
          <Text style={styles.recipeTitle}>{demoRecipe.title[textKey]}</Text>
          <Text style={styles.recipeMeta}>
            {demoRecipe.prepMinutes + demoRecipe.cookMinutes}m • {demoRecipe.servings} {t("servings")}
          </Text>
        </View>
      </View>

      <View style={styles.benefits}>
        {[t("qValueBenefitOne"), t("qValueBenefitTwo"), t("qValueBenefitThree")].map((benefit) => (
          <View key={benefit} style={styles.benefitRow}>
            <View style={styles.check}>
              <FontAwesome name="check" size={12} color="#FFFFFF" />
            </View>
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.cta} onPress={finishQuestionnaire}>
          <Text style={styles.ctaText}>{t("qValueCreateAccount")}</Text>
        </Pressable>
        <Pressable style={styles.skip} onPress={finishQuestionnaire}>
          <Text style={styles.skipText}>{t("qValueSkip")}</Text>
        </Pressable>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  recipeCard: {
    marginTop: 26,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: onboardingColors.border,
    overflow: "hidden",
  },
  recipeImage: {
    width: "100%",
    height: 170,
    backgroundColor: "#F7EAD5",
  },
  recipeCopy: {
    padding: 16,
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: onboardingColors.text,
  },
  recipeMeta: {
    marginTop: 4,
    fontSize: 14,
    color: onboardingColors.textMuted,
  },
  benefits: {
    marginTop: 24,
    gap: 14,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: onboardingColors.teal,
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    color: onboardingColors.text,
  },
  actions: {
    marginTop: 30,
    gap: 12,
  },
  cta: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: onboardingColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  skip: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: 15,
    fontWeight: "800",
    color: onboardingColors.textMuted,
  },
});
