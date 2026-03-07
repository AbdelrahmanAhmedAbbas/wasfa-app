import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase/client";
import { getOnboardingDone, setOnboardingDone } from "@/lib/onboarding/storage";

import { AuthContextValue, AuthState } from "./types";

// Enable WebBrowser for OAuth
WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
        hasCompletedOnboarding: onboardingDone || !!session,
      }));
    }
    );

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
        hasCompletedOnboarding: !!session ? true : prev.hasCompletedOnboarding,
      }));
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: "mealplanner",
        path: "auth/callback",
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: Platform.OS !== "web",
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
      await supabase.auth.signOut();
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
