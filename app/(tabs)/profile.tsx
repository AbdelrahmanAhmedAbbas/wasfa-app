import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";
import { ScreenTransition } from "@/components/navigation/ScreenTransition";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingImages } from "@/lib/theme/onboarding";
import { setOnboardingDone, clearOnboardingStep } from "@/lib/onboarding/storage";
import { clearOnboardingAnswers } from "@/lib/onboarding/answers";

export default function ProfileScreen() {
  const { language, isRTL, setLanguage, t } = useLanguage();
  const { user, signInWithGoogle, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const textAlign = isRTL ? "right" : "left";

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      await signInWithGoogle();
    } catch (error) {
      console.error("Failed to sign in:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await signOut();
      router.replace("/(auth)/welcome");
    } catch (error) {
      console.error("Failed to sign out:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t("profileDeleteConfirmTitle" as any),
      t("profileDeleteConfirmMessage" as any),
      [
        {
          text: t("profileDeleteCancel" as any),
          style: "cancel",
        },
        {
          text: t("profileDeleteConfirmAction" as any),
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              const { error } = await supabase.rpc("delete_user_account");
              if (error) {
                console.error("Failed to delete account from Supabase:", error);
                Alert.alert("Error", error.message);
                return;
              }
              await setOnboardingDone(false);
              await clearOnboardingStep();
              await clearOnboardingAnswers();
              await signOut();
              router.replace("/(auth)/welcome");
            } catch (error: any) {
              console.error("Failed to delete account:", error);
              Alert.alert("Error", error.message);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenTransition>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Profile Header */}
        <View style={styles.header}>
          {user ? (
            <>
              {/* User Avatar */}
              {user.user_metadata?.avatar_url ? (
                <Image source={{ uri: user.user_metadata.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>
                    {user.user_metadata?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
                  </Text>
                </View>
              )}

              {/* User Info */}
              <Text style={[styles.userName, { textAlign }]}>{user.user_metadata?.full_name || "User"}</Text>
              <Text style={[styles.userEmail, { textAlign }]}>{user.email}</Text>
              <Text style={[styles.userLabel, { textAlign }]}>{t("profileUserInfo")}</Text>
            </>
          ) : (
            <>
              {/* Guest Mode */}
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Image source={onboardingImages.logo} style={styles.guestLogo} resizeMode="cover" />
              </View>
              <Text style={[styles.userName, { textAlign }]}>{t("profileGuestMode")}</Text>
              <Text style={[styles.userEmail, { textAlign }]}>{t("profileSignIn")}</Text>
            </>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {user ? (
            <>
              <Pressable
                style={[styles.button, styles.signOutButton]}
                onPress={handleSignOut}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>{t("profileSignOut")}</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.deleteButton]}
                onPress={handleDeleteAccount}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#d64545" />
                ) : (
                  <Text style={styles.deleteButtonText}>{t("profileDeleteAccount" as any)}</Text>
                )}
              </Pressable>
            </>
          ) : (
            <Pressable
              style={[styles.button, styles.signInButton]}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.buttonText}>{t("authSignInGoogle")}</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        {/* Language Settings */}
        <View style={styles.languageSection}>
          <Text style={[styles.sectionTitle, { textAlign }]}>{t("language")}</Text>
          <View style={styles.pillSelector}>
            <Pressable
              style={[styles.pill, language === "en" && styles.pillActive]}
              onPress={() => setLanguage("en")}
            >
              <Text style={[styles.pillText, language === "en" && styles.pillTextActive]}>
                {t("english")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.pill, language === "ar" && styles.pillActive]}
              onPress={() => setLanguage("ar")}
            >
              <Text style={[styles.pillText, language === "ar" && styles.pillTextActive]}>
                {t("arabic")}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Placeholder for future settings */}
        <View style={styles.placeholder}>
          <Text style={[styles.placeholderText, { textAlign }]}>{t("screenComingSoonTitle")}</Text>
          <Text style={[styles.placeholderSubtext, { textAlign }]}>{t("screenComingSoonBody")}</Text>
        </View>
      </ScrollView>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8DCCB",
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#e2e2e2",
  },
  avatarText: {
    fontSize: 40,
    fontWeight: "700",
    color: "#25292f",
  },
  guestLogo: {
    width: 66,
    height: 66,
    borderRadius: 18,
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#252821",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: "#4f5347",
    marginBottom: 4,
  },
  userLabel: {
    fontSize: 14,
    color: "#8b8b8b",
  },
  actions: {
    marginBottom: 32,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    minHeight: 56,
    gap: 12,
  },
  signInButton: {
    backgroundColor: "#1e9f92",
  },
  signOutButton: {
    backgroundColor: "#d64545",
  },
  deleteButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#d64545",
  },
  deleteButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#d64545",
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: "700",
    backgroundColor: "#ffffff",
    color: "#1e9f92",
    width: 32,
    height: 32,
    borderRadius: 16,
    textAlign: "center",
    lineHeight: 32,
  },
  placeholder: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e2e2",
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#252821",
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 16,
    color: "#4f5347",
  },
  languageSection: {
    marginBottom: 32,
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e2e2",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#252821",
    marginBottom: 16,
  },
  pillSelector: {
    flexDirection: "row",
    gap: 12,
  },
  pill: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  pillActive: {
    backgroundColor: "#1e9f92",
    borderColor: "#1e9f92",
  },
  pillText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4f5347",
  },
  pillTextActive: {
    color: "#ffffff",
  },
});
