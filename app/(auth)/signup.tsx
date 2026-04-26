import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { launchScreenColors, onboardingImages } from "@/lib/theme/onboarding";

export default function SignupAuthScreen() {
  const { signInWithGoogle, signInWithApple, user, loading } = useAuth();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/(paywall)/offer");
    }
  }, [loading, user]);

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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Image source={onboardingImages.logo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>{t("qSignupTitle")}</Text>
        <Text style={styles.subtitle}>{t("qSignupSubtitle")}</Text>

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
                <FontAwesome name="google" size={18} color={launchScreenColors.primaryDark} />
                <Text style={styles.googleText}>{t("qSignupGoogle")}</Text>
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
              <Text style={styles.appleText}>{t("qSignupApple")}</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: launchScreenColors.bgLight,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  logo: {
    alignSelf: "center",
    width: 220,
    height: 116,
    marginBottom: 24,
  },
  title: {
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "900",
    color: launchScreenColors.text,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: launchScreenColors.textSecondary,
    textAlign: "center",
  },
  buttonStack: {
    marginTop: 34,
    gap: 14,
  },
  button: {
    minHeight: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  googleButton: {
    backgroundColor: "#FFFFFF",
    borderColor: launchScreenColors.divider,
  },
  appleButton: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  googleText: {
    fontSize: 17,
    fontWeight: "800",
    color: launchScreenColors.primaryDark,
  },
  appleText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
