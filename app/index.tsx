import { Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, View } from "react-native";

import { MASCOT_ASPECT } from "@/components/onboarding/MascotBadge";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  getPaywallSeen,
  getQuestionnaireComplete,
  getQuestionnaireStep,
} from "@/lib/onboarding/storage";
import { onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors } from "@/lib/theme/wasfa";

// First-time visitors see the splash for a beat before the language picker;
// a tap skips the wait. Everyone else leaves as soon as loading finishes.
const FIRST_RUN_SPLASH_MS = 1100;
const MASCOT_HEIGHT = 300;
const LOGO_WIDTH = 190;
// logo.png is 730x357.
const LOGO_ASPECT = 730 / 357;

export default function IndexScreen() {
  const { loading, user, hasCompletedOnboarding } = useAuth();
  const [flowState, setFlowState] = useState({
    loading: true,
    questionnaireDone: false,
    questionnaireStep: 0,
    paywallSeen: false,
  });
  const [splashHeld, setSplashHeld] = useState(true);
  const mascotFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatingAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(mascotFloat, {
          toValue: -6,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(mascotFloat, {
          toValue: 6,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    floatingAnimation.start();
    return () => floatingAnimation.stop();
  }, [mascotFloat]);

  useEffect(() => {
    const timer = setTimeout(() => setSplashHeld(false), FIRST_RUN_SPLASH_MS);
    return () => clearTimeout(timer);
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

  const isLoading = loading || flowState.loading;
  const isFirstRun =
    !isLoading && !user && !flowState.questionnaireDone && flowState.questionnaireStep === 0;

  if (isLoading || (isFirstRun && splashHeld)) {
    return (
      <Pressable
        accessible={false}
        style={styles.splash}
        onPress={() => setSplashHeld(false)}
      >
        <StatusBar style="dark" />
        <View pointerEvents="none" style={styles.rings}>
          <View style={styles.dashedRing} />
          <View style={styles.glow} />
        </View>
        <Animated.View style={{ transform: [{ translateY: mascotFloat }] }}>
          <Image source={onboardingImages.mascot} style={styles.mascot} resizeMode="contain" />
        </Animated.View>
        <Image source={onboardingImages.logo} style={styles.logo} resizeMode="contain" />
      </Pressable>
    );
  }

  if (user && hasCompletedOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  if (!user && !flowState.questionnaireDone) {
    return <Redirect href="/(questionnaire)/language" />;
  }

  if (!user && flowState.questionnaireDone) {
    return <Redirect href="/(auth)/signup" />;
  }

  if (user && !flowState.questionnaireDone) {
    return <Redirect href="/(questionnaire)/ready" />;
  }

  if (user && !flowState.paywallSeen) {
    return <Redirect href="/(paywall)/offer" />;
  }

  return <Redirect href="/(questionnaire)/ready" />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: wasfaColors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  // Both circles share a centre that sits behind the mascot's upper body.
  rings: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -60 }],
  },
  dashedRing: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: 260,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(90,138,90,0.25)",
  },
  glow: {
    position: "absolute",
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  mascot: {
    height: MASCOT_HEIGHT,
    width: MASCOT_HEIGHT * MASCOT_ASPECT,
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_WIDTH / LOGO_ASPECT,
    marginTop: -20,
  },
});
