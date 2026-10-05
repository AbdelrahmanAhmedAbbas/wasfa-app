import { Redirect, useFocusEffect, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { SPLASH_BACKGROUND, SplashGather } from "@/components/splash/SplashGather";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getResumeRoute } from "@/lib/onboarding/flow";
import {
  getOnboardingDone,
  getPaywallSeen,
  getQuestionnaireComplete,
  getQuestionnaireStep,
} from "@/lib/onboarding/storage";

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

  let destination: Href = "/(questionnaire)/ready";
  if (user && hasCompletedOnboarding) {
    destination = "/(tabs)";
  } else if (!user && !flowState.questionnaireDone) {
    destination = "/(questionnaire)/language";
  } else if (!user && flowState.onboardingDone) {
    // Someone has finished setting up on this device before, so they are
    // coming back (signed out, or an expired session), not signing up.
    destination = "/(auth)/login";
  } else if (!user && flowState.questionnaireDone) {
    destination = "/(auth)/signup";
  } else if (user && !flowState.questionnaireDone) {
    // A new account that signed in on the login screen answers the questions
    // afterwards, so it carries on from the one it stopped at.
    const resume = getResumeRoute(flowState.questionnaireStep);
    if (resume === "chat") destination = "/(questionnaire)/chat";
    else if (resume === "kitchen") destination = "/(questionnaire)/kitchen";
    else if (resume === "demo") destination = "/(questionnaire)/demo";
    else destination = "/(questionnaire)/ready";
  } else if (user && !flowState.paywallSeen) {
    destination = "/(paywall)/offer";
  }

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
