import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { MascotBadge } from "@/components/onboarding/MascotBadge";
import { headingStyle } from "@/components/onboarding/text-styles";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { getOnboardingAnswers, type OnboardingAnswers } from "@/lib/onboarding/answers";
import { DIET_OPTIONS, getHouseholdOption } from "@/lib/onboarding/flow";
import { wasfaColors } from "@/lib/theme/wasfa";

const QUOTES: { quoteKey: TranslationKey; byKey: TranslationKey }[] = [
  { quoteKey: "qProofQuoteA", byKey: "qProofQuoteABy" },
  { quoteKey: "qProofQuoteB", byKey: "qProofQuoteBBy" },
  { quoteKey: "qProofQuoteC", byKey: "qProofQuoteCBy" },
];
// Quadrants of the four-colour Google ring, clockwise from the top-right.
const GOOGLE_QUADRANTS = [
  { color: "#EA4335", top: 0, left: 11 },
  { color: "#FBBC05", top: 11, left: 11 },
  { color: "#34A853", top: 11, left: 0 },
  { color: "#4285F4", top: 0, left: 0 },
];

export default function SignupAuthScreen() {
  const { signInWithGoogle, signInWithApple, user, loading } = useAuth();
  const { isRTL, t } = useLanguage();
  const insets = useSafeAreaInsets();
  // "I already have an account" on the intro replaces the questionnaire with
  // this screen, so that entry gets a way back.
  const { from } = useLocalSearchParams<{ from?: string }>();
  const cameFromIntro = from === "intro";
  const [isLoading, setIsLoading] = useState(false);
  const [answers, setAnswers] = useState<OnboardingAnswers | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/(paywall)/offer");
    }
  }, [loading, user]);

  useEffect(() => {
    let isMounted = true;

    void getOnboardingAnswers().then((saved) => {
      if (isMounted) setAnswers(saved);
    });

    return () => {
      isMounted = false;
    };
  }, []);

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

  const handleAppleAuth = async () => {
    try {
      setIsLoading(true);
      await signInWithApple();
    } catch (error) {
      console.error("Failed to sign in with Apple:", error);
      Alert.alert(t("authErrorTitle"), t("authErrorMessage"));
    } finally {
      setIsLoading(false);
    }
  };

  // The kitchen card strip only makes sense once the chat has been answered.
  const kitchenSummary = answers?.householdSize
    ? `${t(getHouseholdOption(answers.householdSize).labelKey)} · ${
        DIET_OPTIONS.filter((option) => answers.diet.includes(option.id))
          .map((option) => t(option.labelKey))
          .join(isRTL ? "، " : ", ") || t("obNoPref")
      }`
    : null;
  const quotes = QUOTES;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      {cameFromIntro ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          hitSlop={8}
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={() => router.replace("/(questionnaire)/intro")}
        >
          <Feather
            name={isRTL ? "chevron-right" : "chevron-left"}
            size={18}
            color={wasfaColors.ink}
          />
        </Pressable>
      ) : null}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 52, paddingBottom: Math.max(insets.bottom + 16, 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {kitchenSummary ? (
          <View style={styles.kitchenStrip}>
            <MascotBadge size={52} imageHeight={58} offset={16} />
            <View style={styles.kitchenCopy}>
              <Text style={styles.kitchenTitle}>{t("obKitchenTag")}</Text>
              <Text style={styles.kitchenSummary}>{kitchenSummary}</Text>
            </View>
            <Feather name="lock" size={20} color="#FFFFFF" />
          </View>
        ) : null}

        <Text style={[styles.title, headingStyle(30, isRTL)]}>{t("obSignupTitle")}</Text>
        <Text style={styles.subtitle}>{t("obSignupBody")}</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quoteScroll}
          contentContainerStyle={styles.quoteRow}
        >
          {quotes.map((quote) => (
            <View key={quote.quoteKey} style={styles.quoteCard}>
              <View style={styles.stars}>
                {[0, 1, 2, 3, 4].map((star) => (
                  <Feather key={star} name="star" size={13} color={wasfaColors.cta} />
                ))}
              </View>
              <Text style={styles.quoteText}>{t(quote.quoteKey)}</Text>
              <Text style={styles.quoteBy}>{t(quote.byKey)}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.spacer} />

        <Pressable
          accessibilityRole="button"
          style={[styles.button, styles.appleButton]}
          onPress={handleAppleAuth}
          disabled={isLoading}
        >
          <FontAwesome name="apple" size={20} color="#FFFFFF" />
          <Text style={styles.appleText}>{t("obSignupApple")}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={[styles.button, styles.googleButton]}
          onPress={handleGoogleAuth}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={wasfaColors.primaryDark} />
          ) : (
            <>
              <View style={styles.googleMark}>
                {GOOGLE_QUADRANTS.map(({ color, top, left }) => (
                  <View
                    key={color}
                    style={[styles.googleQuadrant, { backgroundColor: color, top, left }]}
                  />
                ))}
                <View style={styles.googleMarkCenter} />
              </View>
              <Text style={styles.googleText}>{t("qSignupGoogle")}</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.terms}>{t("obTerms")}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: wasfaColors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    gap: 14,
  },
  backButton: {
    position: "absolute",
    start: 16,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  kitchenStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 22,
    backgroundColor: wasfaColors.primary,
  },
  kitchenCopy: {
    flex: 1,
    gap: 2,
  },
  kitchenTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "left",
  },
  kitchenSummary: {
    fontSize: 12,
    color: "#FFFFFF",
    opacity: 0.85,
    textAlign: "left",
  },
  title: {
    marginTop: 8,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: wasfaColors.muted,
    textAlign: "left",
  },
  quoteScroll: {
    flexGrow: 0,
    marginVertical: 4,
    marginHorizontal: -20,
  },
  quoteRow: {
    paddingHorizontal: 20,
    gap: 10,
  },
  quoteCard: {
    width: 220,
    padding: 14,
    gap: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
  },
  stars: {
    flexDirection: "row",
    gap: 2,
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  quoteBy: {
    fontSize: 12,
    color: wasfaColors.muted,
    textAlign: "left",
  },
  spacer: {
    flex: 1,
  },
  button: {
    height: 56,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  appleButton: {
    backgroundColor: "#111111",
  },
  appleText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  googleButton: {
    borderWidth: 1.5,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
  },
  googleText: {
    fontSize: 16,
    fontWeight: "700",
    color: wasfaColors.ink,
  },
  // Four-colour ring standing in for the Google "G" (see GOOGLE_QUADRANTS).
  googleMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  googleQuadrant: {
    position: "absolute",
    width: 11,
    height: 11,
  },
  googleMarkCenter: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: wasfaColors.surface,
  },
  terms: {
    fontSize: 11,
    lineHeight: 15,
    color: wasfaColors.muted,
    textAlign: "center",
  },
});
