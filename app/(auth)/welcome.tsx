import { router } from "expo-router";
import * as ExpoFont from "expo-font";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, Easing, Image, Linking, Modal, Pressable, SafeAreaView, StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { brandFontFamily } from "@/lib/theme/fonts";
import { launchScreenColors, onboardingImages } from "@/lib/theme/onboarding";

export default function WelcomeAuthScreen() {
  const { signInWithGoogle } = useAuth();
  const { language, t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const [authSheetVisible, setAuthSheetVisible] = useState(false);
  const transition = useRef(new Animated.Value(0)).current;
  const mascotFloat = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(380)).current;

  useEffect(() => {
    const introAnimation = Animated.sequence([
      Animated.delay(3400),
      Animated.timing(transition, {
        toValue: 1,
        duration: 940,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);

    introAnimation.start(({ finished }) => {
      if (finished) {
        setIsIntroComplete(true);
      }
    });

    return () => introAnimation.stop();
  }, [transition]);

  useEffect(() => {
    const floatingAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(mascotFloat, {
          toValue: -18,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(mascotFloat, {
          toValue: 18,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    floatingAnimation.start();
    return () => floatingAnimation.stop();
  }, [mascotFloat]);

  const openAuthSheet = () => {
    setAuthSheetVisible(true);
    sheetTranslateY.setValue(380);
    Animated.timing(sheetTranslateY, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeAuthSheet = () => {
    Animated.timing(sheetTranslateY, {
      toValue: 380,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setAuthSheetVisible(false);
      }
    });
  };

  const handleGoogleAuth = async () => {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
    const hasPlaceholderCredentials =
      !supabaseUrl ||
      !supabaseAnonKey ||
      supabaseUrl.includes("placeholder") ||
      supabaseAnonKey.includes("placeholder");

    if (hasPlaceholderCredentials) {
      Alert.alert(t("authConfigTitle"), t("authConfigMessage"));
      return;
    }

    try {
      setIsLoading(true);
      await signInWithGoogle();
      closeAuthSheet();
      router.replace("/(tabs)");
    } catch (error) {
      console.error("Failed to sign in with Google:", error);
      Alert.alert(t("authErrorTitle"), t("authErrorMessage"));
    } finally {
      setIsLoading(false);
    }
  };

  const openLegalUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error("Failed to open legal URL:", error);
      Alert.alert(t("authErrorTitle"), t("authLegalOpenError"));
    }
  };

  const backgroundColor = transition.interpolate({
    inputRange: [0, 1],
    outputRange: [launchScreenColors.bgLight, launchScreenColors.bgWarm],
  });
  const mascotTranslateY = transition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -96],
  });
  const mascotOpacity = transition.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 1, 0],
  });
  const mascotScale = transition.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.9],
  });
  const logoOpacity = transition.interpolate({
    inputRange: [0.45, 1],
    outputRange: [0, 1],
  });
  const logoScale = transition.interpolate({
    inputRange: [0.45, 1],
    outputRange: [0.82, 1],
  });
  const contentOpacity = transition.interpolate({
    inputRange: [0.36, 1],
    outputRange: [0, 1],
  });
  const contentTranslateY = transition.interpolate({
    inputRange: [0.36, 1],
    outputRange: [44, 0],
  });
  const isArabic = language === "ar";
  const languageFontStyle =
    language === "ar" && ExpoFont.isLoaded(brandFontFamily.arabic)
      ? { fontFamily: brandFontFamily.arabic }
      : null;

  return (
    <Animated.View style={[styles.container, { backgroundColor }]}>
      <View pointerEvents="none" style={styles.waveTop} />
      <View pointerEvents="none" style={styles.waveBottom} />

      <SafeAreaView style={styles.safeArea}>
        <View pointerEvents="none" style={styles.heroSection}>
          <Animated.View
            style={[
              styles.mascotWrapper,
              {
                opacity: mascotOpacity,
                transform: [{ translateY: Animated.add(mascotTranslateY, mascotFloat) }, { scale: mascotScale }],
              },
            ]}
          >
            <Image source={onboardingImages.mascot} style={styles.mascot} resizeMode="contain" />
          </Animated.View>

          <Animated.View pointerEvents="none" style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
            <Image source={onboardingImages.logo} style={styles.logo} resizeMode="contain" />
          </Animated.View>
        </View>

        <Animated.View
          pointerEvents={isIntroComplete ? "auto" : "none"}
          style={[
            styles.contentSection,
            { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] },
          ]}
        >
          <Text allowFontScaling={false} style={[styles.title, !isArabic && styles.titleEnglish, isArabic && styles.titleArabic, languageFontStyle]}>
            {t("authHeroTitle")}
          </Text>
          <Text allowFontScaling={false} style={[styles.subtitle, isArabic && styles.subtitleArabic, languageFontStyle]}>
            {t("authHeroSubtitle")}
          </Text>

          <View style={styles.buttonStack}>
            <Pressable style={[styles.button, styles.getStartedButton]} onPress={() => router.push("/(onboarding)/welcome")} disabled={isLoading}>
              <Text style={[styles.buttonText, styles.getStartedButtonText, languageFontStyle]}>{t("authGetStarted")}</Text>
            </Pressable>
          </View>

          <Pressable style={styles.alreadyAccountButton} onPress={openAuthSheet} disabled={isLoading}>
            <Text style={[styles.alreadyAccountText, languageFontStyle]}>{t("authAlreadyAccount")}</Text>
          </Pressable>

          <View style={styles.legalContainer}>
            <Text style={[styles.legal, isArabic && styles.legalArabic, languageFontStyle]}>{t("authLegalPrefix")}</Text>
            <View style={styles.legalLinksRow}>
              <Pressable hitSlop={8} onPress={() => openLegalUrl("https://wasfa.life/terms-and-conditions")}>
                <Text style={[styles.legalLink, languageFontStyle]}>{t("authLegalTerms")}</Text>
              </Pressable>
              <Text style={[styles.legal, isArabic && styles.legalArabic, languageFontStyle]}>{t("authLegalAnd")}</Text>
              <Pressable hitSlop={8} onPress={() => openLegalUrl("https://wasfa.life/privacy-policy")}>
                <Text style={[styles.legalLink, languageFontStyle]}>{t("authLegalPrivacy")}</Text>
              </Pressable>
              <Text style={[styles.legal, isArabic && styles.legalArabic, languageFontStyle]}>{t("authLegalSuffix")}</Text>
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>

      <Modal transparent visible={authSheetVisible} animationType="none" statusBarTranslucent>
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={closeAuthSheet} />
          <Animated.View style={[styles.sheetCard, { transform: [{ translateY: sheetTranslateY }] }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, languageFontStyle]}>{t("authSheetTitle")}</Text>
            <Text style={[styles.sheetSubtitle, languageFontStyle]}>{t("authSheetSubtitle")}</Text>

            <Pressable style={[styles.button, styles.sheetGoogleButton]} onPress={handleGoogleAuth} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color={launchScreenColors.surface} />
              ) : (
                <View style={styles.buttonContent}>
                  <View style={styles.googleBadge}>
                    <FontAwesome name="google" size={15} color={launchScreenColors.primaryDark} />
                  </View>
                  <Text style={[styles.buttonText, styles.loginButtonText, languageFontStyle]}>{t("authContinueGoogle")}</Text>
                </View>
              )}
            </Pressable>

            <Pressable style={styles.sheetCancelButton} onPress={closeAuthSheet}>
              <Text style={[styles.sheetCancelText, languageFontStyle]}>{t("commonBack")}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    direction: "ltr",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 22,
    direction: "ltr",
  },
  waveTop: {
    position: "absolute",
    top: -130,
    right: -90,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: launchScreenColors.accent,
  },
  waveBottom: {
    position: "absolute",
    bottom: -180,
    left: -110,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: launchScreenColors.accentWarm,
  },
  languageSection: {
    position: "relative",
    zIndex: 40,
    alignItems: "center",
    marginTop: 6,
    height: 70,
    justifyContent: "space-between",
  },
  languageLabel: {
    fontSize: 13,
    lineHeight: 16,
    height: 16,
    color: launchScreenColors.textSecondary,
    fontWeight: "400",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  languageToggle: {
    width: 220,
    height: 43,
    flexDirection: "row",
    direction: "ltr",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: launchScreenColors.divider,
    backgroundColor: launchScreenColors.surface,
    padding: 3,
    alignItems: "center",
  },
  languageActiveBackground: {
    position: "absolute",
    left: 3,
    top: 3,
    width: 105,
    height: 37,
    borderRadius: 999,
    backgroundColor: launchScreenColors.primary,
  },
  languageOption: {
    width: 105,
    height: 37,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  languageOptionText: {
    fontSize: 13,
    fontWeight: "400",
    color: launchScreenColors.textSecondary,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  languageOptionTextActive: {
    color: launchScreenColors.surface,
  },
  heroSection: {
    position: "relative",
    zIndex: 10,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },
  logoContainer: {
    position: "absolute",
    zIndex: 5,
    top: 120,
    width: 340,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 300,
    height: 150,
  },
  mascotWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  mascot: {
    width: 220,
    height: 220,
  },
  contentSection: {
    position: "absolute",
    zIndex: 30,
    left: 22,
    right: 22,
    bottom: 100,
    alignItems: "center",
  },
  title: {
    marginTop: 20,
    fontSize: 33,
    lineHeight: 41,
    fontWeight: "400",
    color: launchScreenColors.primaryDark,
    textAlign: "center",
    letterSpacing: -1,
  },
  titleArabic: {
    lineHeight: 43,
    letterSpacing: 0,
  },
  titleEnglish: {
    marginTop: 40,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 20,
    lineHeight: 30,
    color: launchScreenColors.textSecondary,
    textAlign: "center",
    maxWidth: 360,
    fontWeight: "400",
  },
  subtitleArabic: {
    lineHeight: 32,
  },
  buttonStack: {
    width: "100%",
    marginTop: 32,
  },
  button: {
    minHeight: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "400",
    letterSpacing: 0.2,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: launchScreenColors.accentWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  getStartedButton: {
    backgroundColor: launchScreenColors.accent,
    borderColor: launchScreenColors.primaryLight,
    shadowColor: launchScreenColors.primary,
    shadowOpacity: 0.11,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  getStartedButtonText: {
    color: launchScreenColors.primaryDark,
  },
  alreadyAccountButton: {
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  alreadyAccountText: {
    fontSize: 18,
    lineHeight: 22,
    color: launchScreenColors.text,
    textDecorationLine: "underline",
    fontWeight: "400",
  },
  loginButtonText: {
    color: launchScreenColors.surface,
  },
  legalContainer: {
    marginTop: 16,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  legal: {
    fontSize: 12,
    lineHeight: 18,
    color: launchScreenColors.textSecondary,
    textAlign: "center",
  },
  legalLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  legalArabic: {
    lineHeight: 18,
  },
  legalLink: {
    color: launchScreenColors.primaryDark,
    textDecorationLine: "underline",
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
    backgroundColor: launchScreenColors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderColor: launchScreenColors.divider,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: launchScreenColors.divider,
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 24,
    lineHeight: 30,
    color: launchScreenColors.text,
    textAlign: "center",
    fontWeight: "500",
  },
  sheetSubtitle: {
    marginTop: 4,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 20,
    color: launchScreenColors.textSecondary,
    textAlign: "center",
  },
  sheetGoogleButton: {
    backgroundColor: launchScreenColors.primaryDark,
    borderColor: launchScreenColors.primaryDark,
    shadowColor: launchScreenColors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  sheetCancelButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: launchScreenColors.divider,
    backgroundColor: launchScreenColors.bgLight,
  },
  sheetCancelText: {
    fontSize: 15,
    lineHeight: 20,
    color: launchScreenColors.textSecondary,
    fontWeight: "400",
  },
});
