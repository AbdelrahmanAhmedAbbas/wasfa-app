import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as ExpoFont from "expo-font";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { brandFontFamily } from "@/lib/theme/fonts";
import { launchScreenColors, onboardingImages } from "@/lib/theme/onboarding";

const COLORS = {
  bg: "#E8F5E0",
  primary: "#3D6B3D",
  text: "#1C2B1C",
  textMuted: "#6B7C6B",
  chipBg: "#FFFFFF",
  ctaOutline: "#a3d48f",
  white: "#FFFFFF",
} as const;

const CHIPS: Array<{ icon: React.ComponentProps<typeof Feather>["name"]; labelKey: "authChipPlan" | "authChipRecipes" | "authChipShop" }> = [
  { icon: "calendar", labelKey: "authChipPlan" },
  { icon: "link", labelKey: "authChipRecipes" },
  { icon: "shopping-cart", labelKey: "authChipShop" },
];

export default function WelcomeAuthScreen() {
  const { signInWithGoogle, user, hasCompletedOnboarding, loading } = useAuth();
  const { language, t, setLanguage } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [authSheetVisible, setAuthSheetVisible] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const sheetTranslateY = useRef(new Animated.Value(380)).current;

  const isRTL = language === "ar";
  const languageFontStyle =
    language === "ar" && ExpoFont.isLoaded(brandFontFamily.arabic)
      ? { fontFamily: brandFontFamily.arabic, fontWeight: "600" as const }
      : language !== "ar" && ExpoFont.isLoaded(brandFontFamily.english)
        ? { fontFamily: brandFontFamily.english }
        : null;

  useEffect(() => {
    if (!loading && user) {
      closeAuthSheet();
      if (hasCompletedOnboarding) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(onboarding)/welcome");
      }
    }
  }, [loading, user, hasCompletedOnboarding]);

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
      if (finished) setAuthSheetVisible(false);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Logo area with language picker overlay */}
        <View style={styles.logoArea}>
          <Image
            source={onboardingImages.logo}
            style={styles.logo}
            resizeMode="contain"
          />
          <Pressable
            style={({ pressed }) => [
              styles.langPill,
              pressed && styles.langPillPressed,
            ]}
            onPress={() => setLangOpen(true)}
          >
            <Text style={styles.langFlag}>{isRTL ? "🇸🇦" : "🇬🇧"}</Text>
            <Text style={[styles.langLabel, languageFontStyle]}>
              {isRTL ? "العربية" : "English"}
            </Text>
            <FontAwesome name="chevron-down" size={9} color={COLORS.textMuted} />
          </Pressable>
        </View>

        {/* Title & subtitle */}
        <View style={styles.textSection}>
          <Text
            allowFontScaling={false}
            style={[
              styles.title,
              { textAlign: "center" },
              languageFontStyle,
            ]}
          >
            {t("authWelcomeTitle")}
          </Text>
          <Text
            allowFontScaling={false}
            style={[
              styles.subtitle,
              { textAlign: "center" },
              languageFontStyle,
            ]}
          >
            {t("authWelcomeSub")}
          </Text>
        </View>

        {/* Feature chips */}
        <View style={styles.chipsRow}>
          {CHIPS.map(({ icon, labelKey }) => (
            <View key={labelKey} style={styles.chip}>
              <Feather name={icon} size={22} color={COLORS.primary} />
              <Text
                allowFontScaling={false}
                style={[styles.chipLabel, languageFontStyle]}
              >
                {t(labelKey)}
              </Text>
            </View>
          ))}
        </View>

        {/* CTA buttons */}
        <View style={styles.buttonsSection}>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              styles.btnPrimary,
              pressed && styles.btnPrimaryPressed,
            ]}
            onPress={openAuthSheet}
            disabled={isLoading}
          >
            <Text style={[styles.btnTextPrimary, languageFontStyle]}>
              {t("authWelcomeStart")}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.btn,
              styles.btnOutline,
              pressed && styles.btnOutlinePressed,
            ]}
            onPress={openAuthSheet}
            disabled={isLoading}
          >
            <Text style={[styles.btnTextOutline, languageFontStyle]}>
              {t("authWelcomeSignIn")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Language picker bottom sheet */}
      <Modal transparent visible={langOpen} animationType="slide" statusBarTranslucent>
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setLangOpen(false)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, languageFontStyle, { marginBottom: 16 }]}>
              {language === "ar" ? "اختر اللغة" : "Select Language"}
            </Text>
            {(["en", "ar"] as const).map((lang, i) => (
              <View key={lang}>
                {i > 0 && <View style={styles.langDivider} />}
                <Pressable
                  style={[styles.langOption, language === lang && styles.langOptionActive]}
                  onPress={async () => {
                    await setLanguage(lang);
                    setLangOpen(false);
                  }}
                >
                  <Text style={styles.langOptionFlag}>{lang === "ar" ? "🇸🇦" : "🇬🇧"}</Text>
                  <Text style={[styles.langOptionText, language === lang && styles.langOptionTextActive]}>
                    {lang === "ar" ? "العربية" : "English"}
                  </Text>
                  {language === lang && (
                    <FontAwesome name="check" size={16} color={COLORS.primary} />
                  )}
                </Pressable>
              </View>
            ))}
            <View style={{ height: 16 }} />
          </View>
        </View>
      </Modal>

      {/* Auth bottom sheet */}
      <Modal transparent visible={authSheetVisible} animationType="none" statusBarTranslucent>
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={closeAuthSheet} />
          <Animated.View style={[styles.sheetCard, { transform: [{ translateY: sheetTranslateY }] }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, languageFontStyle]}>{t("authSheetTitle")}</Text>
            <Text style={[styles.sheetSubtitle, languageFontStyle]}>{t("authSheetSubtitle")}</Text>

            <Pressable style={[styles.btn, styles.sheetGoogleButton]} onPress={handleGoogleAuth} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <View style={styles.buttonContent}>
                  <View style={styles.googleBadge}>
                    <FontAwesome name="google" size={15} color={COLORS.primary} />
                  </View>
                  <Text style={[styles.btnTextPrimary, languageFontStyle]}>{t("authContinueGoogle")}</Text>
                </View>
              )}
            </Pressable>

            <View style={styles.legalBox}>
              <Text style={[styles.legal, isRTL && styles.legalArabic, languageFontStyle]}>
                {t("authLegalPrefix")}
              </Text>
              <View style={styles.legalLinksRow}>
                <Pressable hitSlop={8} onPress={() => openLegalUrl("https://wasfa.life/terms-and-conditions")}>
                  <Text style={[styles.legalLink, languageFontStyle]}>{t("authLegalTerms")}</Text>
                </Pressable>
                <Text style={[styles.legal, isRTL && styles.legalArabic, languageFontStyle]}>
                  {t("authLegalAnd")}
                </Text>
                <Pressable hitSlop={8} onPress={() => openLegalUrl("https://wasfa.life/privacy-policy")}>
                  <Text style={[styles.legalLink, languageFontStyle]}>{t("authLegalPrivacy")}</Text>
                </Pressable>
                <Text style={[styles.legal, isRTL && styles.legalArabic, languageFontStyle]}>
                  {t("authLegalSuffix")}
                </Text>
              </View>
            </View>

            <Pressable style={styles.sheetCancelButton} onPress={closeAuthSheet}>
              <Text style={[styles.sheetCancelText, languageFontStyle]}>{t("commonBack")}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 24,
  },

  // Logo area
  logoArea: {
    height: 210,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  logo: {
    width: 250,
    height: 122,
  },
  langPill: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    gap: 7,
    shadowColor: COLORS.text,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  langPillPressed: {
    backgroundColor: launchScreenColors.accentWarm,
  },
  langFlag: {
    fontSize: 17,
    lineHeight: 21,
  },
  langLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
  },

  // Text section
  textSection: {
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -1,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    lineHeight: 23,
  },

  // Chips
  chipsRow: {
    flexDirection: "row",
    gap: 10,
  },
  chip: {
    flex: 1,
    backgroundColor: COLORS.chipBg,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 8,
    shadowColor: COLORS.text,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    textAlign: "center",
    lineHeight: 15,
  },

  // Buttons
  buttonsSection: {
    gap: 12,
  },
  btn: {
    height: 56,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  btnPrimaryPressed: {
    backgroundColor: "#2E5530",
  },
  btnOutline: {
    backgroundColor: "transparent",
    borderColor: COLORS.ctaOutline,
  },
  btnOutlinePressed: {
    backgroundColor: launchScreenColors.accentWarm,
  },
  btnTextPrimary: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  btnTextOutline: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
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

  // Sheet shared
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28,43,28,0.28)",
  },
  sheetCard: {
    backgroundColor: COLORS.chipBg,
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
    color: COLORS.text,
    textAlign: "center",
    fontWeight: "500",
  },
  sheetSubtitle: {
    marginTop: 4,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  sheetGoogleButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
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
    color: COLORS.textMuted,
    fontWeight: "400",
  },

  // Language sheet
  langDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: launchScreenColors.divider,
    marginHorizontal: 14,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  langOptionActive: {
    backgroundColor: launchScreenColors.accentWarm,
    borderRadius: 16,
  },
  langOptionFlag: {
    fontSize: 19,
  },
  langOptionText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  langOptionTextActive: {
    fontWeight: "600",
    color: COLORS.primary,
  },

  // Legal
  legalBox: {
    alignItems: "center",
    paddingHorizontal: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  legal: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  legalArabic: {
    lineHeight: 18,
  },
  legalLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  legalLink: {
    fontSize: 12,
    color: COLORS.primary,
    textDecorationLine: "underline",
  },
});
