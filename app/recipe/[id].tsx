import { LocalizedText as Text } from "@/components/LocalizedText";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CheckBox } from "@/components/wasfa/CheckBox";
import { CtaButton } from "@/components/wasfa/CtaButton";
import { FoodIconTile } from "@/components/wasfa/Glyph";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { planRecipe } from "@/lib/planner/actions";
import {
  ANY_DAY,
  getWeekDates,
  isRecipePlanned,
  removeRecipeFromWholePlan,
  toDateKey,
} from "@/lib/planner/plan";
import { useMealPlan } from "@/lib/planner/storage";
import type { TranslationKey } from "@/lib/i18n/translations";
import { ALLERGY_OPTIONS, DISLIKE_OPTIONS } from "@/lib/onboarding/flow";
import {
  deleteRecipeById,
  getRecipeById,
  localizeRecipe,
  recalculateRecipeServings,
  setIngredientUseOriginal,
  type LocalizedRecipeText,
  type RecipeDetail,
} from "@/lib/recipes/client";
import {
  applyIngredientSwaps,
  assessRecipeIngredients,
  type IngredientAssessment,
  type IngredientSwap,
} from "@/lib/recipes/ingredient-warnings";
import { hasLocalizedContent } from "@/lib/recipes/localization";
import {
  EMPTY_RECIPE_PREFERENCES,
  loadRecipePreferences,
  type RecipePreferences,
} from "@/lib/recipes/preferences";
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
import { toArabicIndicDigits } from "@/lib/recipes/numerals";
import { onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors, wasfaRadius, wasfaShadow } from "@/lib/theme/wasfa";

type RecipeIngredient = RecipeDetail["ingredients_json"][number];
type RecipeStep = RecipeDetail["steps_json"][number];
type LocalizedIngredient = RecipeIngredient & { localizedName: string; localizedNotes?: string };
type RecipeView = "ingredients" | "cook";

const HALAL_CONCERN_KEYS: Record<"pork" | "alcohol", TranslationKey> = {
  pork: "recipeHalalConcernPork",
  alcohol: "recipeHalalConcernAlcohol",
};

