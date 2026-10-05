import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocalizedText as Text } from "@/components/LocalizedText";
import {
  ImportExplainerShareSheet,
  ImportExplainerStage,
  useImportExplainerClock,
} from "@/components/onboarding/ImportExplainer";
import { OnboardingFooter } from "@/components/onboarding/OnboardingFooter";
import { headingStyle } from "@/components/onboarding/text-styles";
import { CtaButton } from "@/components/wasfa/CtaButton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { getOnboardingAnswers, type HouseholdSize } from "@/lib/onboarding/answers";
import { getHouseholdOption, getStepIndex } from "@/lib/onboarding/flow";
import { setQuestionnaireComplete, setQuestionnaireStep } from "@/lib/onboarding/storage";
import { wasfaColors } from "@/lib/theme/wasfa";

// Below this height the header moves up so the explainer keeps a readable size.
const COMPACT_SCREEN_HEIGHT = 760;

export default function DemoQuestionnaireScreen() {
  const { isRTL, t } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const clock = useImportExplainerClock();
  const [householdSize, setHouseholdSize] = useState<HouseholdSize | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void getOnboardingAnswers().then((answers) => {
      if (isMounted) setHouseholdSize(answers.householdSize);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const finishQuestionnaire = async () => {
    setIsFinishing(true);
    try {
      await setQuestionnaireComplete(true);
      await setQuestionnaireStep(getStepIndex("ready"));
      // Someone who signed in before the questions already has an account.
      router.replace(user ? "/(paywall)/offer" : "/(auth)/signup");
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View
        style={[styles.header, { paddingTop: insets.top + (height < COMPACT_SCREEN_HEIGHT ? 24 : 60) }]}
      >
        <Text style={[styles.title, headingStyle(28, isRTL)]}>{t("obDemoTitle")}</Text>
        <Text style={styles.hint}>{t("obDemoHint")}</Text>
      </View>

      <ImportExplainerStage clock={clock} servings={getHouseholdOption(householdSize).servings} />

      <OnboardingFooter>
        <CtaButton
          label={t("obKeepGoing")}
          onPress={() => void finishQuestionnaire()}
          loading={isFinishing}
        />
      </OnboardingFooter>

      <ImportExplainerShareSheet clock={clock} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: wasfaColors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  title: {
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  hint: {
    fontSize: 15,
    lineHeight: 22,
    color: wasfaColors.muted,
    textAlign: "left",
  },
});
