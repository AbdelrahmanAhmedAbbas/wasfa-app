import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LocalizedText as Text } from "@/components/LocalizedText";
import { ScreenTransition } from "@/components/navigation/ScreenTransition";
import { CtaButton } from "@/components/wasfa/CtaButton";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { dietImages, onboardingImages } from "@/lib/theme/onboarding";
import { getTabBarClearance, wasfaColors, wasfaRadius } from "@/lib/theme/wasfa";
import { setOnboardingDone, clearOnboardingStep } from "@/lib/onboarding/storage";
import {
  clearOnboardingAnswers,
  type AllergyOption,
  type DietOption,
  type MeasurementSystem,
  type NutritionDisplay,
} from "@/lib/onboarding/answers";
import { loadRecipePreferences, saveRecipePreferences, type RecipePreferences } from "@/lib/recipes/preferences";

const DIET_OPTIONS: { id: DietOption; labelKey: TranslationKey }[] = [
  { id: "halal", labelKey: "dietHalal" },
  { id: "omnivore", labelKey: "profileDietOmnivore" },
  { id: "vegetarian", labelKey: "dietVegetarian" },
  { id: "vegan", labelKey: "dietVegan" },
  { id: "keto", labelKey: "dietKeto" },
  { id: "pescatarian", labelKey: "profileDietPescatarian" },
];

const ALLERGY_OPTIONS: { id: AllergyOption; labelKey: TranslationKey; emoji: string }[] = [
  { id: "shellfish", labelKey: "profileAllergyShellfish", emoji: "🍤" },
  { id: "seafood", labelKey: "profileAllergySeafood", emoji: "🐟" },
  { id: "dairy", labelKey: "profileAllergyDairy", emoji: "🥛" },
  { id: "peanut", labelKey: "profileAllergyPeanut", emoji: "🥜" },
  { id: "tree_nut", labelKey: "profileAllergyTreeNut", emoji: "🌰" },
  { id: "egg", labelKey: "profileAllergyEgg", emoji: "🥚" },
  { id: "gluten", labelKey: "profileAllergyGluten", emoji: "🍞" },
  { id: "wheat", labelKey: "profileAllergyWheat", emoji: "🌾" },
];