const colors = {
  ...wasfaColors,
  dangerSoft: "#FDECEC",
  dangerBorder: "#F6CFCF",
  onDeepLine: "rgba(255,255,255,0.28)",
  onDeepFill: "rgba(255,255,255,0.12)",
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

function shouldUseFallbackValue(value: string | undefined, language: "en" | "ar") {
  if (!value) return undefined;
  const hasArabic = /[؀-ۿ]/.test(value);
  const hasLatin = /[A-Za-z]/.test(value);
  if (language === "ar") return !hasArabic && hasLatin;
  return hasArabic && !hasLatin;
}

function getLocalizedFieldValue(
  value: string | undefined,
  fallback: string | undefined,
  language: "en" | "ar"
) {
  if (!value) return fallback;
  return shouldUseFallbackValue(value, language) ? fallback : value;
}

function getLocalizedRecipeText(recipe: RecipeDetail, language: "en" | "ar", translate: (key: any) => string): LocalizedRecipeText {
  const localized = recipe.localized[language];
  return {
    title: getLocalizedFieldValue(localized?.title, recipe.title, language) ?? recipe.title,
    description:
      getLocalizedFieldValue(localized?.description, recipe.description ?? undefined, language) ??
      recipe.description ??
      undefined,
    cuisine:
      getLocalizedFieldValue(localized?.cuisine, recipe.cuisine ?? translate("recipeCuisineFallback"), language) ??
      recipe.cuisine ??
      translate("recipeCuisineFallback"),
    meal_type:
      getLocalizedFieldValue(localized?.meal_type, recipe.meal_type ?? translate("recipeMealTypeFallback"), language) ??
      recipe.meal_type ??
      translate("recipeMealTypeFallback"),
    ingredients: recipe.ingredients_json.map((ingredient, index) => {
      const rawName =
        getLocalizedFieldValue(localized?.ingredients[index]?.name, ingredient.name, language) ??
        ingredient.name;
      return {
        name: cleanLocalizedIngredientName(rawName, ingredient.quantity),
        notes:
          getLocalizedFieldValue(localized?.ingredients[index]?.notes, ingredient.notes, language) ??
          ingredient.notes,
      };
    }),
    steps: recipe.steps_json.map((step, index) => ({
      ...step,
      title: getLocalizedFieldValue(localized?.steps[index]?.title, step.title, language) ?? step.title,
      text: getLocalizedFieldValue(localized?.steps[index]?.text, step.text, language) ?? step.text,
      equipment:
        localized?.steps[index]?.equipment?.map((item) => getLocalizedFieldValue(item, item, language) ?? item) ??
        step.equipment,
      ingredients_used:
        localized?.steps[index]?.ingredients_used?.map((item) => getLocalizedFieldValue(item, item, language) ?? item) ??
        step.ingredients_used,
      tips:
        localized?.steps[index]?.tips?.map((tip) => getLocalizedFieldValue(tip, tip, language) ?? tip) ??
        step.tips,
    })),
  };
}

function getIngredientAmount(item: RecipeIngredient, measurementSystem: MeasurementSystem | null, language: "en" | "ar") {
  const converted = convertIngredientAmount(item, measurementSystem);
  const unit = getLocalizedUnitLabel(converted.unit || item.size, language);
  const quantity =
    language === "ar" && converted.quantity
      ? toArabicIndicDigits(converted.quantity)
      : converted.quantity;
  return [quantity, unit].filter(Boolean).join(" ").trim();
}

export default function RecipeDetailsScreen() {
  const { isRTL, t, language } = useLanguage();
  const { user } = useAuth();
  const { plan, updatePlan } = useMealPlan();
  const params = useLocalSearchParams<{ id?: string }>();
  const recipeId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [activeView, setActiveView] = useState<RecipeView>("ingredients");
  const [cookStep, setCookStep] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(() => new Set());
  const [expandedTipSteps, setExpandedTipSteps] = useState<Set<number>>(() => new Set());
  const [servingInput, setServingInput] = useState("");
  const [recalculationMessage, setRecalculationMessage] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planNotice, setPlanNotice] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<RecipePreferences>(EMPTY_RECIPE_PREFERENCES);
  const [translating, setTranslating] = useState(false);
  const recalculationRequestRef = useRef(0);
  // Recipe and language pairs already sent for translation, so a recipe that
  // cannot be translated is not retried on every render.
  const translationAttempts = useRef(new Set<string>());

  const insets = useSafeAreaInsets();
  // Root layout sets `direction`, so "left" is the logical start in both languages.
  const writingDirection = isRTL ? "rtl" : "ltr";
  const weekDayKeys = useMemo(() => getWeekDates(new Date()).map(toDateKey), []);

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
        setCookStep(0);
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

  // A recipe saved in one language only gets the other one written the first
  // time it is opened in that language.
  useEffect(() => {
    if (!recipe || hasLocalizedContent(recipe, language)) return;
    const attemptKey = `${recipe.id}:${language}`;
    if (translationAttempts.current.has(attemptKey)) return;
    translationAttempts.current.add(attemptKey);

    setTranslating(true);
    void localizeRecipe(recipe.id)
      .then((updated) => {
        if (!updated) return;
        // Only the translations are taken, so a change made to the recipe
        // while the request was running is kept.
        setRecipe((current) =>
          current && current.id === updated.id ? { ...current, localized: updated.localized } : current
        );
      })
      .catch(() => {
        // The recipe stays readable in its original language.
      })
      .finally(() => setTranslating(false));
  }, [recipe, language]);

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
    setRecalculationMessage(t("recipeUpdatingIngredients"));

    const timeout = setTimeout(() => {
      void (async () => {
        try {
          const updated = await recalculateRecipeServings(recipe.id, normalizedServings);
          if (recalculationRequestRef.current !== requestId) return;
          setRecipe(updated);
          setServingInput(updated.servings ? String(updated.servings) : "");
          setCheckedIngredients(new Set());
          setRecalculationMessage(t("recipeUpdatedIngredients"));
          setTimeout(() => {
            if (recalculationRequestRef.current === requestId) setRecalculationMessage(null);
          }, 1400);
        } catch (e) {
          if (recalculationRequestRef.current !== requestId) return;
          setRecalculationMessage(e instanceof Error ? e.message : t("recipeUpdateAmountsFailed"));
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
              // Its meals and grocery lines go with it, so the tab badges drop too.
              await updatePlan((current) => removeRecipeFromWholePlan(current, recipe.id));
              router.dismissTo("/(tabs)");
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
      setError(t("couldNotShareRecipe"));
    }
  };

  const handleAddToPlan = async () => {
    if (!recipe || planning) return;
    setPlanning(true);
    setPlanNotice(null);
    try {
      // Planning a recipe also puts its ingredients on the grocery list.
      const result = await planRecipe(updatePlan, ANY_DAY, recipe.id);
      if (!result.grocerySynced) setPlanNotice(t("recipePlanGroceryNotice"));
    } catch {
      setPlanNotice(t("recipePlanFailed"));
    } finally {
      setPlanning(false);
    }
  };

  const changeServings = (delta: number) => {
    setServingInput((current) => {
      const base = Number(current);
      const next = (Number.isFinite(base) ? Math.trunc(base) : 0) + delta;
      return String(Math.max(1, next));
    });
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

  const setUseOriginal = (index: number, useOriginal: boolean) => {
    if (!recipe) return;
    const previous = recipe.ingredients_json;
    setRecipe({
      ...recipe,
      ingredients_json: previous.map((ingredient, position) =>
        position === index ? { ...ingredient, use_original: useOriginal } : ingredient
      ),
    });

    void setIngredientUseOriginal(recipe, index, useOriginal).catch(() => {
      setRecipe((current) =>
        current && current.id === recipe.id ? { ...current, ingredients_json: previous } : current
      );
      Alert.alert(t("recipeSwapSaveFailed"));
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
        <Text style={[styles.errorTitle, { writingDirection }]}>{t("recipeNotFound")}</Text>
        <Text style={[styles.errorBody, { writingDirection }]}>{error ?? t("recipeUnknownError")}</Text>
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
  const assessments = assessRecipeIngredients(recipe, preferences, language);

  // Steps mention ingredients by name, so a halal swap is carried into them.
  const swaps: IngredientSwap[] = localizedIngredients.flatMap((item, index) => {
    const halal = assessments[index]?.halal;
    return halal?.swapped && halal.alternative ? [{ from: item.localizedName, to: halal.alternative }] : [];
  });
  const swapText = (text: string) => applyIngredientSwaps(text, swaps);
  const localizedSteps = recipeText.steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((step) =>
      swaps.length === 0
        ? step
        : {
            ...step,
            title: step.title ? swapText(step.title) : step.title,
            text: swapText(step.text),
            ingredients_used: step.ingredients_used?.map(swapText),
            tips: step.tips?.map(swapText),
          }
    );

  const allergyLabel = (id: string) => {
    const option = ALLERGY_OPTIONS.find((entry) => entry.id === id);
    return option ? t(option.labelKey) : id;
  };
  const dislikeLabel = (id: string) => {
    const option = DISLIKE_OPTIONS.find((entry) => entry.id === id);
    return option ? t(option.labelKey) : id;
  };
  const listSeparator = isRTL ? "، " : ", ";
  const uniqueLabels = (labels: string[]) => Array.from(new Set(labels)).join(listSeparator);
  const alertLines = [
    {
      key: "allergy",
      danger: true,
      template: t("recipeAlertAllergy"),
      names: uniqueLabels(assessments.flatMap((entry) => entry.allergies.map(allergyLabel))),
    },
    {
      key: "not-halal",
      danger: true,
      template: t("recipeAlertNotHalal"),
      names: uniqueLabels(
        localizedIngredients.flatMap((item, index) => {
          const halal = assessments[index]?.halal;
          return halal && !halal.swapped ? [item.localizedName] : [];
        })
      ),
    },
    {
      key: "halal-swap",
      danger: false,
      template: t("recipeAlertHalalSwap"),
      names: uniqueLabels(swaps.map((swap) => swap.to)),
    },
    {
      key: "dislike",
      danger: false,
      template: t("recipeAlertDislike"),
      names: uniqueLabels(assessments.flatMap((entry) => entry.dislikes.map(dislikeLabel))),
    },
  ].filter((line) => line.names.length > 0);
  const isPlanned = isRecipePlanned(plan, recipe.id, weekDayKeys);
  const servingCount = Number(servingInput);
  const canDecreaseServings = Number.isFinite(servingCount) && servingCount > 1;
  const activeStepIndex = Math.min(cookStep, Math.max(localizedSteps.length - 1, 0));
  const activeStep = localizedSteps[activeStepIndex];
  const formatStepOf = (index: number) =>
    t("recipeStepOf")
      .replace("{current}", String(index + 1))
      .replace("{total}", String(localizedSteps.length));

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
            resizeMode={recipe.source_thumbnail_url ? "cover" : "contain"}
            style={styles.heroImage}
          />
          <View style={[styles.heroNav, { paddingTop: Math.max(insets.top, 16) }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("back")}
              onPress={() => router.back()}
              style={styles.heroButton}
            >
              <Feather name={isRTL ? "chevron-right" : "chevron-left"} size={24} color={colors.ink} />
            </Pressable>
            <View style={styles.heroActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("recipeShare")}
                onPress={() => void handleShareRecipe()}
                style={styles.heroButton}
              >
                <Feather name="share" size={19} color={colors.ink} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("delete")}
                onPress={handleDeleteRecipe}
                disabled={working}
                style={[styles.heroButton, working && styles.disabledButton]}
              >
                <Feather name="trash-2" size={19} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.headerSection}>
            <View style={styles.tagRow}>
              <View style={styles.cuisinePill}>
                <Text style={styles.cuisinePillText}>{recipeText.cuisine || t("recipeCuisineFallback")}</Text>
              </View>
              <View style={styles.mealTypePill}>
                <Text style={styles.mealTypePillText}>{recipeText.meal_type || t("recipeMealTypeFallback")}</Text>
              </View>
            </View>

            <Text style={[styles.recipeTitle, { writingDirection }]} numberOfLines={3}>
              {recipeText.title}
            </Text>
            {recipeText.description ? (
              <Text style={[styles.description, { writingDirection }]} numberOfLines={4}>
                {recipeText.description}
              </Text>
            ) : null}

            <View style={styles.metaWrap}>
              <View style={styles.timePill}>
                <Feather name="clock" size={16} color={colors.primary} />
                <Text style={styles.timePillText}>{formatDuration(recipe, t)}</Text>
              </View>
              <View style={styles.servingsStepper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("recipeServingsDecrease")}
                  accessibilityState={{ disabled: !canDecreaseServings }}
                  disabled={!canDecreaseServings}
                  hitSlop={6}
                  onPress={() => changeServings(-1)}
                  style={[styles.stepperButton, !canDecreaseServings && styles.disabledButton]}
                >
                  <Feather name="minus" size={16} color={colors.primaryDark} />
                </Pressable>
                <Text style={styles.servingsText}>
                  {t("recipePeople").replace("{count}", servingInput || "-")}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("recipeServingsIncrease")}
                  hitSlop={6}
                  onPress={() => changeServings(1)}
                  style={styles.stepperButton}
                >
                  <Feather name="plus" size={16} color={colors.primaryDark} />
                </Pressable>
              </View>
            </View>
            {recalculationMessage ? (
              <Text style={[styles.recalculationText, { writingDirection }]}>{recalculationMessage}</Text>
            ) : null}
          </View>

          <View style={styles.segmentRow}>
            <SegmentButton
              label={t("ingredients")}
              active={activeView === "ingredients"}
              onPress={() => setActiveView("ingredients")}
              renderIcon={(color) => <Feather name="list" size={17} color={color} />}
            />
            <SegmentButton
              label={t("recipeCookMode")}
              active={activeView === "cook"}
              onPress={() => setActiveView("cook")}
              renderIcon={(color) => <MaterialCommunityIcons name="chef-hat" size={18} color={color} />}
            />
          </View>

          {activeView === "ingredients" ? (
            <>
              {translating ? (
                <View style={styles.translatingRow}>
                  <ActivityIndicator color={colors.primary} size="small" />
                  <Text style={[styles.preferenceHintText, { writingDirection }]}>
                    {t("recipeTranslating")}
                  </Text>
                </View>
              ) : null}

              {alertLines.length > 0 ? (
                <View style={styles.alertCard}>
                  {alertLines.map((line) => (
                    <View key={line.key} style={styles.alertLine}>
                      <Feather
                        name={line.danger ? "alert-triangle" : "info"}
                        size={15}
                        color={line.danger ? colors.danger : colors.primaryDark}
                      />
                      <Text
                        style={[styles.alertText, line.danger && styles.alertTextDanger, { writingDirection }]}
                      >
                        {line.template.replace("{names}", line.names)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.ingredientsList}>
                {localizedIngredients.map((item, index) => (
                  <IngredientRow
                    key={`${item.localizedName}-${index}`}
                    item={item}
                    measurementSystem={preferences.measurementSystem}
                    checked={checkedIngredients.has(index)}
                    assessment={assessments[index]}
                    allergyLabel={allergyLabel}
                    dislikeLabel={dislikeLabel}
                    estimatedLabelText={t("estimatedIngredient")}
                    isRTL={isRTL}
                    language={language}
                    t={t}
                    onToggle={() => toggleIngredientChecked(index)}
                    onUseOriginal={(useOriginal) => setUseOriginal(index, useOriginal)}
                  />
                ))}
              </View>

              <View style={styles.preferenceHint}>
                <Feather name="info" size={14} color={colors.muted} />
                <Text style={[styles.preferenceHintText, { writingDirection }]}>
                  {t("recipeUnitsHint")}
                </Text>
              </View>

              <View style={styles.planSection}>
                {isPlanned ? (
                  <View accessibilityRole="text" style={styles.plannedButton}>
                    <Feather name="check" size={18} color={colors.primaryDark} />
                    <Text style={styles.plannedButtonText}>{t("recipeInPlan")}</Text>
                  </View>
                ) : (
                  <CtaButton
                    label={t("recipeAddToPlan")}
                    loading={planning}
                    onPress={() => void handleAddToPlan()}
                    leading={<MaterialCommunityIcons name="calendar-plus" size={20} color="#FFFFFF" />}
                  />
                )}
                {planNotice ? (
                  <Text style={[styles.planNotice, { writingDirection }]}>{planNotice}</Text>
                ) : null}
              </View>

              {showNutrition ? (
                <>
                  <SectionTitle title={t("nutrition")} />
                  <View style={styles.nutritionGrid}>
                    <MacroCard label={t("calories")} value={calories ? `${calories}` : "-"} wide />
                    <MacroCard label={t("protein")} value={protein ? `${protein}${t("macroGramSuffix")}` : "-"} />
                    <MacroCard label={t("carbs")} value={carbs ? `${carbs}${t("macroGramSuffix")}` : "-"} />
                    <MacroCard label={t("fats")} value={fat ? `${fat}${t("macroGramSuffix")}` : "-"} />
                  </View>
                </>
              ) : null}

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
                <View style={styles.tipBody}>
                  <View style={styles.tipTitleRow}>
                    <Feather name="zap" size={16} color={colors.cta} />
                    <Text style={styles.tipTitle}>{t("chefTipTitle")}</Text>
                  </View>
                  <Text style={[styles.tipText, { writingDirection }]}>{t("chefTipBody")}</Text>
                </View>
              </View>
            </>
          ) : activeStep ? (
            <>
              <CookModeCard
                item={activeStep}
                index={activeStepIndex}
                total={localizedSteps.length}
                expanded={expandedTipSteps.has(activeStepIndex)}
                isRTL={isRTL}
                measurementSystem={preferences.measurementSystem}
                eyebrow={formatStepOf(activeStepIndex)}
                stepFallbackLabel={t("stepN").replace("{order}", String(activeStep.order || activeStepIndex + 1))}
                durationLabel={
                  typeof activeStep.duration_minutes === "number" && Number.isFinite(activeStep.duration_minutes)
                    ? t("durationMinutes").replace("{count}", String(Math.round(activeStep.duration_minutes)))
                    : null
                }
                tipLabel={t("tipLabel")}
                minuteLabel={t("homeMinuteShort")}
                backLabel={t("back")}
                nextLabel={t("recipeNextStep")}
                doneLabel={t("recipeDoneCooking")}
                onToggleTips={() => toggleStepTips(activeStepIndex)}
                onBack={() => setCookStep(activeStepIndex - 1)}
                onNext={() => setCookStep(activeStepIndex + 1)}
                onDone={() => {
                  setCookStep(0);
                  setActiveView("ingredients");
                }}
              />
              <View style={styles.cookDots}>
                {localizedSteps.map((_, index) => (
                  <Pressable
                    key={`dot-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={formatStepOf(index)}
                    accessibilityState={{ selected: index === activeStepIndex }}
                    hitSlop={8}
                    onPress={() => setCookStep(index)}
                    style={[styles.cookDot, index === activeStepIndex && styles.cookDotActive]}
                  />
                ))}
              </View>
            </>
          ) : (
            <Text style={[styles.emptyStepsText, { writingDirection }]}>{t("recipeNoSteps")}</Text>
          )}
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

function SegmentButton({
  label,
  active,
  onPress,
  renderIcon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  renderIcon: (color: string) => ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
    >
      {renderIcon(active ? "#FFFFFF" : colors.ink)}
      <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function MacroCard({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.macroCard, wide && styles.macroWide]}>
      <Text style={[styles.macroValue, wide && styles.macroWideValue]}>{value}</Text>
      <Text style={styles.macroLabel} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </View>
  );
}

function IngredientRow({
  item,
  measurementSystem,
  checked,
  assessment,
  allergyLabel,
  dislikeLabel,
  estimatedLabelText,
  isRTL,
  language,
  t,
  onToggle,
  onUseOriginal,
}: {
  item: LocalizedIngredient;
  measurementSystem: MeasurementSystem | null;
  checked: boolean;
  assessment: IngredientAssessment;
  allergyLabel: (id: string) => string;
  dislikeLabel: (id: string) => string;
  estimatedLabelText: string;
  isRTL: boolean;
  language: "en" | "ar";
  t: (key: TranslationKey) => string;
  onToggle: () => void;
  onUseOriginal: (useOriginal: boolean) => void;
}) {
  const amount = getIngredientAmount(item, measurementSystem, language);
  const showEstimated = getEstimatedIngredientLabel(item) !== null;
  const writingDirection = isRTL ? "rtl" : "ltr";
  const halal = assessment.halal;
  // A halal swap takes the ingredient's place; the original stays one tap away.
  const displayName = halal?.swapped && halal.alternative ? halal.alternative : item.localizedName;
  const halalConcern =
    halal?.concern ?? (halal?.concernKind ? t(HALAL_CONCERN_KEYS[halal.concernKind]) : undefined);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={[styles.ingredientRow, checked && styles.ingredientRowChecked]}
    >
      {/* Both names feed the icon lookup so it matches in either language. */}
      <FoodIconTile name={halal?.swapped ? displayName : `${item.name} ${item.localizedName}`} />
      <View style={styles.ingredientNameBlock}>
        {amount ? (
          <Text style={[styles.ingredientAmount, checked && styles.strikeText, { writingDirection }]}>
            {amount}
          </Text>
        ) : null}
        <View style={styles.ingredientTitleLine}>
          <Text
            style={[
              amount ? styles.ingredientName : styles.ingredientAmount,
              checked && styles.strikeText,
              { writingDirection },
            ]}
          >
            {displayName}
          </Text>
          {showEstimated ? (
            <View style={styles.estimatedIngredientBadge}>
              <Text style={[styles.estimatedIngredientText, !isRTL && styles.latinCaps]}>{estimatedLabelText}</Text>
            </View>
          ) : null}
        </View>
        {assessment.allergies.length > 0 || assessment.dislikes.length > 0 ? (
          <View style={styles.flagRow}>
            {assessment.allergies.map((allergy) => (
              <View key={allergy} style={styles.notePill}>
                <Text style={styles.notePillText}>
                  {t("recipeFlagAllergy").replace("{name}", allergyLabel(allergy))}
                </Text>
              </View>
            ))}
            {assessment.dislikes.map((dislike) => (
              <View key={dislike} style={styles.dislikePill}>
                <Text style={styles.dislikePillText}>
                  {t("recipeFlagDislike").replace("{name}", dislikeLabel(dislike))}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {halal?.swapped ? (
          <View style={styles.warningBlock}>
            <View style={styles.swapPill}>
              <Text style={styles.swapPillText}>{t("recipeHalalSwap")}</Text>
            </View>
            <Text style={[styles.warningSuggestion, { writingDirection }]}>
              {t("recipeHalalInsteadOf").replace("{name}", item.localizedName)}
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onUseOriginal(true)}
              style={styles.flagAction}
            >
              <Feather name="rotate-ccw" size={12} color={colors.muted} />
              <Text style={styles.flagActionText}>{t("recipeUseOriginal")}</Text>
            </Pressable>
          </View>
        ) : halal ? (
          <View style={styles.warningBlock}>
            <View style={styles.notePill}>
              <Text style={styles.notePillText}>{t("recipeNotHalal")}</Text>
            </View>
            {halalConcern ? (
              <Text style={[styles.warningDetail, { writingDirection }]}>{halalConcern}</Text>
            ) : null}
            {halal.alternative ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => onUseOriginal(false)}
                style={styles.flagAction}
              >
                <Feather name="repeat" size={12} color={colors.primaryDark} />
                <Text style={[styles.flagActionText, styles.flagActionTextPrimary]}>
                  {t("recipeUseHalalSwap").replace("{name}", halal.alternative)}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      <CheckBox checked={checked} />
    </Pressable>
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
  const writingDirection = isRTL ? "rtl" : "ltr";
  const metaItems = formatStepMetaItems(item, measurementSystem, minuteLabel);
  const tips = item.tips?.filter((tip) => tip.trim()) ?? [];

  return (
    <View style={styles.stepCard}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{item.order || index + 1}</Text>
      </View>
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { writingDirection }]}>
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
        <Text style={[styles.stepText, { writingDirection }]}>{item.text}</Text>
        {tips.length ? (
          <View style={styles.stepTipSection}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={onToggleTips}
              style={styles.stepTipToggle}
            >
              <Feather name="zap" size={13} color={colors.primaryDark} />
              <Text style={styles.stepTipToggleText}>{tipLabel}</Text>
              <Feather name={expanded ? "chevron-up" : "chevron-down"} size={15} color={colors.primaryDark} />
            </Pressable>
            {expanded ? (
              <View style={styles.stepTipBlock}>
                {tips.map((tip, tipIndex) => (
                  <Text key={`${tip}-${tipIndex}`} style={[styles.stepTipText, { writingDirection }]}>
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

function CookModeCard({
  item,
  index,
  total,
  expanded,
  isRTL,
  measurementSystem,
  eyebrow,
  stepFallbackLabel,
  durationLabel,
  tipLabel,
  minuteLabel,
  backLabel,
  nextLabel,
  doneLabel,
  onToggleTips,
  onBack,
  onNext,
  onDone,
}: {
  item: RecipeStep;
  index: number;
  total: number;
  expanded: boolean;
  isRTL: boolean;
  measurementSystem: MeasurementSystem | null;
  eyebrow: string;
  stepFallbackLabel: string;
  durationLabel: string | null;
  tipLabel: string;
  minuteLabel: string;
  backLabel: string;
  nextLabel: string;
  doneLabel: string;
  onToggleTips: () => void;
  onBack: () => void;
  onNext: () => void;
  onDone: () => void;
}) {
  const writingDirection = isRTL ? "rtl" : "ltr";
  const isLast = index >= total - 1;
  // The duration gets its own timer pill, so leave it out of the plain meta pills.
  const metaItems = formatStepMetaItems({ ...item, duration_minutes: undefined }, measurementSystem, minuteLabel);
  const tips = item.tips?.filter((tip) => tip.trim()) ?? [];

  return (
    <View style={styles.cookCard}>
      <Text style={[styles.cookEyebrow, !isRTL && styles.latinCaps, { writingDirection }]}>{eyebrow}</Text>
      <View style={styles.cookProgressTrack}>
        <View style={[styles.cookProgressFill, { width: `${((index + 1) / total) * 100}%` }]} />
      </View>
      <Text style={[styles.cookTitle, { writingDirection }]}>
        {getSafeStepTitle(item, index, stepFallbackLabel)}
      </Text>
      <Text style={[styles.cookText, { writingDirection }]}>{item.text}</Text>

      {durationLabel || metaItems.length ? (
        <View style={styles.stepMetaWrap}>
          {durationLabel ? (
            <View style={styles.cookTimerPill}>
              <MaterialCommunityIcons name="timer-outline" size={17} color={colors.gold} />
              <Text style={styles.cookTimerText}>{durationLabel}</Text>
            </View>
          ) : null}
          {metaItems.map((meta) => (
            <View key={meta} style={styles.cookMetaPill}>
              <Text style={[styles.cookMetaPillText, { writingDirection }]}>{meta}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {tips.length ? (
        <View style={styles.stepTipSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={onToggleTips}
            style={styles.cookTipToggle}
          >
            <Feather name="zap" size={13} color={colors.gold} />
            <Text style={styles.cookTipToggleText}>{tipLabel}</Text>
            <Feather name={expanded ? "chevron-up" : "chevron-down"} size={15} color={colors.gold} />
          </Pressable>
          {expanded ? (
            <View style={styles.cookTipBlock}>
              {tips.map((tip, tipIndex) => (
                <Text key={`${tip}-${tipIndex}`} style={[styles.cookTipText, { writingDirection }]}>
                  {tip}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.cookActions}>
        {index > 0 ? (
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.cookBackButton}>
            <Text style={styles.cookBackText}>{backLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={isLast ? onDone : onNext} style={styles.cookNextButton}>
          <Text style={styles.cookNextText} numberOfLines={1}>
            {isLast ? doneLabel : nextLabel}
          </Text>
          <Feather
            name={isLast ? "check" : isRTL ? "arrow-left" : "arrow-right"}
            size={18}
            color={colors.deep}
          />
        </Pressable>
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
    color: colors.ink,
    textAlign: "center",
  },
  errorBody: {
    fontSize: 14,
    color: colors.danger,
    textAlign: "center",
  },
  outlineButton: {
    marginTop: 8,
    borderRadius: wasfaRadius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  outlineButtonText: {
    color: colors.ink,
    fontWeight: "800",
  },
  heroSection: {
    height: 250,
    width: "100%",
    maxWidth: 896,
    overflow: "hidden",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    backgroundColor: colors.warm,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroNav: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
  },
  heroButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    ...wasfaShadow.card,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  content: {
    width: "100%",
    maxWidth: 896,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
  },
  headerSection: {
    gap: 12,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cuisinePill: {
    borderRadius: wasfaRadius.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  cuisinePillText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  mealTypePill: {
    borderRadius: wasfaRadius.pill,
    backgroundColor: colors.ctaSoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  mealTypePillText: {
    color: colors.cta,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  recipeTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 36,
    textAlign: "left",
  },
  description: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "left",
  },
  metaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  timePill: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: wasfaRadius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.soft,
    paddingHorizontal: 16,
  },
  timePillText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  servingsStepper: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: wasfaRadius.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  servingsText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
  },
  recalculationText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "left",
  },
  segmentRow: {
    flexDirection: "row",
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.soft,
    paddingHorizontal: 12,
  },
  segmentButtonActive: {
    borderColor: colors.ink,
    backgroundColor: colors.ink,
  },
  segmentText: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  sectionHeader: {
    width: "100%",
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    textAlign: "left",
  },
  ingredientsList: {
    gap: 10,
  },
  ingredientRow: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  ingredientRowChecked: {
    opacity: 0.45,
  },
  ingredientNameBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ingredientTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  ingredientAmount: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "left",
  },
  ingredientName: {
    flexShrink: 1,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "left",
  },
  strikeText: {
    textDecorationLine: "line-through",
  },
  estimatedIngredientBadge: {
    alignSelf: "flex-start",
    borderRadius: wasfaRadius.pill,
    backgroundColor: colors.ctaSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  estimatedIngredientText: {
    color: colors.cta,
    fontSize: 10,
    fontWeight: "800",
  },
  // Letter spacing breaks Arabic letter joining, so caps styling is Latin-only.
  latinCaps: {
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  notePill: {
    alignSelf: "flex-start",
    borderRadius: wasfaRadius.pill,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  notePillText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: "800",
  },
  dislikePill: {
    alignSelf: "flex-start",
    borderRadius: wasfaRadius.pill,
    borderWidth: 1,
    borderColor: colors.cta,
    backgroundColor: colors.ctaSoft,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  dislikePillText: {
    color: colors.cta,
    fontSize: 10,
    fontWeight: "800",
  },
  swapPill: {
    alignSelf: "flex-start",
    borderRadius: wasfaRadius.pill,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  swapPillText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "800",
  },
  flagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  flagAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 2,
  },
  flagActionText: {
    flexShrink: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textDecorationLine: "underline",
    textAlign: "left",
  },
  flagActionTextPrimary: {
    color: colors.primaryDark,
  },
  alertCard: {
    borderRadius: wasfaRadius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.soft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  alertLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  alertText: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "left",
  },
  alertTextDanger: {
    color: colors.danger,
  },
  warningBlock: {
    alignItems: "flex-start",
    gap: 3,
    marginTop: 4,
  },
  warningDetail: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "left",
  },
  warningSuggestion: {
    color: colors.primaryDark,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "left",
  },
  translatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  preferenceHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: -8,
    paddingHorizontal: 4,
  },
  preferenceHintText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "left",
  },
  planSection: {
    gap: 8,
  },
  plannedButton: {
    height: 56,
    borderRadius: wasfaRadius.pill,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primarySoft,
  },
  plannedButtonText: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: "800",
  },
  planNotice: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  macroCard: {
    minHeight: 68,
    flexGrow: 1,
    flexBasis: "30%",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  macroWide: {
    flexBasis: "100%",
    borderColor: colors.ctaSoft,
    backgroundColor: colors.ctaSoft,
  },
  macroValue: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  macroWideValue: {
    color: colors.cta,
    fontSize: 22,
    lineHeight: 28,
  },
  macroLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  stepsList: {
    gap: 10,
  },
  stepCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  stepBadgeText: {
    color: colors.primaryDark,
    fontWeight: "800",
    fontSize: 14,
  },
  stepContent: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  stepTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
    textAlign: "left",
  },
  stepMetaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stepMetaPill: {
    alignSelf: "flex-start",
    borderRadius: wasfaRadius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.soft,
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
    color: colors.ink,
    fontSize: 16,
    lineHeight: 26,
    textAlign: "left",
  },
  stepTipSection: {
    gap: 8,
  },
  stepTipToggle: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: wasfaRadius.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  stepTipToggleText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },
  stepTipBlock: {
    borderRadius: wasfaRadius.sm,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  stepTipText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "left",
  },
  chefTipCard: {
    borderRadius: 24,
    backgroundColor: colors.warm,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    overflow: "hidden",
    padding: 18,
  },
  tipMascot: {
    width: 64,
    height: 100,
  },
  tipBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  tipTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tipTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  tipText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "left",
  },
  cookCard: {
    minHeight: 290,
    borderRadius: wasfaRadius.xl,
    backgroundColor: colors.deep,
    padding: 24,
    gap: 14,
  },
  cookEyebrow: {
    color: colors.onDeepSoft,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "left",
  },
  cookProgressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: colors.onDeepFill,
  },
  cookProgressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  cookTitle: {
    color: colors.onDeep,
    fontSize: 26,
    lineHeight: 33,
    fontWeight: "800",
    textAlign: "left",
  },
  cookText: {
    color: colors.onDeepSoft,
    fontSize: 18,
    lineHeight: 28,
    textAlign: "left",
  },
  cookTimerPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: wasfaRadius.pill,
    backgroundColor: colors.onDeepFill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  cookTimerText: {
    color: colors.onDeep,
    fontSize: 14,
    fontWeight: "800",
  },
  cookMetaPill: {
    alignSelf: "flex-start",
    justifyContent: "center",
    borderRadius: wasfaRadius.pill,
    borderWidth: 1,
    borderColor: colors.onDeepLine,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cookMetaPillText: {
    color: colors.onDeepSoft,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  cookTipToggle: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: wasfaRadius.pill,
    backgroundColor: colors.onDeepFill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  cookTipToggleText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
  },
  cookTipBlock: {
    borderRadius: wasfaRadius.sm,
    backgroundColor: colors.onDeepFill,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  cookTipText: {
    color: colors.onDeep,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "left",
  },
  cookActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: "auto",
    paddingTop: 6,
  },
  cookBackButton: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: wasfaRadius.pill,
    borderWidth: 1.5,
    borderColor: colors.onDeepLine,
    paddingHorizontal: 22,
  },
  cookBackText: {
    color: colors.onDeep,
    fontSize: 16,
    fontWeight: "800",
  },
  cookNextButton: {
    flex: 1,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: wasfaRadius.pill,
    backgroundColor: colors.gold,
    paddingHorizontal: 18,
  },
  cookNextText: {
    flexShrink: 1,
    color: colors.deep,
    fontSize: 16,
    fontWeight: "800",
  },
  cookDots: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: -4,
  },
  cookDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.line,
  },
  cookDotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  emptyStepsText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    paddingVertical: 32,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
