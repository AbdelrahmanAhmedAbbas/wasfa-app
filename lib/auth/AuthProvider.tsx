import * as WebBrowser from "expo-web-browser";
import { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase/client";
import { getOnboardingDone, setOnboardingDone } from "@/lib/onboarding/storage";

import { AuthContextValue, AuthState } from "./types";

// Enable WebBrowser for OAuth
WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_CALLBACK_PATH = "auth/callback";
const APP_SCHEME = "mealplanner";

function getOAuthRedirectUrl() {
  if (Platform.OS === "web") {
    const origin = (globalThis as typeof globalThis & { location?: { origin?: string } }).location?.origin;
    return origin ? `${origin}/${AUTH_CALLBACK_PATH}` : `${APP_SCHEME}://${AUTH_CALLBACK_PATH}`;
  }

  return `${APP_SCHEME}://${AUTH_CALLBACK_PATH}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    hasCompletedOnboarding: false,
  });

  useEffect(() => {
    Promise.all([supabase.auth.getSession(), getOnboardingDone()]).then(
      ([{ data: { session } }, onboardingDone]) => {
        setState((prev) => ({
          ...prev,
          session,
          user: session?.user ?? null,
          loading: false,
          hasCompletedOnboarding: onboardingDone,
        }));
      }
    );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const onboardingDone = session ? await getOnboardingDone() : false;
      setState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
        hasCompletedOnboarding: onboardingDone,
      }));
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const redirectUrl = getOAuthRedirectUrl();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: Platform.OS !== "web",
          // Without this Google silently reuses the account already signed in
          // to the browser, so nobody could switch to a different email.
          queryParams: { prompt: "select_account" },
        },
      });

      if (error) throw error;

      // For native platforms, open the OAuth URL
      if (Platform.OS !== "web" && data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        console.log("OAuth result type:", result.type);

        if (result.type === "success") {
          const url = result.url;
          console.log("OAuth callback URL:", url);
          const params = new URLSearchParams(url.split("#")[1] || url.split("?")[1]);
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          console.log("Tokens found:", !!accessToken, !!refreshToken);

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            console.log("Session set successfully");
          }
        }
      }
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // The session stays on the device when the request fails (e.g. offline),
      // so a failure must not be shown as a successful sign-out.
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setState((prev) => ({
        ...prev,
        user: null,
        session: null,
        hasCompletedOnboarding: prev.hasCompletedOnboarding,
      }));
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  const signInWithApple = async () => {
    console.log("Apple Sign-In not yet configured");
  };

  // Email accounts are created from the Supabase dashboard (App Review and
  // beta testers), so the app only signs in and never signs up.
  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  };

  const completeOnboarding = async () => {
    await setOnboardingDone(true);
    setState((prev) => ({
      ...prev,
      hasCompletedOnboarding: true,
    }));
  };

  const value: AuthContextValue = {
    ...state,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signOut,
    completeOnboarding,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
