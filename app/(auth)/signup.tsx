import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { MascotBadge } from "@/components/onboarding/MascotBadge";
import { headingStyle } from "@/components/onboarding/text-styles";
import { CtaButton } from "@/components/wasfa/CtaButton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSignInActions } from "@/lib/auth/useSignInActions";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { getOnboardingAnswers, type OnboardingAnswers } from "@/lib/onboarding/answers";
import { DIET_OPTIONS, getHouseholdOption } from "@/lib/onboarding/flow";
import { onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors } from "@/lib/theme/wasfa";

type Review = {
  quoteKey: TranslationKey;
  nameKey: TranslationKey;
  placeKey: TranslationKey;
  /** Avatar circle and initial colours. */
  tint: string;
  ink: string;
};

const REVIEWS: Review[] = [
  {
    quoteKey: "qProofQuoteA",
    nameKey: "qProofQuoteAName",
    placeKey: "qProofQuoteAPlace",
    tint: wasfaColors.primarySoft,
    ink: wasfaColors.primaryDark,
  },
  {
    quoteKey: "qProofQuoteB",
    nameKey: "qProofQuoteBName",
    placeKey: "qProofQuoteBPlace",
    tint: wasfaColors.ctaSoft,
    ink: wasfaColors.cta,
  },
  {
    quoteKey: "qProofQuoteC",
    nameKey: "qProofQuoteCName",
    placeKey: "qProofQuoteCPlace",
    tint: wasfaColors.primarySoft,
    ink: wasfaColors.primaryDark,
  },
];

export default function SignupAuthScreen() {
  const { user, loading } = useAuth();
  const { isRTL, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { pending, withApple, withGoogle, withEmail } = useSignInActions();
  const isLoading = pending !== null;
  const [answers, setAnswers] = useState<OnboardingAnswers | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  const canSubmitEmail = email.trim().length > 0 && password.length > 0 && !isLoading;

  const handleEmailAuth = () => {
    if (canSubmitEmail) void withEmail(email, password);
  };

  // The kitchen card strip only makes sense once the chat has been answered.
  const kitchenSummary = answers?.householdSize
    ? `${t(getHouseholdOption(answers.householdSize).labelKey)} · ${
        DIET_OPTIONS.filter((option) => answers.diet.includes(option.id))
          .map((option) => t(option.labelKey))
          .join(isRTL ? "، " : ", ") || t("obNoPref")
      }`
    : null;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 52, paddingBottom: Math.max(insets.bottom + 16, 40) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
          {REVIEWS.map((review) => {
            const name = t(review.nameKey);

            return (
              <View key={review.quoteKey} style={styles.quoteCard}>
                <View style={styles.stars}>
                  {[0, 1, 2, 3, 4].map((star) => (
                    <FontAwesome key={star} name="star" size={14} color={wasfaColors.cta} />
                  ))}
                </View>
                <Text style={styles.quoteText}>{t(review.quoteKey)}</Text>
                <View style={styles.reviewer}>
                  <View style={[styles.avatar, { backgroundColor: review.tint }]}>
                    <Text style={[styles.avatarInitial, { color: review.ink }]}>
                      {name.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.reviewerCopy}>
                    <Text style={styles.reviewerName}>{name}</Text>
                    <Text style={styles.reviewerPlace}>{t(review.placeKey)}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.spacer} />

        <Pressable
          accessibilityRole="button"
          style={[styles.button, styles.appleButton]}
          onPress={() => void withApple()}
          disabled={isLoading}
        >
          {pending === "apple" ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="logo-apple" size={21} color="#FFFFFF" style={styles.appleMark} />
              <Text style={styles.appleText}>{t("obSignupApple")}</Text>
            </>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={[styles.button, styles.googleButton]}
          onPress={() => void withGoogle()}
          disabled={isLoading}
        >
          {pending === "google" ? (
            <ActivityIndicator color={wasfaColors.primaryDark} />
          ) : (
            <>
              <Image source={onboardingImages.googleLogo} style={styles.googleLogo} />
              <Text style={styles.googleText}>{t("qSignupGoogle")}</Text>
            </>
          )}
        </Pressable>

        {emailOpen ? (
          <View style={styles.emailForm}>
            <TextInput
              style={[styles.input, { textAlign: isRTL ? "right" : "left" }]}
              value={email}
              onChangeText={setEmail}
              placeholder={t("obSignupEmailPlaceholder")}
              placeholderTextColor={wasfaColors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              editable={!isLoading}
            />
            <TextInput
              style={[styles.input, { textAlign: isRTL ? "right" : "left" }]}
              value={password}
              onChangeText={setPassword}
              placeholder={t("obSignupPasswordPlaceholder")}
              placeholderTextColor={wasfaColors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={handleEmailAuth}
              editable={!isLoading}
            />
            <CtaButton
              label={t("obSignupEmailSubmit")}
              onPress={handleEmailAuth}
              disabled={!canSubmitEmail && pending !== "email"}
              loading={pending === "email"}
            />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            style={styles.emailLink}
            onPress={() => setEmailOpen(true)}
            disabled={isLoading}
          >
            <Text style={styles.emailLinkText}>{t("obSignupEmail")}</Text>
          </Pressable>
        )}

        <Text style={styles.terms}>{t("obTerms")}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
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
    gap: 10,
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
  // Pinned to the bottom so the reviewers line up across cards of different length.
  reviewer: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: "800",
  },
  reviewerCopy: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: "700",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  reviewerPlace: {
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
  // The Apple mark sits low in its glyph box; nudged up to centre on the label.
  appleMark: {
    marginTop: -3,
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
  googleLogo: {
    width: 20,
    height: 20,
  },
  emailLink: {
    alignSelf: "center",
    paddingVertical: 4,
  },
  emailLinkText: {
    fontSize: 14,
    fontWeight: "700",
    color: wasfaColors.primaryDark,
  },
  emailForm: {
    gap: 10,
  },
  input: {
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    fontSize: 16,
    color: wasfaColors.ink,
  },
  terms: {
    fontSize: 11,
    lineHeight: 15,
    color: wasfaColors.muted,
    textAlign: "center",
  },
});
