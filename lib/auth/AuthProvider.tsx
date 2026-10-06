import AsyncStorage from "@react-native-async-storage/async-storage";
import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { api } from "@/convex/_generated/api";
import { forgetUser, identifyUser } from "@/lib/analytics/posthog";
import { convex } from "@/lib/convex/client";
import { stopNotifications } from "@/lib/notifications/sync";
import { getOnboardingDone, setOnboardingDone } from "@/lib/onboarding/storage";

import { setCurrentUserId } from "./session";
import { AuthContextValue, AuthUser } from "./types";

// Enable WebBrowser for OAuth
WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
// Must match APP_REDIRECT_URL in convex/auth.ts.
const OAUTH_REDIRECT_URL = "mealplanner://auth/callback";
const LAST_USER_KEY = "@wasfa/last_user";

async function readLastUser(): Promise<AuthUser | null> {
  try {
    const stored = await AsyncStorage.getItem(LAST_USER_KEY);
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthProvider client={convex} storage={AsyncStorage}>
      <AuthStateProvider>{children}</AuthStateProvider>
    </ConvexAuthProvider>
  );
}

function AuthStateProvider({ children }: { children: React.ReactNode }) {
  const { isLoading: sessionLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut: endSession } = useAuthActions();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");

  // The user from the last run, shown while the session is still being confirmed, so
  // the app opens straight into the library and still opens with no connection.
  const [lastUser, setLastUser] = useState<AuthUser | null>(null);
  const [lastUserLoaded, setLastUserLoaded] = useState(false);
  // Whether onboarding is finished, together with the user it was read for, so a user
  // who has just appeared is never shown as "not onboarded" before their answer loads.
  const [onboarding, setOnboarding] = useState<{ userId: string; done: boolean } | null>(null);

  useEffect(() => {
    void readLastUser().then((stored) => {
      setLastUser(stored);
      setLastUserLoaded(true);
    });
  }, []);

  const confirmedUser = useMemo<AuthUser | null>(
    () =>
      viewer
        ? { id: viewer.id, email: viewer.email, name: viewer.name, avatarUrl: viewer.avatar_url }
        : null,
    [viewer]
  );
  const sessionPending = sessionLoading || (isAuthenticated && viewer === undefined);
  const user = sessionPending ? lastUser : confirmedUser;
  const userId = user?.id ?? null;
  setCurrentUserId(userId);

  // Once the server has answered, what it says replaces the remembered user.
  useEffect(() => {
    if (sessionPending || !lastUserLoaded) return;
    setLastUser(confirmedUser);
    if (confirmedUser) {
      void AsyncStorage.setItem(LAST_USER_KEY, JSON.stringify(confirmedUser));
      identifyUser(confirmedUser);
    } else {
      void AsyncStorage.removeItem(LAST_USER_KEY);
    }
  }, [sessionPending, lastUserLoaded, confirmedUser]);

  useEffect(() => {
    let active = true;
    if (!userId) return;
    void getOnboardingDone().then((done) => {
      if (active) setOnboarding({ userId, done });
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const onboardingLoaded = !userId || onboarding?.userId === userId;
  const hasCompletedOnboarding = !!userId && onboarding?.userId === userId && onboarding.done;

  const signInWithGoogle = async () => {
    try {
      if (Platform.OS === "web") {
        await signIn("google");
        return;
      }

      const { redirect } = await signIn("google", { redirectTo: OAUTH_REDIRECT_URL });
      if (!redirect) throw new Error("Google sign-in did not return a sign-in page.");

      const result = await WebBrowser.openAuthSessionAsync(redirect.toString(), OAUTH_REDIRECT_URL);
      if (result.type !== "success") return;

      const query = result.url.split("?")[1]?.split("#")[0] ?? "";
      const code = new URLSearchParams(query).get("code");
      if (!code) throw new Error("Google sign-in did not return a code.");
      await signIn("google", { code });
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // While still signed in: the server only takes a phone off its owner's account.
      await stopNotifications();
      await endSession();
      forgetUser();
      setLastUser(null);
      await AsyncStorage.removeItem(LAST_USER_KEY);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  const signInWithApple = async () => {
    try {
      // Apple signs the hash into its token; the server checks it against this nonce.
      const nonce = Crypto.randomUUID();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce),
      });
      if (!credential.identityToken) throw new Error("Apple sign-in did not return a token.");

      const name = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(" ");
      await signIn("apple", {
        identityToken: credential.identityToken,
        nonce,
        ...(name ? { name } : null),
      });
    } catch (error) {
      // Closing Apple's sheet is not a failure.
      if ((error as { code?: string }).code === "ERR_REQUEST_CANCELED") return;
      console.error("Error signing in with Apple:", error);
      throw error;
    }
  };

  // Email accounts are created for App Review and beta testers (see
  // createPasswordAccount in convex/users.ts), so the app only signs in and never signs up.
  const signInWithEmail = async (email: string, password: string) => {
    await signIn("password", { email: email.trim(), password, flow: "signIn" });
  };

  const completeOnboarding = async () => {
    await setOnboardingDone(true);
    if (userId) setOnboarding({ userId, done: true });
  };

  const value: AuthContextValue = {
    user,
    loading: !lastUserLoaded || !onboardingLoaded || (sessionPending && !lastUser),
    hasCompletedOnboarding,
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
