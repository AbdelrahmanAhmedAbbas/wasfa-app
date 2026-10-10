import Feather from "@expo/vector-icons/Feather";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { track } from "@/lib/analytics/posthog";
import { LocalizedText as Text } from "@/components/LocalizedText";
import { ScreenTransition } from "@/components/navigation/ScreenTransition";
import { Glyph } from "@/components/wasfa/Glyph";

import { api } from "@/convex/_generated/api";
import { convex, getServerError } from "@/lib/convex/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { reportError } from "@/lib/monitoring/sentry";
import {
  Notifications,
  getNotificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications/native";
import { getDailyReminderEnabled, setDailyReminderEnabled } from "@/lib/notifications/reminders";
import { syncNotifications } from "@/lib/notifications/sync";
import type { GlyphName } from "@/lib/theme/glyphs";
import { dietImages, onboardingImages } from "@/lib/theme/onboarding";
import { getTabBarClearance, wasfaColors, wasfaRadius } from "@/lib/theme/wasfa";
import { clearOnboardingStep } from "@/lib/onboarding/storage";
import {
  clearCachedProfile,
  clearOnboardingAnswers,
  type AllergyOption,
  type DietOption,
  type GoalOption,
  type HouseholdSize,
  type MeasurementSystem,
  type NutritionDisplay,
  type PainPoint,
} from "@/lib/onboarding/answers";
import {
  ALLERGY_OPTIONS,
  DIET_OPTIONS,
  DISLIKE_OPTIONS,
  GOAL_OPTIONS,
  HOUSEHOLD_OPTIONS,
  MAX_DIETS,
  PAIN_OPTIONS,
} from "@/lib/onboarding/flow";
import { clearMealPlan } from "@/lib/planner/storage";
import {
  EMPTY_RECIPE_PREFERENCES,
  loadRecipePreferences,
  saveRecipePreferences,
  type RecipePreferences,
} from "@/lib/recipes/preferences";

const MAX_CUSTOM_DISLIKE_LENGTH = 40;

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
}

