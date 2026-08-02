import { LocalizedText as Text } from "@/components/LocalizedText";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { deleteRecipeById, getRecipeById, recalculateRecipeServings, type LocalizedRecipeText, type RecipeDetail } from "@/lib/recipes/client";
import { getIngredientWarnings } from "@/lib/recipes/ingredient-warnings";
import { loadRecipePreferences, type RecipePreferences } from "@/lib/recipes/preferences";
import {
  formatStepMetaItems,
  getEstimatedIngredientLabel,
  getSafeStepTitle,
} from "@/lib/recipes/rich-step-display";
import {
  cleanLocalizedIngredientName,
  convertIngredientAmount,
  getLocalizedUnitLabel,
  type MeasurementSystem,
} from "@/lib/recipes/units";
import { onboardingImages } from "@/lib/theme/onboarding";

type RecipeIngredient = RecipeDetail["ingredients_json"][number];
type RecipeStep = RecipeDetail["steps_json"][number];
type LocalizedIngredient = RecipeIngredient & { localizedName: string; localizedNotes?: string };

const colors = {
  background: "#F9FAF3",
  card: "#F9FAF3",
  surface: "#F3F4EE",
  softGreen: "#E8F5E0",
  border: "#E0EDD8",
  primary: "#5A8A5A",
  primaryDark: "#3D6B3D",
  text: "#252821",
  muted: "#6B7C6B",
  mint: "#82F4D2",
  mintText: "#00705A",
  warningBg: "#FFF1F1",
  warningText: "#BA1A1A",
  warningBorder: "#FFDAD6",
  yellow: "#F5A623",
};

function formatDuration(recipe: RecipeDetail, t: (key: any) => string) {
  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
  if (total > 0) return t("durationMinutes").replace("{count}", String(total));
  if (recipe.prep_minutes) return t("durationMinutes").replace("{count}", String(recipe.prep_minutes));
  if (recipe.cook_minutes) return t("durationMinutes").replace("{count}", String(recipe.cook_minutes));
  return "-";
}

