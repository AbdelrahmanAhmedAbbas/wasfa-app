import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { getOnboardingAnswers, PainPoint } from "@/lib/onboarding/answers";
import { setQuestionnaireStep } from "@/lib/onboarding/storage";
import { onboardingColors } from "@/lib/theme/onboarding";

const SOLUTIONS: Record<PainPoint, { problemKey: string; answerKey: string }> = {
  lost_recipes: { problemKey: "qSolutionLostRecipesProblem", answerKey: "qSolutionLostRecipesAnswer" },
  daily_decisions: { problemKey: "qSolutionDailyProblem", answerKey: "qSolutionDailyAnswer" },
  grocery_waste: { problemKey: "qSolutionWasteProblem", answerKey: "qSolutionWasteAnswer" },
  picky_family: { problemKey: "qSolutionFamilyProblem", answerKey: "qSolutionFamilyAnswer" },
  no_time: { problemKey: "qSolutionTimeProblem", answerKey: "qSolutionTimeAnswer" },
};

export default function SolutionQuestionnaireScreen() {
  const { t } = useLanguage();
  const [painPoints, setPainPoints] = useState<PainPoint[]>([]);

  useEffect(() => {
    void getOnboardingAnswers().then((answers) => setPainPoints(answers.painPoints));
  }, []);

  const cards =
    painPoints.length > 0
      ? painPoints.slice(0, 3).map((pain) => SOLUTIONS[pain])
      : [{ problemKey: "qSolutionDefaultProblem", answerKey: "qSolutionDefaultAnswer" }];

  const handleContinue = async () => {
    await setQuestionnaireStep(5);
    router.push("/(questionnaire)/diet");
  };

  return (
    <OnboardingScaffold
      title={t("qSolutionTitle")}
      subtitle={t("qSolutionSubtitle")}
      onBack={() => router.back()}
      onContinue={handleContinue}
    >
      <View style={styles.stack}>
        {cards.map((card) => (
          <View key={card.problemKey} style={styles.card}>
            <View style={styles.iconBadge}>
              <FontAwesome name="magic" size={15} color="#FFFFFF" />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.problem}>{t(card.problemKey as any)}</Text>
              <Text style={styles.answer}>{t(card.answerKey as any)}</Text>
            </View>
          </View>
        ))}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  stack: {
    marginTop: 28,
    gap: 14,
  },
  card: {
    flexDirection: "row",
    gap: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: onboardingColors.border,
    padding: 16,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: onboardingColors.teal,
  },
  cardCopy: {
    flex: 1,
  },
  problem: {
    fontSize: 16,
    fontWeight: "900",
    color: onboardingColors.text,
  },
  answer: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 21,
    color: onboardingColors.textMuted,
  },
});
