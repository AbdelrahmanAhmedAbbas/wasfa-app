import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { Alert, Platform } from "react-native";

import { track } from "@/lib/analytics/posthog";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isConvexConfigured } from "@/lib/convex/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export type SignInMethod = "apple" | "google" | "email";

/** The three sign-in actions with their error alerts, shared by the auth screens. */
export function useSignInActions() {
  const { signInWithGoogle, signInWithApple, signInWithEmail } = useAuth();
  const { t } = useLanguage();
  // The method in flight, so each button can show its own spinner.
  const [pending, setPending] = useState<SignInMethod | null>(null);
  // Apple sign-in exists only on iPhone, and only in builds that include it: an older
  // build that receives this code over the air does not, so it hides the button.
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === "ios");

  useEffect(() => {
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const run = async (method: SignInMethod, errorMessage: string, action: () => Promise<void>) => {
    try {
      setPending(method);
      track("sign_in_started", { method });
      await action();
    } catch (error) {
      console.error(`Failed to sign in with ${method}:`, error);
      track("sign_in_failed", { method });
      Alert.alert(t("authErrorTitle"), errorMessage);
    } finally {
      setPending(null);
    }
  };

  const withApple = () => run("apple", t("authAppleErrorMessage"), signInWithApple);

  const withGoogle = async () => {
    if (!isConvexConfigured) {
      Alert.alert(t("authConfigTitle"), t("authConfigMessage"));
      return;
    }

    await run("google", t("authErrorMessage"), signInWithGoogle);
  };

  const withEmail = (email: string, password: string) =>
    run("email", t("obSignupEmailError"), () => signInWithEmail(email, password));

  return { pending, appleAvailable, withApple, withGoogle, withEmail };
}
