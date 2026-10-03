import { Redirect, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { SPLASH_BACKGROUND, SplashGather } from "@/components/splash/SplashGather";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
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
  });
  const [splashDone, setSplashDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [animate] = useState(() => !splashPlayed);

  useEffect(() => {
    splashPlayed = true;
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadFlowState() {
      const [questionnaireDone, questionnaireStep, paywallSeen] = await Promise.all([
        getQuestionnaireComplete(),
        getQuestionnaireStep(),
        getPaywallSeen(),
      ]);

      if (isMounted) {
        setFlowState({ loading: false, questionnaireDone, questionnaireStep, paywallSeen });
      }
    }

    void loadFlowState();

    return () => {
      isMounted = false;
    };
  }, []);

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

  let destination: Href = "/(questionnaire)/ready";
  if (user && hasCompletedOnboarding) {
    destination = "/(tabs)";
  } else if (!user && !flowState.questionnaireDone) {
    destination = "/(questionnaire)/language";
  } else if (!user && flowState.questionnaireDone) {
    destination = "/(auth)/signup";
  } else if (user && !flowState.questionnaireDone) {
    destination = "/(questionnaire)/ready";
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
