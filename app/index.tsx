import { Redirect } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";

import { useAuth } from "@/lib/auth/AuthProvider";
import { getPaywallSeen, getQuestionnaireComplete } from "@/lib/onboarding/storage";
import { launchScreenColors, onboardingImages } from "@/lib/theme/onboarding";

export default function IndexScreen() {
  const { loading, user, hasCompletedOnboarding } = useAuth();
  const [flowState, setFlowState] = useState({
    loading: true,
    questionnaireDone: false,
    paywallSeen: false,
  });
  const mascotFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatingAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(mascotFloat, {
          toValue: -18,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(mascotFloat, {
          toValue: 18,
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
    let isMounted = true;

    async function loadFlowState() {
      const [questionnaireDone, paywallSeen] = await Promise.all([
        getQuestionnaireComplete(),
        getPaywallSeen(),
      ]);

      if (isMounted) {
        setFlowState({ loading: false, questionnaireDone, paywallSeen });
      }
    }

    void loadFlowState();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading || flowState.loading) {
    return (
      <View style={styles.loadingContainer}>
        <View pointerEvents="none" style={styles.logoContainer}>
          <Image source={onboardingImages.logo} style={styles.logo} resizeMode="contain" />
        </View>
        <Animated.View style={[styles.mascotContainer, { transform: [{ translateY: mascotFloat }] }]}>
          <Image source={onboardingImages.mascot} style={styles.mascot} resizeMode="contain" />
        </Animated.View>
      </View>
    );
  }

  if (user && hasCompletedOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  if (!user && !flowState.questionnaireDone) {
    return <Redirect href="/(questionnaire)/welcome" />;
  }

  if (!user && flowState.questionnaireDone) {
    return <Redirect href="/(auth)/signup" />;
  }

  if (user && !flowState.questionnaireDone) {
    return <Redirect href="/(questionnaire)/setup" />;
  }

  if (user && !flowState.paywallSeen) {
    return <Redirect href="/(paywall)/offer" />;
  }

  return <Redirect href="/(questionnaire)/setup" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: launchScreenColors.bgLight,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    position: "absolute",
    bottom: 118,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 320,
    height: 168,
  },
  mascotContainer: {
    zIndex: 2,
  },
  mascot: {
    width: 660,
    height: 660,
  },
});
