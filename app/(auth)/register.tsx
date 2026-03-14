import { LocalizedText as Text } from "@/components/LocalizedText";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";

import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { brandFontFamily } from "@/lib/theme/fonts";
import { launchScreenColors, onboardingImages } from "@/lib/theme/onboarding";

export default function RegisterScreen() {
  const { signInWithGoogle, signInWithApple, user, hasCompletedOnboarding, loading } = useAuth();
  const { language, t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      if (hasCompletedOnboarding) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(onboarding)/welcome");
      }
    }
  }, [loading, user, hasCompletedOnboarding]);

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

  const languageFontStyle =
    language === "ar"
      ? { fontFamily: brandFontFamily.arabic, fontWeight: "600" as const }
      : { fontFamily: brandFontFamily.english };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={[styles.title, languageFontStyle]}>{t("registerTitle")}</Text>

        <View style={styles.buttonStack}>
          <Pressable
            style={[styles.button, styles.googleButton]}
            onPress={handleGoogleAuth}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={launchScreenColors.primaryDark} />
            ) : (
              <View style={styles.buttonContent}>
                <View style={styles.googleBadge}>
                  <FontAwesome name="google" size={18} color={launchScreenColors.primaryDark} />
                </View>
                <Text style={[styles.buttonText, styles.googleButtonText, languageFontStyle]}>
                  {t("registerGoogleButton")}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={[styles.button, styles.appleButton]}
            onPress={handleAppleAuth}
            disabled={isLoading}
          >
            <View style={styles.buttonContent}>
              <FontAwesome name="apple" size={20} color="#FFFFFF" />
              <Text style={[styles.buttonText, styles.appleButtonText, languageFontStyle]}>
                {t("registerAppleButton")}
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, languageFontStyle]}>{t("registerAlreadyAccount")}</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.signInLink, languageFontStyle]}>{t("registerSignIn")}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: launchScreenColors.bgLight,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: launchScreenColors.primaryDark,
    marginBottom: 48,
    textAlign: "center",
  },
  buttonStack: {
    width: "100%",
    gap: 16,
  },
  button: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  googleButton: {
    backgroundColor: launchScreenColors.surface,
    borderColor: launchScreenColors.divider,
  },
  appleButton: {
    backgroundColor: "#000000",
    borderColor: "#000000",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  googleBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: launchScreenColors.accentWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  googleButtonText: {
    color: launchScreenColors.primaryDark,
  },
  appleButtonText: {
    color: "#FFFFFF",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
    gap: 6,
  },
  footerText: {
    fontSize: 15,
    color: launchScreenColors.textSecondary,
  },
  signInLink: {
    fontSize: 15,
    color: launchScreenColors.primary,
    fontWeight: "600",
  },
});