function getNutritionNumber(recipe: RecipeDetail, key: string) {
  const value = recipe.nutrition_json?.[key];
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function stripOppositeScriptFallback(value: string | undefined, language: "en" | "ar") {
  if (!value) return undefined;
  const pattern = language === "en" ? /[\u0600-\u06FF]+/g : /[A-Za-z]+/g;
  return value.replace(pattern, "").replace(/\s{2,}/g, " ").trim() || value;
}

function getLocalizedRecipeText(recipe: RecipeDetail, language: "en" | "ar", translate: (key: any) => string): LocalizedRecipeText {
  const localized = recipe.localized[language];
  return {
    title: stripOppositeScriptFallback(localized?.title, language) ?? recipe.title,
    description: stripOppositeScriptFallback(localized?.description, language) ?? recipe.description ?? undefined,
    cuisine: stripOppositeScriptFallback(localized?.cuisine, language) ?? recipe.cuisine ?? translate("recipeCuisineFallback"),
    meal_type: stripOppositeScriptFallback(localized?.meal_type, language) ?? recipe.meal_type ?? translate("recipeMealTypeFallback"),
    ingredients: recipe.ingredients_json.map((ingredient, index) => {
      const rawName = stripOppositeScriptFallback(localized?.ingredients[index]?.name, language) ?? ingredient.name;
      return {
        name: cleanLocalizedIngredientName(rawName, ingredient.quantity),
        notes: stripOppositeScriptFallback(localized?.ingredients[index]?.notes, language) ?? ingredient.notes,
      };
    }),
    steps: recipe.steps_json.map((step, index) => ({
      ...step,
      title: stripOppositeScriptFallback(localized?.steps[index]?.title, language) ?? step.title,
      text: stripOppositeScriptFallback(localized?.steps[index]?.text, language) ?? step.text,
      equipment: localized?.steps[index]?.equipment?.map((item) => stripOppositeScriptFallback(item, language) ?? item) ?? step.equipment,
      ingredients_used: localized?.steps[index]?.ingredients_used?.map((item) => stripOppositeScriptFallback(item, language) ?? item) ?? step.ingredients_used,
      tips: localized?.steps[index]?.tips?.map((tip) => stripOppositeScriptFallback(tip, language) ?? tip) ?? step.tips,
    })),
  };
}

function getIngredientAmount(item: RecipeIngredient, measurementSystem: MeasurementSystem | null, language: "en" | "ar") {
  const converted = convertIngredientAmount(item, measurementSystem);
  const unit = getLocalizedUnitLabel(converted.unit || item.size, language);
  return [converted.quantity, unit].filter(Boolean).join(" ").trim();
}

export default function RecipeDetailsScreen() {
  const { isRTL, t, language } = useLanguage();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const recipeId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(() => new Set());
  const [expandedTipSteps, setExpandedTipSteps] = useState<Set<number>>(() => new Set());
  const [servingInput, setServingInput] = useState("");
  const [recalculationMessage, setRecalculationMessage] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<RecipePreferences>({
    diet: [],
    allergies: [],
    measurementSystem: null,
    nutritionDisplay: "show",
  });
  const recalculationRequestRef = useRef(0);

  const insets = useSafeAreaInsets();
  const align = isRTL ? "right" : "left";
  const writingDirection = isRTL ? "rtl" : "ltr";

  const load = useCallback(async () => {
    if (!recipeId) {
      setError(t("recipeNotFound"));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await getRecipeById(recipeId);
      if (!row) {
        setError(t("recipeNotFound"));
        setRecipe(null);
      } else {
        setRecipe(row);
        setServingInput(row.servings ? String(row.servings) : "");
        setCheckedIngredients(new Set());
        setExpandedTipSteps(new Set());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("recipeNotFound"));
    } finally {
      setLoading(false);
    }
  }, [recipeId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let isMounted = true;
    void loadRecipePreferences(user?.id).then((value) => {
      if (isMounted) setPreferences(value);
    });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!recipe) return;
    const nextServings = Number(servingInput);
    if (!Number.isFinite(nextServings) || nextServings < 1) return;
    const normalizedServings = Math.trunc(nextServings);
    if (normalizedServings === recipe.servings) {
      setRecalculationMessage(null);
      return;
    }

    const requestId = recalculationRequestRef.current + 1;
    recalculationRequestRef.current = requestId;
    setRecalculationMessage(t("recipeUpdatingIngredients" as any));

    const timeout = setTimeout(() => {
      void (async () => {
        try {
          const updated = await recalculateRecipeServings(recipe.id, normalizedServings);
          if (recalculationRequestRef.current !== requestId) return;
          setRecipe(updated);
          setServingInput(updated.servings ? String(updated.servings) : "");
          setCheckedIngredients(new Set());
          setRecalculationMessage(t("recipeUpdatedIngredients" as any));
          setTimeout(() => {
            if (recalculationRequestRef.current === requestId) setRecalculationMessage(null);
          }, 1400);
        } catch (e) {
          if (recalculationRequestRef.current !== requestId) return;
          setRecalculationMessage(e instanceof Error ? e.message : t("recipeUpdateAmountsFailed" as any));
        }
      })();
    }, 1000);

    return () => clearTimeout(timeout);
  }, [recipe, servingInput]);

  const handleDeleteRecipe = () => {
    if (!recipe) return;
    Alert.alert(t("deleteRecipeTitle"), t("deleteRecipeMessage"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              setWorking(true);
              await deleteRecipeById(recipe.id);
              router.replace("/(tabs)");
            } catch (e) {
              setError(e instanceof Error ? e.message : t("recipeNotFound"));
            } finally {
              setWorking(false);
            }
          })();
        },
      },
    ]);
  };

  const handleShareRecipe = async () => {
    if (!recipe) return;
    const shareText = getLocalizedRecipeText(recipe, language, t);
    const message = [shareText.title, shareText.description, recipe.source_url ?? recipe.source_reel_url]
      .filter(Boolean)
      .join("\n\n");
    try {
      await Share.share({
        title: shareText.title,
        message,
        url: recipe.source_url ?? recipe.source_reel_url ?? undefined,
      });
    } catch {
      setError(t("couldNotShareRecipe" as any));
    }
  };

  const toggleIngredientChecked = (index: number) => {
    setCheckedIngredients((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleStepTips = (index: number) => {
    setExpandedTipSteps((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>{t("recipeLoading")}</Text>
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.errorTitle, { textAlign: align }]}>{t("recipeNotFound")}</Text>
        <Text style={[styles.errorBody, { textAlign: align }]}>{error ?? t("recipeUnknownError")}</Text>
        <Pressable style={styles.outlineButton} onPress={() => router.back()}>
          <Text style={styles.outlineButtonText}>{t("back")}</Text>
        </Pressable>
      </View>
    );
  }

  const calories = getNutritionNumber(recipe, "calories");
  const protein = getNutritionNumber(recipe, "protein_g");
  const carbs = getNutritionNumber(recipe, "carbs_g");
  const fat = getNutritionNumber(recipe, "fat_g");
  const showNutrition = preferences.nutritionDisplay !== "hide";
  const recipeText = getLocalizedRecipeText(recipe, language, t);
  const localizedIngredients: LocalizedIngredient[] = recipe.ingredients_json.map((item, index) => ({
    ...item,
    localizedName: recipeText.ingredients[index]?.name ?? item.name,
    localizedNotes: recipeText.ingredients[index]?.notes,
  }));
  const localizedSteps = recipeText.steps.slice().sort((a, b) => a.order - b.order);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + insets.bottom }]}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <Image
            source={
              recipe.source_thumbnail_url
                ? { uri: recipe.source_thumbnail_url }
                : onboardingImages.mascotReading
            }
            resizeMode="cover"
            style={styles.heroImage}
          />
          <View style={styles.heroOverlay} />
          <View style={[styles.mobileOverlayNav, { paddingTop: Math.max(insets.top, 16) }]}>
            <Pressable onPress={() => router.back()} style={styles.glassButton}>
              <FontAwesome name="angle-left" size={28} color="#FFFFFF" />
            </Pressable>
            <View style={styles.navActions}>
              <Pressable onPress={() => void handleShareRecipe()} style={styles.glassButton}>
                <FontAwesome name="share-square-o" size={17} color="#FFFFFF" />
              </Pressable>
              <Pressable onPress={handleDeleteRecipe} style={styles.glassButton}>
                <FontAwesome name="trash-o" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.contentCard}>
          <View style={styles.headerSection}>
            <View style={styles.titleRow}>
              <View style={styles.titleBlock}>
                <Text style={[styles.recipeTitle, { textAlign: align }]} numberOfLines={3}>
                  {recipeText.title}
                </Text>
                {recipeText.description ? (
                  <Text style={[styles.description, { textAlign: align }]} numberOfLines={4}>
                    {recipeText.description}
                  </Text>
                ) : null}
              </View>

              <View style={styles.tagColumn}>
                <View style={styles.mintPill}>
                  <Text style={styles.mintPillText}>{recipeText.cuisine || t("recipeCuisineFallback")}</Text>
                </View>
                <View style={styles.greenPill}>
                  <Text style={styles.greenPillText}>{recipeText.meal_type || t("recipeMealTypeFallback")}</Text>
                </View>
              </View>
            </View>

            <View style={styles.metaWrap}>
              <MetaPill icon="clock-o" label={formatDuration(recipe, t)} />
              <View style={styles.servingsEditor}>
                <FontAwesome name="users" size={15} color={colors.muted} />
                <TextInput
                  value={servingInput}
                  onChangeText={(value) => setServingInput(value.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                  style={styles.servingsInput}
                  placeholder="-"
                  placeholderTextColor={colors.muted}
                />
                <Text style={styles.metaPillText}>{t("servings")}</Text>
              </View>
            </View>

            <View style={styles.preferenceHint}>
              <FontAwesome name="info-circle" size={14} color={colors.primaryDark} />
              <Text style={[styles.preferenceHintText, { textAlign: align, writingDirection }]}>
                {t("recipeUnitsHint" as any)}
              </Text>
            </View>
            {recalculationMessage ? (
              <Text style={styles.recalculationText}>{recalculationMessage}</Text>
            ) : null}
          </View>

          {showNutrition ? (
            <>
              <SectionTitle title={t("nutrition")} />
              <View style={styles.nutritionGrid}>
                <MacroCard label={t("protein")} value={protein ? `${protein}${t("macroGramSuffix" as any)}` : "-"} tone="green" />
                <MacroCard label={t("carbs")} value={carbs ? `${carbs}${t("macroGramSuffix" as any)}` : "-"} tone="red" />
                <MacroCard label={t("fats")} value={fat ? `${fat}${t("macroGramSuffix" as any)}` : "-"} tone="yellow" />
                <MacroCard label={t("calories")} value={calories ? `${calories}` : "-"} tone="orange" wide />
              </View>
            </>
          ) : null}

          <SectionTitle title={t("ingredients")} />
          <View style={styles.ingredientsList}>
            {localizedIngredients.map((item, index) => (
              <IngredientRow
                key={`${item.localizedName}-${index}`}
                item={item}
                measurementSystem={preferences.measurementSystem}
                checked={checkedIngredients.has(index)}
                warnings={getIngredientWarnings(recipe.ingredients_json[index], preferences)}
                suggestedAlternativeLabel={t("suggestedAlternative" as any)}
                estimatedLabelText={t("estimatedIngredient" as any)}
                isRTL={isRTL}
                language={language}
                onToggle={() => toggleIngredientChecked(index)}
              />
            ))}
          </View>

          <SectionTitle title={t("instructions")} />
          <View style={styles.stepsList}>
            {localizedSteps.map((item, index) => (
                <StepInstructionCard
                  key={`step-${index}`}
                  item={item}
                  index={index}
                  expanded={expandedTipSteps.has(index)}
                  isRTL={isRTL}
                  measurementSystem={preferences.measurementSystem}
                  stepFallbackLabel={t("stepN").replace("{order}", String(item.order || index + 1))}
                  tipLabel={t("tipLabel")}
                  minuteLabel={t("homeMinuteShort")}
                  onToggleTips={() => toggleStepTips(index)}
                />
              ))}
          </View>

          <View style={styles.chefTipCard}>
            <Image source={onboardingImages.mascotReading} style={styles.tipMascot} resizeMode="contain" />
            <View style={styles.tipTitleRow}>
              <FontAwesome name="lightbulb-o" size={18} color={colors.primaryDark} />
              <Text style={styles.tipTitle}>{t("chefTipTitle")}</Text>
            </View>
            <Text style={styles.tipText}>
              {t("chefTipBody")}
            </Text>
          </View>
        </View>
      </ScrollView>

    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function MetaPill({ icon, label }: { icon: ComponentProps<typeof FontAwesome>["name"]; label: string }) {
  return (
    <View style={styles.metaPill}>
      <FontAwesome name={icon} size={15} color={colors.muted} />
      <Text style={styles.metaPillText}>{label}</Text>
    </View>
  );
}

function MacroCard({
  label,
  value,
  tone,
  wide,
}: {
  label: string;
  value: string;
  tone: "green" | "red" | "yellow" | "orange";
  wide?: boolean;
}) {
  const toneStyle = {
    green: styles.macroGreen,
    red: styles.macroRed,
    yellow: styles.macroYellow,
    orange: styles.macroOrange,
  }[tone];
  const textStyle = {
    green: styles.macroGreenText,
    red: styles.macroRedText,
    yellow: styles.macroYellowText,
    orange: styles.macroOrangeText,
  }[tone];

  return (
    <View style={[styles.macroCard, toneStyle, wide && styles.macroWide]}>
      <Text style={[styles.macroLabel, textStyle]}>{label}</Text>
      <Text style={[styles.macroValue, textStyle]}>{value}</Text>
    </View>
  );
}

function IngredientRow({
  item,
  measurementSystem,
  checked,
  warnings,
  suggestedAlternativeLabel,
  estimatedLabelText,
  isRTL,
  language,
  onToggle,
}: {
  item: LocalizedIngredient;
  measurementSystem: MeasurementSystem | null;
  checked: boolean;
  warnings: ReturnType<typeof getIngredientWarnings>;
  suggestedAlternativeLabel: string;
  estimatedLabelText: string;
  isRTL: boolean;
  language: "en" | "ar";
  onToggle: () => void;
}) {
  const amount = getIngredientAmount(item, measurementSystem, language);
  const showEstimated = getEstimatedIngredientLabel(item) !== null;
  const align = isRTL ? "right" : "left";
  const writingDirection = isRTL ? "rtl" : "ltr";
  return (
    <View style={styles.ingredientRow}>
      <View style={styles.ingredientLeft}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          onPress={onToggle}
          style={[styles.checkbox, checked && styles.checkboxChecked]}
        >
          {checked ? <FontAwesome name="check" size={10} color="#FFFFFF" /> : null}
        </Pressable>
        <View style={styles.ingredientNameBlock}>
          <View style={styles.ingredientTitleLine}>
            <Text style={[styles.ingredientName, { textAlign: align, writingDirection }]}>{item.localizedName}</Text>
            {showEstimated ? (
              <View style={styles.estimatedIngredientBadge}>
                <Text style={styles.estimatedIngredientText}>{estimatedLabelText}</Text>
              </View>
            ) : null}
          </View>
          {warnings.map((warning, index) => (
            <View key={`${warning.kind}-${index}`} style={[styles.warningBlock, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
              <View style={styles.notePill}>
                <Text style={styles.notePillText}>{warning.label}</Text>
              </View>
              {warning.detail ? <Text style={[styles.warningDetail, { textAlign: align, writingDirection }]}>{warning.detail}</Text> : null}
              {warning.suggestion ? (
                <Text style={[styles.warningSuggestion, { textAlign: align, writingDirection }]}>
                  {suggestedAlternativeLabel.replace("{name}", warning.suggestion)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>
      <Text style={[styles.ingredientAmount, { textAlign: align, writingDirection }]}>
        {amount || "-"}
      </Text>
    </View>
  );
}

function StepInstructionCard({
  item,
  index,
  expanded,
  isRTL,
  measurementSystem,
  stepFallbackLabel,
  tipLabel,
  minuteLabel,
  onToggleTips,
}: {
  item: RecipeStep;
  index: number;
  expanded: boolean;
  isRTL: boolean;
  measurementSystem: MeasurementSystem | null;
  stepFallbackLabel: string;
  tipLabel: string;
  minuteLabel: string;
  onToggleTips: () => void;
}) {
  const align = isRTL ? "right" : "left";
  const writingDirection = isRTL ? "rtl" : "ltr";
  const metaItems = formatStepMetaItems(item, measurementSystem, minuteLabel);
  const tips = item.tips?.filter((tip) => tip.trim()) ?? [];

  return (
    <View style={styles.stepCard}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{item.order || index + 1}</Text>
      </View>
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { textAlign: align, writingDirection }]}>
          {getSafeStepTitle(item, index, stepFallbackLabel)}
        </Text>
        {metaItems.length ? (
          <View style={styles.stepMetaWrap}>
            {metaItems.map((meta) => (
              <View key={meta} style={styles.stepMetaPill}>
                <Text style={[styles.stepMetaPillText, { writingDirection }]}>{meta}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={[styles.stepText, { textAlign: align, writingDirection }]}>{item.text}</Text>
        {tips.length ? (
          <View style={styles.stepTipSection}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={onToggleTips}
              style={styles.stepTipToggle}
            >
              <FontAwesome name="lightbulb-o" size={14} color={colors.primaryDark} />
              <Text style={styles.stepTipToggleText}>{tipLabel}</Text>
              <FontAwesome name={expanded ? "angle-up" : "angle-down"} size={16} color={colors.primaryDark} />
            </Pressable>
            {expanded ? (
              <View style={styles.stepTipBlock}>
                {tips.map((tip, tipIndex) => (
                  <Text key={`${tip}-${tipIndex}`} style={[styles.stepTipText, { textAlign: align, writingDirection }]}>
                    {tip}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.warningText,
  },
  errorBody: {
    fontSize: 14,
    color: colors.warningText,
  },
  outlineButton: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  outlineButtonText: {
    color: colors.primaryDark,
    fontWeight: "700",
  },
  heroSection: {
    height: 400,
    width: "100%",
    maxWidth: 896,
    marginBottom: -48,
    overflow: "hidden",
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.20)",
  },
  mobileOverlayNav: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  navActions: {
    flexDirection: "row",
    gap: 10,
  },
  glassButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  contentCard: {
    width: "100%",
    maxWidth: 896,
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 25,
    paddingTop: 33,
    paddingBottom: 80,
    gap: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 6,
  },
  headerSection: {
    gap: 24,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  recipeTitle: {
    color: colors.primaryDark,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  description: {
    color: "#424940",
    fontSize: 14,
    lineHeight: 22,
  },
  tagColumn: {
    alignItems: "flex-end",
    gap: 8,
    maxWidth: 132,
  },
  mintPill: {
    borderRadius: 999,
    backgroundColor: colors.mint,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  mintPillText: {
    color: colors.mintText,
    fontSize: 13,
    lineHeight: 20,
  },
  greenPill: {
    borderRadius: 999,
    backgroundColor: colors.softGreen,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  greenPillText: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 20,
  },
  metaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metaPill: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 17,
    paddingVertical: 9,
  },
  metaPillText: {
    color: colors.muted,
    fontSize: 14,
  },
  servingsEditor: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 17,
    paddingVertical: 7,
  },
  servingsInput: {
    minWidth: 30,
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    padding: 0,
    textAlign: "center",
  },
  preferenceHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.softGreen,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  preferenceHintText: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 13,
    lineHeight: 18,
  },
  recalculationText: {
    color: colors.muted,
    fontSize: 13,
  },
  sectionHeader: {
    width: "100%",
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
  },
  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  macroCard: {
    minHeight: 65,
    flexGrow: 1,
    flexBasis: "30%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  macroWide: {
    flexBasis: "100%",
  },
  macroGreen: {
    backgroundColor: "rgba(232,245,224,0.6)",
    borderColor: "rgba(90,138,90,0.2)",
  },
  macroRed: {
    backgroundColor: "rgba(255,218,214,0.4)",
    borderColor: "rgba(186,26,26,0.1)",
  },
  macroYellow: {
    backgroundColor: "rgba(243,209,121,0.2)",
    borderColor: "rgba(243,209,121,0.3)",
  },
  macroOrange: {
    backgroundColor: "rgba(245,166,35,0.2)",
    borderColor: "rgba(245,166,35,0.3)",
  },
  macroLabel: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    lineHeight: 15,
  },
  macroValue: {
    fontSize: 16,
    lineHeight: 24,
  },
  macroGreenText: {
    color: colors.primaryDark,
  },
  macroRedText: {
    color: "#93000A",
  },
  macroYellowText: {
    color: colors.text,
  },
  macroOrangeText: {
    color: colors.yellow,
  },
  ingredientsList: {
    gap: 12,
  },
  ingredientRow: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 13,
  },
  ingredientLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
  },
  ingredientNameBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  ingredientTitleLine: {
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  ingredientName: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  estimatedIngredientBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(245,166,35,0.26)",
    backgroundColor: "rgba(245,166,35,0.16)",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  estimatedIngredientText: {
    color: colors.yellow,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  ingredientAmount: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "right",
  },
  notePill: {
    alignSelf: "flex-start",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningBg,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  notePillText: {
    color: colors.warningText,
    fontSize: 10,
    fontWeight: "800",
  },
  warningBlock: {
    alignItems: "flex-start",
    gap: 3,
  },
  warningDetail: {
    color: colors.warningText,
    fontSize: 12,
    lineHeight: 16,
  },
  warningSuggestion: {
    color: colors.primaryDark,
    fontSize: 12,
    lineHeight: 16,
  },
  stepsList: {
    gap: 16,
  },
  stepCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    padding: 17,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  stepBadgeText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  stepContent: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  stepTitle: {
    color: colors.primaryDark,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
  },
  stepMetaWrap: {
    flexWrap: "wrap",
    gap: 8,
  },
  stepMetaPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepMetaPillText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  stepText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 26,
  },
  stepMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 6,
  },
  stepTipSection: {
    gap: 8,
  },
  stepTipToggle: {
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(90,138,90,0.22)",
    backgroundColor: "rgba(232,245,224,0.65)",
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  stepTipToggleText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },
  stepTipBlock: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(90,138,90,0.16)",
    backgroundColor: "rgba(232,245,224,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  stepTipText: {
    color: "#424940",
    fontSize: 14,
    lineHeight: 20,
  },
  chefTipCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(90,138,90,0.2)",
    backgroundColor: "rgba(232,245,224,0.5)",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
    padding: 25,
  },
  tipMascot: {
    width: 96,
    height: 150,
  },
  tipTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tipTitle: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: "700",
  },
  tipText: {
    color: "#424940",
    fontSize: 16,
    lineHeight: 26,
    textAlign: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
});