export default function ProfileScreen() {
  const { language, isRTL, setLanguage, t } = useLanguage();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<RecipePreferences>(EMPTY_RECIPE_PREFERENCES);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [dislikeDraft, setDislikeDraft] = useState("");
  // On only when the user wants the reminder and the phone allows the app to show it.
  const [dailyReminder, setDailyReminder] = useState(false);
  // Quick taps each build on the latest choice, and saves run one at a time.
  const latestPreferences = useRef(preferences);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  // Root direction already flips logical-start alignment for Arabic (see RTL_LAYOUT.md).
  const textAlign = "left";
  const writingDirection = isRTL ? "rtl" : "ltr";

  const applyPreferences = (next: RecipePreferences) => {
    latestPreferences.current = next;
    setPreferences(next);
  };

  useEffect(() => {
    let isMounted = true;
    void loadRecipePreferences(user?.id).then((value) => {
      if (isMounted) applyPreferences(value);
    });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;
    void Promise.all([getDailyReminderEnabled(), getNotificationPermission()]).then(([enabled, permission]) => {
      if (isMounted) setDailyReminder(enabled && permission === "granted");
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleDailyReminder = async (enabled: boolean) => {
    if (enabled) {
      let permission = await getNotificationPermission();
      if (permission === "undetermined") permission = await requestNotificationPermission();
      if (permission !== "granted") {
        Alert.alert(t("notificationsOffTitle"), t("notificationsOffMessage"), [
          { text: t("cancel"), style: "cancel" },
          { text: t("importNotifyOpenSettings"), onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
    }
    setDailyReminder(enabled);
    track("daily_reminder_toggled", { enabled });
    await setDailyReminderEnabled(enabled);
    await syncNotifications(language);
  };

  const updatePreferences = (partial: Partial<RecipePreferences>) => {
    const userId = user?.id;
    applyPreferences({ ...latestPreferences.current, ...partial });
    track("preference_changed", { field: Object.keys(partial).join(",") });
    setPendingSaves((count) => count + 1);

    saveQueue.current = saveQueue.current.then(async () => {
      try {
        await saveRecipePreferences(partial, userId);
      } catch (error) {
        reportError(error, { feature: "preferences_save" });
        Alert.alert(t("profileSaveFailedTitle"), t("profileSaveFailedMessage"));
        // Show what is actually saved rather than the change that failed.
        applyPreferences(await loadRecipePreferences(userId).catch(() => latestPreferences.current));
      } finally {
        setPendingSaves((count) => count - 1);
      }
    });
  };

  const preferencesSaving = pendingSaves > 0;
  const dietAtLimit = preferences.diet.length >= MAX_DIETS;
  const customDislikes = preferences.dislikes.filter(
    (dislike) => !DISLIKE_OPTIONS.some((option) => option.id === dislike)
  );

  const toggleDiet = (id: DietOption) => {
    if (!latestPreferences.current.diet.includes(id) && latestPreferences.current.diet.length >= MAX_DIETS) return;
    updatePreferences({ diet: toggle(latestPreferences.current.diet, id) });
  };

  const toggleAllergy = (id: AllergyOption) => {
    updatePreferences({ allergies: toggle(latestPreferences.current.allergies, id) });
  };

  const toggleDislike = (id: string) => {
    updatePreferences({ dislikes: toggle(latestPreferences.current.dislikes, id) });
  };

  const togglePainPoint = (id: PainPoint) => {
    updatePreferences({ painPoints: toggle(latestPreferences.current.painPoints, id) });
  };

  const setGoal = (goal: GoalOption) => {
    if (goal !== latestPreferences.current.goal) updatePreferences({ goal });
  };

  const setHouseholdSize = (householdSize: HouseholdSize) => {
    if (householdSize !== latestPreferences.current.householdSize) updatePreferences({ householdSize });
  };

  const addCustomDislike = () => {
    const text = dislikeDraft.trim().replace(/\s+/g, " ").slice(0, MAX_CUSTOM_DISLIKE_LENGTH);
    setDislikeDraft("");
    if (!text) return;

    // Typing the name of one of the chips selects that chip instead.
    const lowered = text.toLowerCase();
    const option = DISLIKE_OPTIONS.find(
      (entry) => entry.id === lowered || t(entry.labelKey).toLowerCase() === lowered
    );
    const entry = option?.id ?? text;
    if (latestPreferences.current.dislikes.some((dislike) => dislike.toLowerCase() === entry.toLowerCase())) return;

    updatePreferences({ dislikes: [...latestPreferences.current.dislikes, entry] });
  };

  const setMeasurementSystem = (measurementSystem: MeasurementSystem) => {
    updatePreferences({ measurementSystem });
  };

  const setNutritionDisplay = (nutritionDisplay: NutritionDisplay) => {
    updatePreferences({ nutritionDisplay });
  };

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      // The signed-in screens are guarded in app/_layout.tsx, so a successful
      // sign-out leaves the tabs on its own.
      track("signed_out");
      await signOut();
    } catch (error) {
      console.error("Failed to sign out:", error);
      reportError(error, { feature: "sign_out" });
      Alert.alert(t("profileSignOutFailedTitle"), t("profileSaveFailedMessage"));
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
            // Afterwards the device opens on the login screen, as it does after
            // signing out: it stays marked as set up. Whoever uses it next logs
            // in or creates an account, and a new account starts a fresh onboarding.
            try {
              setIsLoading(true);
              await convex.mutation(api.users.deleteAccount, {});
              track("account_deleted");
              await clearOnboardingStep();
              await clearOnboardingAnswers();
              await clearCachedProfile();
              await clearMealPlan();
              await signOut();
            } catch (error: any) {
              console.error("Failed to delete account:", error);
              Alert.alert(t("profileDeleteFailedTitle"), getServerError(error)?.message ?? error.message);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const avatarUrl = user?.avatarUrl;
  const displayName = user?.name || t("profileUserInfo");
  const chipLabelStyle = [styles.rowLabel, { textAlign, writingDirection } as const];

  return (
    <ScreenTransition>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: getTabBarClearance(insets.bottom) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
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
          {user?.email ? (
            <Text style={styles.userEmail} numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
        </View>

        {/* App preferences */}
        <SectionLabel label={t("profileSectionPreferences")} busy={preferencesSaving} isRTL={isRTL} />
        <View style={styles.card}>
          <SettingRow icon="globe-with-meridians" label={t("language")} isRTL={isRTL}>
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
          <SettingRow icon="straight-ruler" label={t("profileMeasurements")} isRTL={isRTL}>
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
          <SettingRow icon="bar-chart" label={t("profileNutrition")} isRTL={isRTL}>
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
          {Notifications ? (
            <>
              <View style={styles.hairline} />
              <SettingRow icon="alarm-clock" label={t("profileDailyReminder")} isRTL={isRTL}>
                <Switch
                  value={dailyReminder}
                  onValueChange={(next) => void toggleDailyReminder(next)}
                  trackColor={{ true: wasfaColors.primary, false: wasfaColors.line }}
                  ios_backgroundColor={wasfaColors.line}
                />
              </SettingRow>
            </>
          ) : null}
        </View>

        {/* Onboarding answers */}
        <SectionLabel label={t("profileSectionKitchen")} busy={preferencesSaving} isRTL={isRTL} />
        <View style={styles.card}>
          <View style={styles.chipBlock}>
            <Text style={chipLabelStyle}>{t("profileGoal")}</Text>
            <View style={styles.chipWrap}>
              {GOAL_OPTIONS.map((option) => (
                <PreferenceChip
                  key={option.id}
                  label={t(option.labelKey)}
                  active={preferences.goal === option.id}
                  onPress={() => setGoal(option.id)}
                  leading={<Glyph name={option.icon} size={20} style={styles.chipGlyph} />}
                />
              ))}
            </View>
          </View>
          <View style={styles.hairline} />
          <View style={styles.chipBlock}>
            <Text style={chipLabelStyle}>{t("profileHousehold")}</Text>
            <View style={styles.chipWrap}>
              {HOUSEHOLD_OPTIONS.map((option) => (
                <PreferenceChip
                  key={option.id}
                  label={t(option.labelKey)}
                  active={preferences.householdSize === option.id}
                  onPress={() => setHouseholdSize(option.id)}
                  leading={<Glyph name={option.icon} size={20} style={styles.chipGlyph} />}
                />
              ))}
            </View>
          </View>
          <View style={styles.hairline} />
          <View style={styles.chipBlock}>
            <Text style={chipLabelStyle}>{t("profileChallenges")}</Text>
            <View style={styles.chipWrap}>
              {PAIN_OPTIONS.map((option) => (
                <PreferenceChip
                  key={option.id}
                  label={t(option.labelKey)}
                  active={preferences.painPoints.includes(option.id)}
                  onPress={() => togglePainPoint(option.id)}
                  leading={<Glyph name={option.icon} size={20} style={styles.chipGlyph} />}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Dietary preferences */}
        <SectionLabel label={t("profileSectionDietary")} busy={preferencesSaving} isRTL={isRTL} />
        <View style={styles.card}>
          <View style={styles.chipBlock}>
            <Text style={chipLabelStyle}>{t("recipePreferencesDiet")}</Text>
            <Text style={[styles.blockHint, { textAlign, writingDirection }]}>{t("profileDietHint")}</Text>
            <View style={styles.chipWrap}>
              {DIET_OPTIONS.map((option) => {
                const active = preferences.diet.includes(option.id);
                return (
                  <PreferenceChip
                    key={option.id}
                    label={t(option.labelKey)}
                    active={active}
                    disabled={!active && dietAtLimit}
                    onPress={() => toggleDiet(option.id)}
                    leading={<Image source={dietImages[option.id]} style={styles.chipImage} />}
                  />
                );
              })}
            </View>
          </View>
          <View style={styles.hairline} />
          <View style={styles.chipBlock}>
            <Text style={chipLabelStyle}>{t("recipePreferencesAllergies")}</Text>
            <Text style={[styles.blockHint, { textAlign, writingDirection }]}>{t("profileAllergiesHint")}</Text>
            <View style={styles.chipWrap}>
              {ALLERGY_OPTIONS.map((option) => (
                <PreferenceChip
                  key={option.id}
                  label={t(option.labelKey)}
                  active={preferences.allergies.includes(option.id)}
                  onPress={() => toggleAllergy(option.id)}
                  leading={<Glyph name={option.icon} size={20} style={styles.chipGlyph} />}
                />
              ))}
            </View>
          </View>
          <View style={styles.hairline} />
          <View style={styles.chipBlock}>
            <Text style={chipLabelStyle}>{t("profileDislikes")}</Text>
            <Text style={[styles.blockHint, { textAlign, writingDirection }]}>{t("profileDislikesHint")}</Text>
            <View style={styles.chipWrap}>
              {DISLIKE_OPTIONS.map((option) => (
                <PreferenceChip
                  key={option.id}
                  label={t(option.labelKey)}
                  active={preferences.dislikes.includes(option.id)}
                  onPress={() => toggleDislike(option.id)}
                  leading={<Glyph name={option.icon} size={20} style={styles.chipGlyph} />}
                />
              ))}
              {customDislikes.map((dislike) => (
                <PreferenceChip
                  key={dislike}
                  label={dislike}
                  active
                  accessibilityLabel={`${t("profileDislikeRemove")} ${dislike}`}
                  onPress={() => toggleDislike(dislike)}
                  trailing={<Feather name="x" size={14} color={wasfaColors.muted} />}
                />
              ))}
            </View>
            <View style={styles.addRow}>
              <TextInput
                value={dislikeDraft}
                onChangeText={setDislikeDraft}
                onSubmitEditing={addCustomDislike}
                placeholder={t("profileDislikeAddPlaceholder")}
                placeholderTextColor={wasfaColors.disabledText}
                maxLength={MAX_CUSTOM_DISLIKE_LENGTH}
                returnKeyType="done"
                autoCorrect={false}
                style={[styles.addInput, { textAlign: isRTL ? "right" : "left", writingDirection }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("profileDislikeAdd")}
                accessibilityState={{ disabled: !dislikeDraft.trim() }}
                disabled={!dislikeDraft.trim()}
                style={[styles.addButton, !dislikeDraft.trim() && styles.addButtonDisabled]}
                onPress={addCustomDislike}
              >
                <Feather name="plus" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Actions */}
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
  icon,
  label,
  isRTL,
  children,
}: {
  icon: GlyphName;
  label: string;
  isRTL: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowGlyph}>
        <Glyph name={icon} size={20} />
      </View>
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
  trailing,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      style={[
        styles.preferenceChip,
        !leading && styles.preferenceChipPlain,
        active && styles.preferenceChipActive,
        disabled && styles.preferenceChipDisabled,
      ]}
      onPress={onPress}
    >
      {leading}
      <Text style={styles.preferenceChipText} numberOfLines={1}>
        {label}
      </Text>
      {trailing}
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
  rowGlyph: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.soft,
    alignItems: "center",
    justifyContent: "center",
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
    maxWidth: "100%",
  },
  preferenceChipPlain: {
    paddingStart: 14,
  },
  preferenceChipActive: {
    borderColor: wasfaColors.cta,
    backgroundColor: wasfaColors.ctaSoft,
  },
  preferenceChipDisabled: {
    opacity: 0.45,
  },
  blockHint: {
    marginTop: -8,
    fontSize: 13,
    lineHeight: 18,
    color: wasfaColors.muted,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addInput: {
    flex: 1,
    height: 44,
    borderRadius: wasfaRadius.pill,
    borderWidth: 2,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    paddingHorizontal: 16,
    fontSize: 14,
    color: wasfaColors.ink,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: wasfaColors.cta,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDisabled: {
    backgroundColor: wasfaColors.disabled,
  },
  preferenceChipText: {
    flexShrink: 1,
    color: wasfaColors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  chipImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  chipGlyph: {
    marginHorizontal: 4,
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
