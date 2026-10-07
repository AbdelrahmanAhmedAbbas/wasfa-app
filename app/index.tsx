import { Redirect, useFocusEffect, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { SPLASH_BACKGROUND, SplashGather } from "@/components/splash/SplashGather";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getLaunchRoute, type LaunchRoute } from "@/lib/onboarding/flow";
import {
  getOnboardingDone,
  getPaywallSeen,
  getQuestionnaireComplete,
  getQuestionnaireStep,
} from "@/lib/onboarding/storage";

const LAUNCH_HREFS: Record<LaunchRoute, Href> = {
  app: "/(tabs)",
  login: "/(auth)/login",
  paywall: "/(paywall)/offer",
  language: "/(questionnaire)/language",
  intro: "/(questionnaire)/intro",
  chat: "/(questionnaire)/chat",
  kitchen: "/(questionnaire)/kitchen",
  demo: "/(questionnaire)/demo",
  ready: "/(questionnaire)/ready",
};

// The opening video is shown once per app launch; coming back to this screen
// later (signing out, an expired session) skips it.
let splashPlayed = false;

export default function IndexScreen() {
  const { loading, user, hasCompletedOnboarding } = useAuth();
  const [flowState, setFlowState] = useState({
    loading: true,
    questionnaireDone: false,
    questionnaireStep: 0,
    paywallSeen: false,
    onboardingDone: false,
  });
  const [splashDone, setSplashDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [animate] = useState(() => !splashPlayed);

  useEffect(() => {
    splashPlayed = true;
  }, []);

  // Read again every time this screen comes back into view, not only on
  // launch: signing out returns here with the progress made since then.
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      setFlowState((current) => ({ ...current, loading: true }));

      async function loadFlowState() {
        const [questionnaireDone, questionnaireStep, paywallSeen, onboardingDone] =
          await Promise.all([
            getQuestionnaireComplete(),
            getQuestionnaireStep(),
            getPaywallSeen(),
            getOnboardingDone(),
          ]);

        if (isMounted) {
          setFlowState({
            loading: false,
            questionnaireDone,
            questionnaireStep,
            paywallSeen,
            onboardingDone,
          });
        }
      }

      void loadFlowState();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  useEffect(() => {
    if (!loading && !flowState.loading) setReady(true);
  }, [loading, flowState.loading]);

  if (!splashDone) {
    return (
      <Pressable
        accessible={false}
        style={styles.screen}
        onPress={() => {
          if (ready) setSplashDone(true);
        }}
      >
        <StatusBar style="dark" />
        <SplashGather ready={ready} animate={animate} onDone={() => setSplashDone(true)} />
      </Pressable>
    );
  }

  // Never pick a destination from progress that is still being read.
  if (loading || flowState.loading) {
    return <View style={styles.screen} />;
  }

  const destination =
    LAUNCH_HREFS[
      getLaunchRoute({
        signedIn: !!user,
        onboardingDone: user ? hasCompletedOnboarding : flowState.onboardingDone,
        questionnaireDone: flowState.questionnaireDone,
        questionnaireStep: flowState.questionnaireStep,
        paywallSeen: flowState.paywallSeen,
      })
    ];

  // Keep the splash colour behind the redirect so the hand-off never flashes.
  return (
    <View style={styles.screen}>
      <Redirect href={destination} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SPLASH_BACKGROUND,
  },
});
