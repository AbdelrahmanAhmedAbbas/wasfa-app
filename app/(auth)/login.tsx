import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ExpoFont from "expo-font";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoginHero } from "@/components/auth/LoginHero";
import { LocalizedText as Text } from "@/components/LocalizedText";
import { headingStyle } from "@/components/onboarding/text-styles";
import { CtaButton } from "@/components/wasfa/CtaButton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSignInActions } from "@/lib/auth/useSignInActions";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { t as translate, type AppLanguage } from "@/lib/i18n/translations";
import {
  getSignedInStart,
  getSignedUpStart,
  restartOnboarding,
} from "@/lib/onboarding/sign-in-start";
import { brandFontFamily } from "@/lib/theme/fonts";
import { onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors, wasfaShadow } from "@/lib/theme/wasfa";

type AuthButtonProps = {
  label: string;
  icon: ReactNode;
  tone: "dark" | "light";
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

function AuthButton({ label, icon, tone, loading, disabled, onPress }: AuthButtonProps) {
  const dark = tone === "dark";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        dark ? styles.buttonDark : styles.buttonLight,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={dark ? "#FFFFFF" : wasfaColors.primaryDark} />
      ) : (
        <>
          {icon}
          <Text style={[styles.buttonText, dark && styles.buttonTextDark]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export default function LoginScreen() {
  const { user, loading, completeOnboarding } = useAuth();
  const { language, isRTL, setLanguage, t } = useLanguage();
  // Opened from the sign-up screen, at the end of an onboarding run on this
  // device: signing in here counts as signing up there.
  const { from } = useLocalSearchParams<{ from?: string }>();
  const afterOnboarding = from === "signup";
  const insets = useSafeAreaInsets();
  const { pending, appleAvailable, withApple, withGoogle, withEmail } = useSignInActions();
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordShown, setPasswordShown] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);
  const passwordInput = useRef<TextInput>(null);
  const scroller = useRef<ScrollView>(null);

  const signedInId = !loading && user ? user.id : null;

  // A new account starts the onboarding; an existing one goes to the opening
  // screen, which knows where it belongs. If the account cannot be checked
  // (no connection), the opening screen decides.
  useEffect(() => {
    if (!signedInId) return;
    let active = true;

    const check = afterOnboarding
      ? getSignedUpStart(signedInId).then(async (signedUp) => {
          if (signedUp.returning) await completeOnboarding();
          return signedUp.start;
        })
      : getSignedInStart(signedInId);

    void check
      .catch((error): "/" => {
        console.error("Failed to check the account after sign-in:", error);
        return "/";
      })
      .then((start) => {
        if (active) router.replace(start);
      });

    return () => {
      active = false;
    };
  }, [signedInId]);

  // On short screens the keyboard leaves less room than the form needs; keep
  // the fields and the sign-in button in view rather than the artwork.
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => {
      scroller.current?.scrollToEnd({ animated: true });
    });

    return () => shown.remove();
  }, []);

  const busy = pending !== null || signedInId !== null;
  const canSubmitEmail = email.trim().length > 0 && password.length > 0 && !busy;

  const submitEmail = () => {
    if (canSubmitEmail) void withEmail(email, password);
  };

  // Back to the sign-up screen this was opened from. Otherwise a fresh run:
  // whatever an earlier one left on this device belongs to someone else.
  const createAccount = async () => {
    if (afterOnboarding) {
      router.back();
      return;
    }
    await restartOnboarding();
    router.replace("/(questionnaire)/language");
  };

  // The switch is labelled in the language it switches to, in that language's font.
  const otherLanguage: AppLanguage = language === "ar" ? "en" : "ar";
  const otherFont = otherLanguage === "ar" ? brandFontFamily.arabic : brandFontFamily.english;
  const inputAlign = { textAlign: isRTL ? "right" : "left" } as const;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate(otherLanguage, "obLangName")}
        hitSlop={8}
        style={({ pressed }) => [
          styles.languagePill,
          { top: insets.top + 10 },
          pressed && styles.buttonPressed,
        ]}
        onPress={() => void setLanguage(otherLanguage)}
      >
        <Feather name="globe" size={15} color={wasfaColors.primaryDark} />
        <RNText
          style={[
            styles.languageText,
            ExpoFont.isLoaded(otherFont) ? { fontFamily: otherFont } : null,
          ]}
        >
          {translate(otherLanguage, "obLangName")}
        </RNText>
      </Pressable>

      <ScrollView
        ref={scroller}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 56, paddingBottom: Math.max(insets.bottom + 12, 28) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <LoginHero />

        <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.copy}>
          <Text style={[styles.title, headingStyle(32, isRTL)]}>{t("authSheetTitle")}</Text>
          <Text style={styles.subtitle}>{t("loginBody")}</Text>
        </Animated.View>

        {signedInId ? (
          <View key="checking" style={[styles.actions, styles.checking]}>
            <ActivityIndicator color={wasfaColors.cta} />
          </View>
        ) : emailOpen ? (
          <Animated.View key="email" entering={FadeIn.duration(220)} style={styles.actions}>
            <View style={[styles.field, focused === "email" && styles.fieldFocused]}>
              <Feather
                name="mail"
                size={18}
                color={focused === "email" ? wasfaColors.cta : wasfaColors.muted}
              />
              <TextInput
                style={[styles.input, inputAlign]}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                placeholder={t("obSignupEmailPlaceholder")}
                placeholderTextColor={wasfaColors.disabledText}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordInput.current?.focus()}
                submitBehavior="submit"
                editable={!busy}
              />
            </View>

            <View style={[styles.field, focused === "password" && styles.fieldFocused]}>
              <Feather
                name="lock"
                size={18}
                color={focused === "password" ? wasfaColors.cta : wasfaColors.muted}
              />
              <TextInput
                ref={passwordInput}
                style={[styles.input, inputAlign]}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                placeholder={t("obSignupPasswordPlaceholder")}
                placeholderTextColor={wasfaColors.disabledText}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                secureTextEntry={!passwordShown}
                returnKeyType="go"
                onSubmitEditing={submitEmail}
                editable={!busy}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(passwordShown ? "loginHidePassword" : "loginShowPassword")}
                hitSlop={10}
                onPress={() => setPasswordShown(!passwordShown)}
              >
                <Feather
                  name={passwordShown ? "eye-off" : "eye"}
                  size={18}
                  color={wasfaColors.muted}
                />
              </Pressable>
            </View>

            <CtaButton
              label={t("obSignupEmailSubmit")}
              onPress={submitEmail}
              disabled={!canSubmitEmail && pending !== "email"}
              loading={pending === "email"}
              trailing={
                <Feather
                  name={isRTL ? "arrow-left" : "arrow-right"}
                  size={18}
                  color={canSubmitEmail ? "#FFFFFF" : wasfaColors.disabledText}
                />
              }
            />
          </Animated.View>
        ) : (
          <View key="providers" style={styles.actions}>
            {appleAvailable ? (
              <Animated.View entering={FadeInDown.delay(200).duration(420)}>
                <AuthButton
                  tone="dark"
                  label={t("obSignupApple")}
                  icon={<Ionicons name="logo-apple" size={21} color="#FFFFFF" style={styles.appleMark} />}
                  loading={pending === "apple"}
                  disabled={busy}
                  onPress={() => void withApple()}
                />
              </Animated.View>
            ) : null}
            <Animated.View entering={FadeInDown.delay(270).duration(420)}>
              <AuthButton
                tone="light"
                label={t("qSignupGoogle")}
                icon={<Image source={onboardingImages.googleLogo} style={styles.googleMark} />}
                loading={pending === "google"}
                disabled={busy}
                onPress={() => void withGoogle()}
              />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(340).duration(420)}>
              <AuthButton
                tone="light"
                label={t("loginEmail")}
                icon={<Feather name="mail" size={19} color={wasfaColors.cta} />}
                disabled={busy}
                onPress={() => setEmailOpen(true)}
              />
            </Animated.View>
          </View>
        )}

        <Animated.View entering={FadeIn.delay(460).duration(420)} style={styles.footer}>
          {emailOpen ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              style={styles.footerRow}
              disabled={busy}
              onPress={() => setEmailOpen(false)}
            >
              <Feather
                name={isRTL ? "chevron-right" : "chevron-left"}
                size={16}
                color={wasfaColors.primaryDark}
              />
              <Text style={styles.footerLink}>{t("loginOtherOptions")}</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              style={styles.footerRow}
              disabled={busy}
              onPress={() => void createAccount()}
            >
              <Text style={styles.footerText}>{t("loginNew")}</Text>
              <Text style={[styles.footerLink, styles.footerLinkCta]}>{t("loginCreate")}</Text>
            </Pressable>
          )}
          <Text style={styles.terms}>{t("obTerms")}</Text>
        </Animated.View>
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
    paddingHorizontal: 22,
  },
  languagePill: {
    position: "absolute",
    end: 18,
    zIndex: 2,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: wasfaColors.surface,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    ...wasfaShadow.card,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  languageText: {
    fontSize: 13,
    fontWeight: "700",
    color: wasfaColors.ink,
  },
  copy: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 26,
  },
  title: {
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: wasfaColors.muted,
    textAlign: "center",
  },
  // Both states are three 56pt rows, so switching to the email form moves nothing.
  actions: {
    gap: 12,
  },
  // Shown in the same space while a signed-in account is looked up.
  checking: {
    height: 192,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    height: 56,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  buttonDark: {
    backgroundColor: "#111111",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  buttonLight: {
    borderWidth: 1.5,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: wasfaColors.ink,
  },
  buttonTextDark: {
    color: "#FFFFFF",
  },
  // The Apple mark sits low in its glyph box; nudged up to centre on the label.
  appleMark: {
    marginTop: -3,
  },
  googleMark: {
    width: 20,
    height: 20,
  },
  field: {
    height: 56,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fieldFocused: {
    borderColor: wasfaColors.cta,
    backgroundColor: "#FFFDF9",
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    color: wasfaColors.ink,
  },
  footer: {
    alignItems: "center",
    gap: 10,
    marginTop: 18,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 24,
  },
  footerText: {
    fontSize: 14,
    color: wasfaColors.muted,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "800",
    color: wasfaColors.primaryDark,
  },
  footerLinkCta: {
    color: wasfaColors.cta,
  },
  terms: {
    fontSize: 11,
    lineHeight: 15,
    color: wasfaColors.muted,
    textAlign: "center",
    opacity: 0.8,
  },
});
