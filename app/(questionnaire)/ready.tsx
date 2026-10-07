import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { track } from "@/lib/analytics/posthog";
import { LocalizedText as Text } from "@/components/LocalizedText";
import { MASCOT_ASPECT } from "@/components/onboarding/MascotBadge";
import { OnboardingFooter } from "@/components/onboarding/OnboardingFooter";
import { headingStyle } from "@/components/onboarding/text-styles";
import { CheckBox } from "@/components/wasfa/CheckBox";
import { CtaButton } from "@/components/wasfa/CtaButton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { clearOnboardingAnswers, getOnboardingAnswers } from "@/lib/onboarding/answers";
import { hasQuestionnaireAnswers, pickChatAnswers } from "@/lib/onboarding/flow";
import { getOnboardingProfile, saveOnboardingProfile } from "@/lib/onboarding/profile";
import { onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors } from "@/lib/theme/wasfa";

const SETUP_KEYS: TranslationKey[] = ["obSetup1", "obSetup2", "obSetup3"];
const STEP_DELAY = 650;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ReadyQuestionnaireScreen() {
  const { isRTL, t } = useLanguage();
  const { user, loading, completeOnboarding } = useAuth();
  const insets = useSafeAreaInsets();
  const [doneCount, setDoneCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const isMounted = useRef(true);
  const hasStarted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (loading || hasStarted.current) return;

    // Setup syncs to the account, so without one the opening screen picks
    // where to go instead.
    if (!user) {
      router.replace("/");
      return;
    }

    hasStarted.current = true;
    void runSetup(user.id);
  }, [loading, user]);

  const runSetup = async (userId: string) => {
    setError(null);
    setDoneCount(0);

    try {
      const answers = await getOnboardingAnswers();

      await wait(STEP_DELAY);
      // An account that already has a profile is coming back and keeps it,
      // whatever was answered on this device. A new account gets the chat
      // answers, or an empty profile when the chat was skipped.
      if ((await getOnboardingProfile(userId)) === null) {
        await saveOnboardingProfile(
          userId,
          hasQuestionnaireAnswers(answers) ? pickChatAnswers(answers) : {}
        );
      }
      if (isMounted.current) setDoneCount(1);

      await wait(STEP_DELAY);
      if (isMounted.current) setDoneCount(2);

      await wait(STEP_DELAY);
      await clearOnboardingAnswers();
      await completeOnboarding();
      track("onboarding_completed", { answered_questions: hasQuestionnaireAnswers(answers) });
      if (isMounted.current) setDoneCount(3);
    } catch (err) {
      console.error("Questionnaire setup error:", err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "Setup failed");
      }
    }
  };

  const handleRetry = async () => {
    if (!user) return;
    setIsRetrying(true);
    await runSetup(user.id);
    if (isMounted.current) setIsRetrying(false);
  };

  const isDone = doneCount >= SETUP_KEYS.length;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mascotStage}>
          <View style={styles.mascotRing} />
          <View style={styles.mascotDisc} />
          <Image source={onboardingImages.mascot} style={styles.mascot} resizeMode="contain" />
        </View>

        <Text style={[styles.title, headingStyle(30, isRTL)]}>{t("obReadyTitle")}</Text>
        <Text style={styles.body}>{t("obReadyBody")}</Text>

        <View style={styles.checklist}>
          {SETUP_KEYS.map((key, index) => (
            <View key={key} style={styles.checkRow}>
              <CheckBox checked={doneCount > index} variant="round" />
              <Text style={styles.checkLabel}>{t(key)}</Text>
            </View>
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      {isDone || error ? (
        <OnboardingFooter>
          {error ? (
            <CtaButton label={t("setupRetry")} onPress={() => void handleRetry()} loading={isRetrying} />
          ) : (
            <CtaButton label={t("obOpen")} onPress={() => router.replace("/(tabs)")} />
          )}
        </OnboardingFooter>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: wasfaColors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: "center",
    gap: 14,
  },
  mascotStage: {
    width: 250,
    height: 250,
    alignItems: "center",
    justifyContent: "center",
  },
  mascotDisc: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 125,
    backgroundColor: wasfaColors.primarySoft,
  },
  mascotRing: {
    position: "absolute",
    top: -18,
    bottom: -18,
    left: -18,
    right: -18,
    borderRadius: 143,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(90,138,90,0.3)",
  },
  mascot: {
    height: 230,
    width: 230 * MASCOT_ASPECT,
  },
  title: {
    marginTop: 8,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: wasfaColors.muted,
    textAlign: "center",
  },
  checklist: {
    alignSelf: "stretch",
    marginTop: 8,
    gap: 8,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
  },
  checkLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  errorText: {
    fontSize: 14,
    color: wasfaColors.danger,
    textAlign: "center",
  },
});
