import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { setQuestionnaireStep } from "@/lib/onboarding/storage";
import { launchScreenColors, onboardingImages } from "@/lib/theme/onboarding";

export default function QuestionnaireWelcomeScreen() {
  const { language, setLanguage, t } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
  const heroScale = useRef(new Animated.Value(0.92)).current;
  const textY = useRef(new Animated.Value(24)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroScale, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(textY, {
        toValue: 0,
        duration: 520,
        delay: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 520,
        delay: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroScale, textOpacity, textY]);

  const handleContinue = async () => {
    await setQuestionnaireStep(1);
    router.push("/(questionnaire)/goal");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <Pressable style={styles.languagePill} onPress={() => setLangOpen(true)}>
          <Text style={styles.languageText}>{language === "ar" ? "العربية" : "English"}</Text>
          <FontAwesome name="chevron-down" size={10} color={launchScreenColors.primaryDark} />
        </Pressable>

        <Animated.View style={[styles.imageWrap, { transform: [{ scale: heroScale }] }]}>
          <Image source={onboardingImages.logo} style={styles.heroImage} resizeMode="contain" />
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.copy,
          {
            opacity: textOpacity,
            transform: [{ translateY: textY }],
          },
        ]}
      >
        <Text style={styles.title}>{t("qWelcomeTitle")}</Text>
        <Text style={styles.subtitle}>{t("qWelcomeSubtitle")}</Text>
      </Animated.View>

      <View style={styles.footer}>
        <Pressable style={styles.cta} onPress={handleContinue}>
          <Text style={styles.ctaText}>{t("qWelcomeCta")}</Text>
        </Pressable>
      </View>

      <Modal transparent visible={langOpen} animationType="slide" statusBarTranslucent>
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setLangOpen(false)} />
          <View style={styles.sheetCard}>
            {(["en", "ar"] as const).map((lang) => (
              <Pressable
                key={lang}
                style={[styles.langOption, language === lang && styles.langOptionActive]}
                onPress={async () => {
                  await setLanguage(lang);
                  setLangOpen(false);
                }}
              >
                <Text style={styles.langOptionText}>{lang === "ar" ? "العربية" : "English"}</Text>
                {language === lang ? (
                  <FontAwesome name="check" size={16} color={launchScreenColors.primaryDark} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F2F8E9",
  },
  hero: {
    flex: 0.9,
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  languagePill: {
    position: "absolute",
    top: 18,
    zIndex: 2,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  languageText: {
    fontSize: 14,
    fontWeight: "700",
    color: launchScreenColors.primaryDark,
  },
  imageWrap: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 54,
  },
  heroImage: {
    width: 340,
    height: 166,
  },
  copy: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  title: {
    fontSize: 46,
    lineHeight: 49,
    fontWeight: "900",
    color: launchScreenColors.text,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 14,
    fontSize: 17,
    lineHeight: 25,
    color: launchScreenColors.textSecondary,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  cta: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: launchScreenColors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28,43,28,0.28)",
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 8,
  },
  langOption: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  langOptionActive: {
    backgroundColor: launchScreenColors.accent,
  },
  langOptionText: {
    fontSize: 17,
    fontWeight: "700",
    color: launchScreenColors.text,
  },
});
