import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors } from "@/lib/theme/onboarding";
import { setOnboardingStep } from "@/lib/onboarding/storage";

const onboardingOneImage = require("../../assets/images/onboarding-1.png");

const folderExamples = [
  { id: 1, name: "Breakfast", count: 24, color: "#FFE5E5" },
  { id: 2, name: "Dinner", count: 18, color: "#E5F0FF" },
  { id: 3, name: "Desserts", count: 12, color: "#FFF3E0" },
  { id: 4, name: "Quick Meals", count: 31, color: "#E8F5E9" },
];

const PHASE_1_DURATION = 2500;
const FADE_DURATION = 400;
const STAGGER_DELAY = 300;

type AnimatedTitleProps = {
  text: string;
  delay: number;
  startAnimation: boolean;
  color?: string;
  fontSize?: number;
};

function AnimatedTitle({ text, delay, startAnimation, color, fontSize = 45 }: AnimatedTitleProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    if (startAnimation) {
      opacity.value = withDelay(delay, withTiming(1, { duration: FADE_DURATION }));
      translateY.value = withDelay(delay, withTiming(0, { duration: FADE_DURATION }));
    }
  }, [startAnimation, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.Text
      style={[
        styles.titleText,
        { color: color || onboardingColors.primaryDark, fontSize },
        animatedStyle,
      ]}
    >
      {text}
    </Animated.Text>
  );
}

export default function WelcomeOnboardingScreen() {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<1 | 2>(1);
  const [showPhase1, setShowPhase1] = useState(false);
  const [showPhase2, setShowPhase2] = useState(false);

  useEffect(() => {
    setShowPhase1(true);
    const timer = setTimeout(() => {
      setShowPhase1(false);
      setTimeout(() => {
        setPhase(2);
        setShowPhase2(true);
      }, FADE_DURATION);
    }, PHASE_1_DURATION);

    return () => clearTimeout(timer);
  }, []);

  const handleContinue = async () => {
    await setOnboardingStep(1);
    router.push("/(onboarding)/savings");
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(auth)/signup");
  };

  const accentOrange = "#F5A623";

  return (
    <OnboardingScaffold
      title=""
      showContinueButton={false}
      onBack={handleBack}
      onContinue={handleContinue}
    >
      <View style={styles.contentWrap}>
        <Image source={onboardingOneImage} style={styles.heroImage} resizeMode="cover" />

        {phase === 1 && (
          <View style={styles.titlesContainer}>
            <AnimatedTitle
              text={t("onStep1Title1")}
              delay={0}
              startAnimation={showPhase1}
              color={accentOrange}
              fontSize={52}
            />
            <AnimatedTitle
              text={t("onStep1Title2")}
              delay={STAGGER_DELAY}
              startAnimation={showPhase1}
              color={accentOrange}
              fontSize={52}
            />
            <AnimatedTitle
              text={t("onStep1Title3")}
              delay={STAGGER_DELAY * 2}
              startAnimation={showPhase1}
              color={accentOrange}
              fontSize={28}
            />
          </View>
        )}

        {phase === 2 && (
          <View style={styles.phase2Container}>
            <View style={styles.titlesContainer}>
              <AnimatedTitle
                text={t("onStep1Title4")}
                delay={0}
                startAnimation={showPhase2}
                fontSize={45}
              />
              <AnimatedTitle
                text={t("onStep1Title5")}
                delay={STAGGER_DELAY}
                startAnimation={showPhase2}
                fontSize={45}
              />
              <AnimatedTitle
                text={t("onStep1Title6")}
                delay={STAGGER_DELAY * 2}
                startAnimation={showPhase2}
                fontSize={28}
              />
            </View>

            <View style={styles.folderGridContainer}>
              {folderExamples.map((folder) => (
                <View key={folder.id} style={[styles.folderCard, { backgroundColor: folder.color }]}>
                  <Text style={styles.folderName}>{folder.name}</Text>
                  <Text style={styles.folderCount}>{folder.count} recipes</Text>
                </View>
              ))}
            </View>

            <Text style={styles.folderInfo}>{t("onStep1FolderInfo")}</Text>

            <Pressable style={styles.nextButton} onPress={handleContinue}>
              <Text style={styles.nextButtonText}>{t("commonContinue")}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  contentWrap: {
    marginTop: 0,
    alignItems: "center",
    width: "100%",
  },
  heroImage: {
    width: "100%",
    height: 280,
  },
  titlesContainer: {
    marginTop: 24,
    alignItems: "center",
    width: "100%",
  },
  titleText: {
    lineHeight: 56,
    fontWeight: "900",
    letterSpacing: -1,
    textAlign: "center",
  },
  phase2Container: {
    width: "100%",
    alignItems: "center",
  },
  folderGridContainer: {
    marginTop: 24,
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  folderCard: {
    width: "48%",
    aspectRatio: 1.2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    justifyContent: "flex-end",
  },
  folderName: {
    fontSize: 16,
    fontWeight: "700",
    color: onboardingColors.primaryDark,
  },
  folderCount: {
    fontSize: 13,
    fontWeight: "500",
    color: onboardingColors.textMuted,
    marginTop: 4,
  },
  folderInfo: {
    marginTop: 16,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500",
    color: onboardingColors.textMuted,
    textAlign: "center",
    maxWidth: 280,
  },
  nextButton: {
    marginTop: 24,
    minWidth: 200,
    height: 52,
    borderRadius: 26,
    backgroundColor: onboardingColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  nextButtonText: {
    fontSize: 19,
    lineHeight: 21,
    fontWeight: "700",
    color: onboardingColors.textOnDark,
    letterSpacing: 0,
  },
});
