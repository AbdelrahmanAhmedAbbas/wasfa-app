import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";
import { ScreenTransition } from "@/components/navigation/ScreenTransition";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingImages } from "@/lib/theme/onboarding";
import { setOnboardingDone, clearOnboardingStep } from "@/lib/onboarding/storage";
import {
  clearOnboardingAnswers,
  type AllergyOption,
  type DietOption,
  type MeasurementSystem,
  type NutritionDisplay,
} from "@/lib/onboarding/answers";
import { loadRecipePreferences, saveRecipePreferences, type RecipePreferences } from "@/lib/recipes/preferences";

const DIET_OPTIONS: { id: DietOption; labelKey: string }[] = [
  { id: "halal", labelKey: "dietHalal" },
  { id: "omnivore", labelKey: "dietOmnivore" },
  { id: "vegetarian", labelKey: "dietVegetarian" },
  { id: "vegan", labelKey: "dietVegan" },
  { id: "keto", labelKey: "dietKeto" },
  { id: "pescatarian", labelKey: "dietPescatarian" },
];

const ALLERGY_OPTIONS: { id: AllergyOption; labelKey: string }[] = [
  { id: "shellfish", labelKey: "allergyShellfish" },
  { id: "seafood", labelKey: "allergySeafood" },
  { id: "dairy", labelKey: "allergyDairy" },
  { id: "peanut", labelKey: "allergyPeanut" },
  { id: "tree_nut", labelKey: "allergyTreeNut" },
  { id: "egg", labelKey: "allergyEgg" },
  { id: "gluten", labelKey: "allergyGluten" },
  { id: "wheat", labelKey: "allergyWheat" },
];

export default function ProfileScreen() {
  const { language, isRTL, setLanguage, t } = useLanguage();
  const { user, signInWithGoogle, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<RecipePreferences>({
    diet: [],
    allergies: [],
    measurementSystem: null,
    nutritionDisplay: null,
  });
  const [preferencesSaving, setPreferencesSaving] = useState(false);

  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    let isMounted = true;
    void loadRecipePreferences(user?.id).then((value) => {
      if (isMounted) setPreferences(value);
    });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const updatePreferences = async (partial: Partial<RecipePreferences>) => {
    const previous = preferences;
    setPreferences({ ...preferences, ...partial });
    setPreferencesSaving(true);
    try {
      const saved = await saveRecipePreferences(partial, user?.id);
      setPreferences(saved);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to save preferences.");
      setPreferences(previous);
    } finally {
      setPreferencesSaving(false);
    }
  };

  const toggleDiet = (id: DietOption) => {
    const next = preferences.diet.includes(id)
      ? preferences.diet.filter((item) => item !== id)
      : [...preferences.diet, id];
    void updatePreferences({ diet: next });
  };

  const toggleAllergy = (id: AllergyOption) => {
    const next = preferences.allergies.includes(id)
      ? preferences.allergies.filter((item) => item !== id)
      : [...preferences.allergies, id];
    void updatePreferences({ allergies: next });
  };

  const setMeasurementSystem = (measurementSystem: MeasurementSystem) => {
    void updatePreferences({ measurementSystem });
  };

  const setNutritionDisplay = (nutritionDisplay: NutritionDisplay) => {
    void updatePreferences({ nutritionDisplay });
  };

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

        <View style={styles.preferencesSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { textAlign }]}>{t("recipePreferences" as any)}</Text>
            {preferencesSaving ? <ActivityIndicator color="#1e9f92" size="small" /> : null}
          </View>

          <Text style={[styles.preferenceLabel, { textAlign }]}>{t("recipePreferencesDiet" as any)}</Text>
          <View style={styles.chipWrap}>
            {DIET_OPTIONS.map((option) => (
              <PreferenceChip
                key={option.id}
                label={t(option.labelKey as any)}
                active={preferences.diet.includes(option.id)}
                onPress={() => toggleDiet(option.id)}
              />
            ))}
          </View>

          <Text style={[styles.preferenceLabel, { textAlign }]}>{t("recipePreferencesAllergies" as any)}</Text>
          <View style={styles.chipWrap}>
            {ALLERGY_OPTIONS.map((option) => (
              <PreferenceChip
                key={option.id}
                label={t(option.labelKey as any)}
                active={preferences.allergies.includes(option.id)}
                onPress={() => toggleAllergy(option.id)}
              />
            ))}
          </View>

          <Text style={[styles.preferenceLabel, { textAlign }]}>{t("recipePreferencesMeasurements" as any)}</Text>
          <View style={styles.pillSelector}>
            <Pressable
              style={[styles.pill, preferences.measurementSystem === "imperial" && styles.pillActive]}
              onPress={() => setMeasurementSystem("imperial")}
            >
              <Text style={[styles.pillText, preferences.measurementSystem === "imperial" && styles.pillTextActive]}>
                {t("measurementImperial")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.pill, preferences.measurementSystem === "metric" && styles.pillActive]}
              onPress={() => setMeasurementSystem("metric")}
            >
              <Text style={[styles.pillText, preferences.measurementSystem === "metric" && styles.pillTextActive]}>
                {t("measurementMetric")}
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.preferenceLabel, { textAlign }]}>{t("recipePreferencesNutrition" as any)}</Text>
          <View style={styles.pillSelector}>
            <Pressable
              style={[styles.pill, preferences.nutritionDisplay === "show" && styles.pillActive]}
              onPress={() => setNutritionDisplay("show")}
            >
              <Text style={[styles.pillText, preferences.nutritionDisplay === "show" && styles.pillTextActive]}>
                {t("nutritionShow")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.pill, preferences.nutritionDisplay === "hide" && styles.pillActive]}
              onPress={() => setNutritionDisplay("hide")}
            >
              <Text style={[styles.pillText, preferences.nutritionDisplay === "hide" && styles.pillTextActive]}>
                {t("nutritionHide")}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenTransition>
  );
}

function PreferenceChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.preferenceChip, active && styles.preferenceChipActive]} onPress={onPress}>
      <Text style={[styles.preferenceChipText, active && styles.preferenceChipTextActive]}>{label}</Text>
    </Pressable>
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
  preferencesSection: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e2e2",
    gap: 14,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  preferenceLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4f5347",
    textTransform: "uppercase",
    marginTop: 4,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  preferenceChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dfe5d7",
    backgroundColor: "#f7f8f1",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  preferenceChipActive: {
    borderColor: "#1e9f92",
    backgroundColor: "#E0F7EF",
  },
  preferenceChipText: {
    color: "#4f5347",
    fontSize: 14,
    fontWeight: "600",
  },
  preferenceChipTextActive: {
    color: "#087563",
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
