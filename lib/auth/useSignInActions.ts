import { useState } from "react";
import { Alert } from "react-native";

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

  const run = async (method: SignInMethod, errorMessage: string, action: () => Promise<void>) => {
    try {
      setPending(method);
      await action();
    } catch (error) {
      console.error(`Failed to sign in with ${method}:`, error);
      Alert.alert(t("authErrorTitle"), errorMessage);
    } finally {
      setPending(null);
    }
  };

  const withApple = () => run("apple", t("authErrorMessage"), signInWithApple);

  const withGoogle = async () => {
    if (!isConvexConfigured) {
      Alert.alert(t("authConfigTitle"), t("authConfigMessage"));
      return;
    }

    await run("google", t("authErrorMessage"), signInWithGoogle);
  };

  const withEmail = (email: string, password: string) =>
    run("email", t("obSignupEmailError"), () => signInWithEmail(email, password));

  return { pending, withApple, withGoogle, withEmail };
}