export default function ProfileScreen() {
  const { language, isRTL, setLanguage, t } = useLanguage();
  const { user, signInWithGoogle, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<RecipePreferences>({
    diet: [],
    allergies: [],
    measurementSystem: null,
    nutritionDisplay: null,
  });
  const [preferencesSaving, setPreferencesSaving] = useState(false);

  // Root direction already flips logical-start alignment for Arabic (see RTL_LAYOUT.md).
  const textAlign = "left";
  const writingDirection = isRTL ? "rtl" : "ltr";

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
      t("profileDeleteConfirmTitle"),
      t("profileDeleteConfirmMessage"),
      [
        {
          text: t("profileDeleteCancel"),
          style: "cancel",
        },
        {
          text: t("profileDeleteConfirmAction"),
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

  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName = user ? user.user_metadata?.full_name || t("profileUserInfo") : t("profileGuestMode");

  return (
    <ScreenTransition>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: getTabBarClearance(insets.bottom) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
          <View pointerEvents="none" style={styles.headerCircle} />
          <View style={styles.avatarRing}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarPhoto} />
            ) : (
              <Image source={onboardingImages.mascot} style={styles.avatarMascot} resizeMode="contain" />
            )}
          </View>
          <Text style={styles.userName} numberOfLines={1}>
            {displayName}
          </Text>
          {user ? (
            user.email ? (
              <Text style={styles.userEmail} numberOfLines={1}>
                {user.email}
              </Text>
            ) : null
          ) : (
            <Text style={styles.guestHint}>{t("profileSignIn")}</Text>
          )}
        </View>

        {!user ? (
          <CtaButton
            label={t("authSignInGoogle")}
            onPress={handleSignIn}
            loading={isLoading}
            style={styles.signInButton}
          />
        ) : null}

        {/* App preferences */}
        <SectionLabel label={t("profileSectionPreferences")} busy={preferencesSaving} isRTL={isRTL} />
        <View style={styles.card}>
          <SettingRow emoji="🌐" label={t("language")} isRTL={isRTL}>
            <SegmentedControl
              value={language}
              onChange={(next) => void setLanguage(next)}
              options={[
                { id: "en", label: t("profileLanguageEnglish") },
                { id: "ar", label: t("profileLanguageArabic") },
              ]}
            />
          </SettingRow>
          <View style={styles.hairline} />
          <SettingRow emoji="📏" label={t("profileMeasurements")} isRTL={isRTL}>
            <SegmentedControl
              value={preferences.measurementSystem}
              onChange={setMeasurementSystem}
              options={[
                { id: "metric", label: t("profileMeasurementMetric") },
                { id: "imperial", label: t("profileMeasurementImperial") },
              ]}
            />
          </SettingRow>
          <View style={styles.hairline} />
          <SettingRow emoji="📊" label={t("profileNutrition")} isRTL={isRTL}>
            <SegmentedControl
              // Unset means nutrition is shown (the recipe screen only hides on "hide").
              value={preferences.nutritionDisplay ?? "show"}
              onChange={setNutritionDisplay}
              options={[
                { id: "show", label: t("nutritionShow") },
                { id: "hide", label: t("nutritionHide") },
              ]}
            />
          </SettingRow>
        </View>

        {/* Dietary preferences */}
        <SectionLabel label={t("profileSectionDietary")} busy={preferencesSaving} isRTL={isRTL} />
        <View style={styles.card}>
          <View style={styles.chipBlock}>
            <Text style={[styles.rowLabel, { textAlign, writingDirection }]}>{t("recipePreferencesDiet")}</Text>
            <View style={styles.chipWrap}>
              {DIET_OPTIONS.map((option) => (
                <PreferenceChip
                  key={option.id}
                  label={t(option.labelKey)}
                  active={preferences.diet.includes(option.id)}
                  onPress={() => toggleDiet(option.id)}
                  leading={<Image source={dietImages[option.id]} style={styles.chipImage} />}
                />
              ))}
            </View>
          </View>
          <View style={styles.hairline} />
          <View style={styles.chipBlock}>
            <Text style={[styles.rowLabel, { textAlign, writingDirection }]}>
              {t("recipePreferencesAllergies")}
            </Text>
            <View style={styles.chipWrap}>
              {ALLERGY_OPTIONS.map((option) => (
                <PreferenceChip
                  key={option.id}
                  label={t(option.labelKey)}
                  active={preferences.allergies.includes(option.id)}
                  onPress={() => toggleAllergy(option.id)}
                  leading={<RNText style={styles.chipEmoji}>{option.emoji}</RNText>}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Actions */}
        {user ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
              onPress={handleSignOut}
              disabled={isLoading}
            >
              <Text style={styles.signOutText}>{t("profileSignOut")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
              onPress={handleDeleteAccount}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={wasfaColors.danger} />
              ) : (
                <Text style={styles.deleteButtonText}>{t("profileDeleteAccountAction")}</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </ScreenTransition>
  );
}

function SectionLabel({ label, busy, isRTL }: { label: string; busy: boolean; isRTL: boolean }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text
        style={[
          styles.sectionLabel,
          !isRTL && styles.sectionLabelLatin,
          { textAlign: "left", writingDirection: isRTL ? "rtl" : "ltr" },
        ]}
      >
        {label}
      </Text>
      {busy ? <ActivityIndicator color={wasfaColors.primary} size="small" /> : null}
    </View>
  );
}

function SettingRow({
  emoji,
  label,
  isRTL,
  children,
}: {
  emoji: string;
  label: string;
  isRTL: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <RNText style={styles.rowEmoji}>{emoji}</RNText>
      <Text
        style={[styles.rowLabel, styles.rowLabelFlex, { textAlign: "left", writingDirection: isRTL ? "rtl" : "ltr" }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: { id: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => {
              if (!active) onChange(option.id);
            }}
          >
            <Text
              style={[styles.segmentText, active && styles.segmentTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PreferenceChip({
  label,
  active,
  onPress,
  leading,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  leading: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.preferenceChip, active && styles.preferenceChipActive]}
      onPress={onPress}
    >
      {leading}
      <Text style={styles.preferenceChipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: wasfaColors.background,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 26,
    backgroundColor: wasfaColors.primary,
    borderBottomLeftRadius: wasfaRadius.hero,
    borderBottomRightRadius: wasfaRadius.hero,
    overflow: "hidden",
  },
  headerCircle: {
    position: "absolute",
    top: -70,
    end: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    backgroundColor: wasfaColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 12,
  },
  avatarPhoto: {
    width: "100%",
    height: "100%",
  },
  avatarMascot: {
    width: 78,
    height: 78,
  },
  userName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  userEmail: {
    marginTop: 4,
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    // Email addresses always read left to right.
    writingDirection: "ltr",
  },
  guestHint: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  signInButton: {
    marginTop: 20,
    marginHorizontal: 20,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 20,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 24,
    gap: 12,
  },
  sectionLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    color: wasfaColors.muted,
  },
  // Letter spacing breaks Arabic joining, so only the Latin label is tracked out.
  sectionLabelLatin: {
    textTransform: "uppercase",
    letterSpacing: 0.96,
  },
  card: {
    marginHorizontal: 20,
    borderRadius: wasfaRadius.lg,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    overflow: "hidden",
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: wasfaColors.line,
    marginHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowEmoji: {
    width: 30,
    fontSize: 24,
    lineHeight: 30,
    textAlign: "center",
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: wasfaColors.ink,
  },
  rowLabelFlex: {
    flex: 1,
  },
  segmented: {
    width: 150,
    flexDirection: "row",
    padding: 3,
    borderRadius: wasfaRadius.pill,
    backgroundColor: wasfaColors.soft,
    borderWidth: 1,
    borderColor: wasfaColors.line,
  },
  segment: {
    flex: 1,
    height: 38,
    borderRadius: wasfaRadius.pill,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: wasfaColors.surface,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "700",
    color: wasfaColors.muted,
  },
  segmentTextActive: {
    color: wasfaColors.ink,
  },
  chipBlock: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  preferenceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    borderRadius: wasfaRadius.pill,
    borderWidth: 2,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    paddingStart: 6,
    paddingEnd: 14,
  },
  preferenceChipActive: {
    borderColor: wasfaColors.cta,
    backgroundColor: wasfaColors.ctaSoft,
  },
  preferenceChipText: {
    color: wasfaColors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  chipImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  chipEmoji: {
    width: 28,
    fontSize: 20,
    lineHeight: 26,
    textAlign: "center",
  },
  actions: {
    marginTop: 24,
    marginHorizontal: 20,
    gap: 6,
  },
  signOutButton: {
    height: 54,
    borderRadius: wasfaRadius.pill,
    borderWidth: 2,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "800",
    color: wasfaColors.ink,
  },
  deleteButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: wasfaColors.danger,
  },
  pressed: {
    opacity: 0.7,
  },
});
