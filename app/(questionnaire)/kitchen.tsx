import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { MASCOT_ASPECT } from "@/components/onboarding/MascotBadge";
import { OnboardingFooter } from "@/components/onboarding/OnboardingFooter";
import { eyebrowStyle, headingStyle } from "@/components/onboarding/text-styles";
import { CtaButton } from "@/components/wasfa/CtaButton";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  getOnboardingAnswers,
  saveOnboardingAnswers,
  type OnboardingAnswers,
} from "@/lib/onboarding/answers";
import {
  ALLERGY_OPTIONS,
  DEFAULT_SOLUTION,
  DIET_OPTIONS,
  getHouseholdOption,
  getStepIndex,
  GOAL_OPTIONS,
  PAIN_OPTIONS,
} from "@/lib/onboarding/flow";
import { setQuestionnaireStep } from "@/lib/onboarding/storage";
import { dietImages, onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors } from "@/lib/theme/wasfa";

export default function KitchenQuestionnaireScreen() {
  const { isRTL, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState<OnboardingAnswers | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void getOnboardingAnswers().then((saved) => {
      if (!isMounted) return;
      // The card summarises the chat; without its answers there is nothing to show.
      if (!saved.goal || !saved.householdSize) {
        router.replace("/(questionnaire)/chat");
        return;
      }
      setAnswers(saved);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleContinue = async () => {
    setIsBusy(true);
    try {
      await setQuestionnaireStep(getStepIndex("demo"));
      router.push("/(questionnaire)/demo");
    } finally {
      setIsBusy(false);
    }
  };

  const handleEdit = async () => {
    setIsBusy(true);
    try {
      await saveOnboardingAnswers({
        goal: null,
        householdSize: null,
        painPoints: [],
        diet: [],
        allergies: [],
      });
      await setQuestionnaireStep(getStepIndex("chat"));
      // Pops back to the chat (or opens it after a resume) and restarts its questions.
      router.dismissTo({
        pathname: "/(questionnaire)/chat",
        params: { restart: String(Date.now()) },
      });
    } finally {
      setIsBusy(false);
    }
  };

  if (!answers) {
    return <View style={styles.screen} />;
  }

  const goal = GOAL_OPTIONS.find((option) => option.id === answers.goal);
  const household = getHouseholdOption(answers.householdSize);
  const diets = DIET_OPTIONS.filter((option) => answers.diet.includes(option.id));
  const allergies = ALLERGY_OPTIONS.filter((option) => answers.allergies.includes(option.id));
  const pickedPains = PAIN_OPTIONS.filter((option) => answers.painPoints.includes(option.id));
  const solutions = pickedPains.length > 0 ? pickedPains : [DEFAULT_SOLUTION];

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 60 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.tag, eyebrowStyle(isRTL)]}>{t("obKitchenTag")}</Text>
        <Text style={[styles.title, headingStyle(30, isRTL)]}>{t("obKitchenTitle")}</Text>

        <View style={styles.cardShadow}>
          <View style={styles.card}>
            <View style={styles.cardGlow} />
            <Image source={onboardingImages.mascot} style={styles.cardMascot} resizeMode="contain" />

            <View style={styles.goalBlock}>
              <Text style={styles.cardLabel}>{t("obKitchenGoal")}</Text>
              <Text style={styles.goalText}>{goal ? t(goal.labelKey) : ""}</Text>
            </View>

            <View style={styles.pillRow}>
              <View style={styles.housePill}>
                <Feather name="users" size={14} color="#FFFFFF" />
                <Text style={styles.housePillText}>{t(household.labelKey)}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardSection}>
              <Text style={styles.cardLabel}>{t("obKitchenDiet")}</Text>
              <View style={styles.pillWrap}>
                {diets.length > 0 ? (
                  diets.map((diet) => (
                    <View key={diet.id} style={styles.dietPill}>
                      <Image source={dietImages[diet.id]} style={styles.dietImage} />
                      <Text style={styles.dietPillText}>{t(diet.labelKey)}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.dietPill}>
                    <Text style={styles.dietPillText}>{t("obNoPref")}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.cardSection}>
              <Text style={styles.cardLabel}>{t("obKitchenAvoid")}</Text>
              <View style={styles.pillWrap}>
                {allergies.length > 0 ? (
                  allergies.map((allergy) => (
                    <View key={allergy.id} style={styles.avoidPill}>
                      <RNText style={styles.avoidEmoji}>{allergy.emoji}</RNText>
                      <Text style={styles.avoidPillText}>{t(allergy.labelKey)}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.avoidPill}>
                    <Text style={styles.avoidPillText}>{t("obNone")}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.fixTitle}>{t("obKitchenFix")}</Text>

        {solutions.map((solution) => (
          <View key={solution.problemKey} style={styles.fixCard}>
            <View style={styles.fixIcon}>
              <Ionicons name="sparkles-outline" size={14} color={wasfaColors.cta} />
            </View>
            <View style={styles.fixCopy}>
              <Text style={styles.fixProblem}>{t(solution.problemKey)}</Text>
              <Text style={styles.fixAnswer}>{t(solution.answerKey)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <OnboardingFooter>
        <CtaButton label={t("obLooksRight")} onPress={() => void handleContinue()} disabled={isBusy} />
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          style={styles.secondary}
          onPress={() => void handleEdit()}
        >
          <Text style={styles.secondaryText}>{t("obEdit")}</Text>
        </Pressable>
      </OnboardingFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: wasfaColors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
  },
  tag: {
    fontSize: 13,
    fontWeight: "800",
    color: wasfaColors.primary,
    textAlign: "left",
  },
  title: {
    marginTop: -8,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  cardShadow: {
    borderRadius: 28,
    backgroundColor: wasfaColors.primary,
    shadowColor: wasfaColors.primaryDark,
    shadowOpacity: 0.28,
    shadowRadius: 17,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  card: {
    borderRadius: 28,
    padding: 20,
    gap: 14,
    overflow: "hidden",
  },
  cardGlow: {
    position: "absolute",
    top: -70,
    end: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  cardMascot: {
    position: "absolute",
    top: 10,
    end: 8,
    height: 110,
    width: 110 * MASCOT_ASPECT,
    transform: [{ rotate: "12deg" }],
  },
  goalBlock: {
    maxWidth: "70%",
    gap: 2,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    opacity: 0.75,
    textAlign: "left",
  },
  goalText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "left",
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
  },
  housePill: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  housePillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  cardSection: {
    gap: 8,
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  dietPill: {
    height: 34,
    paddingStart: 4,
    paddingEnd: 12,
    borderRadius: 999,
    backgroundColor: wasfaColors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dietImage: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  dietPillText: {
    paddingStart: 6,
    fontSize: 13,
    fontWeight: "700",
    color: wasfaColors.ink,
  },
  avoidPill: {
    height: 34,
    paddingStart: 6,
    paddingEnd: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  avoidEmoji: {
    fontSize: 17,
  },
  avoidPillText: {
    paddingStart: 4,
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  fixTitle: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  fixCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
  },
  fixIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: wasfaColors.ctaSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  fixCopy: {
    flex: 1,
    gap: 2,
  },
  fixProblem: {
    fontSize: 12,
    fontWeight: "700",
    color: wasfaColors.muted,
    textAlign: "left",
  },
  fixAnswer: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  secondary: {
    padding: 6,
    alignItems: "center",
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: wasfaColors.primaryDark,
  },
});
