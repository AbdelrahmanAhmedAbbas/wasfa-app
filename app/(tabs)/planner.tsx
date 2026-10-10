import Feather from "@expo/vector-icons/Feather";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { track } from "@/lib/analytics/posthog";
import { LocalizedText as Text } from "@/components/LocalizedText";
import { ScreenTransition } from "@/components/navigation/ScreenTransition";
import { BottomDrawer } from "@/components/ui/BottomDrawer";
import { getLocalizedRecipeSummary } from "@/lib/home/home-screen";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { reportError } from "@/lib/monitoring/sentry";
import { planRecipe, unplanRecipe } from "@/lib/planner/actions";
import {
  formatDayOfMonth,
  formatWeekRange,
  formatWeekdayLong,
  formatWeekdayShort,
} from "@/lib/planner/format";
import {
  ANY_DAY,
  countPlannedMeals,
  getPlanDay,
  getWeekDates,
  moveRecipeInPlan,
  pruneMealPlan,
  toDateKey,
} from "@/lib/planner/plan";
import { useMealPlan } from "@/lib/planner/storage";
import { useRecipeDrag, type DraggedRecipe } from "@/lib/planner/useRecipeDrag";
import { listRecipes, type RecipeSummary } from "@/lib/recipes/client";
import { toArabicIndicDigits } from "@/lib/recipes/numerals";
import { onboardingImages } from "@/lib/theme/onboarding";
import {
  TAB_BAR_BOTTOM_GAP,
  TAB_BAR_HEIGHT,
  getTabBarClearance,
  wasfaColors,
  wasfaShadow,
} from "@/lib/theme/wasfa";

type PlannerDay = {
  key: string;
  label: string;
  date: Date | null;
  isToday: boolean;
  recipeIds: string[];
};

// Shorter than the default so picking a recipe up feels immediate, still long
// enough that a scroll never starts a drag.
const DRAG_HOLD_MS = 280;

function getRecipeImage(recipe: RecipeSummary): ImageSourcePropType {
  return recipe.source_thumbnail_url
    ? { uri: recipe.source_thumbnail_url }
    : onboardingImages.demoKabsaSocial;
}

export default function PlannerScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { plan, loaded: planLoaded, updatePlan } = useMealPlan();

  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [recipesLoaded, setRecipesLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickerDayKey, setPickerDayKey] = useState<string | null>(null);

  const todayKey = toDateKey(new Date());
  const [openDayKey, setOpenDayKey] = useState<string | null>(todayKey);

  const week = useMemo(() => {
    const [year, month, day] = todayKey.split("-").map(Number);
    return getWeekDates(new Date(year, month - 1, day));
  }, [todayKey]);
  const weekKeys = useMemo(() => week.map(toDateKey), [week]);

  // Reload on focus so recipes imported or deleted elsewhere show up here.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      listRecipes()
        .then((data) => {
          if (!isActive) return;
          setRecipes(data);
          setRecipesLoaded(true);
          setNotice(null);
        })
        .catch((error) => {
          reportError(error, { feature: "planner_load" });
          if (isActive) setNotice(t("plannerLoadError"));
        });

      return () => {
        isActive = false;
      };
    }, [t])
  );

  // Planned recipes that were deleted from the library drop out of the plan.
  // An empty library is never used to prune: it can also mean an expired
  // session, and that must not wipe the plan.
  useEffect(() => {
    if (!planLoaded || !recipesLoaded || recipes.length === 0) return;
    const pruned = pruneMealPlan(
      plan,
      recipes.map((recipe) => recipe.id)
    );
    if (JSON.stringify(pruned) !== JSON.stringify(plan)) {
      void updatePlan((current) =>
        pruneMealPlan(
          current,
          recipes.map((recipe) => recipe.id)
        )
      );
    }
  }, [plan, planLoaded, recipes, recipesLoaded, updatePlan]);

  const recipesById = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);
  const localizeDigits = (value: string) => (language === "ar" ? toArabicIndicDigits(value) : value);

  const days: PlannerDay[] = [
    { key: ANY_DAY, label: t("plannerAnyDay"), date: null, isToday: false, recipeIds: plan.any },
    ...week.map((date, index) => ({
      key: weekKeys[index],
      label: formatWeekdayLong(date, language),
      date,
      isToday: weekKeys[index] === todayKey,
      recipeIds: getPlanDay(plan, weekKeys[index]),
    })),
  ];

  // Until the library has loaded, fall back to the raw plan size.
  const plannedMealCount = recipesLoaded
    ? days.reduce((total, day) => total + day.recipeIds.filter((id) => recipesById.has(id)).length, 0)
    : countPlannedMeals(plan, weekKeys);
  const mealsLabel = localizeDigits(
    t("plannerMealsPlanned").replace("{count}", String(plannedMealCount))
  );

  const getMealMeta = (recipe: RecipeSummary) => {
    const totalMinutes = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0);
    return localizeDigits(
      [
        totalMinutes > 0 ? `${totalMinutes} ${t("homeMinuteShort")}` : null,
        recipe.servings ? t("plannerPeople").replace("{count}", String(recipe.servings)) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    );
  };

  const toggleDay = (dayKey: string) => {
    setOpenDayKey((current) => (current === dayKey ? null : dayKey));
  };

  const handleAddMeal = async (dayKey: string, recipeId: string) => {
    setPickerDayKey(null);
    setOpenDayKey(dayKey);
    const result = await planRecipe(updatePlan, dayKey, recipeId, "picker");
    setNotice(result.grocerySynced ? null : t("plannerGroceryNotSynced"));
  };

  const handleRemoveMeal = async (dayKey: string, recipeId: string) => {
    const result = await unplanRecipe(updatePlan, dayKey, recipeId);
    setNotice(result.grocerySynced ? null : t("plannerGroceryNotSynced"));
  };

  // A recipe from the shelf is planned on the day it lands on; one dragged out
  // of a day moves, which leaves the grocery list as it is.
  const handleDrop = async (item: DraggedRecipe, dayKey: string) => {
    setOpenDayKey(dayKey);
    const { recipeId, fromDayKey } = item;
    if (fromDayKey === null) {
      if (getPlanDay(plan, dayKey).includes(recipeId)) return;
      const result = await planRecipe(updatePlan, dayKey, recipeId, "drag");
      setNotice(result.grocerySynced ? null : t("plannerGroceryNotSynced"));
      return;
    }
    await updatePlan((current) => moveRecipeInPlan(current, fromDayKey, dayKey, recipeId));
    if (fromDayKey !== dayKey) track("planned_recipe_moved");
  };

  const drag = useRecipeDrag({
    onDrop: (item, dayKey) => void handleDrop(item, dayKey),
    edgeTop: insets.top,
    edgeBottom: TAB_BAR_HEIGHT + Math.max(insets.bottom, TAB_BAR_BOTTOM_GAP),
  });
  const draggedRecipe = drag.dragged ? recipesById.get(drag.dragged.recipeId) : undefined;
  const openRecipe = (recipeId: string) =>
    router.push({ pathname: "/recipe/[id]", params: { id: recipeId } });

  const pickerRecipes = pickerDayKey
    ? recipes.filter((recipe) => !getPlanDay(plan, pickerDayKey).includes(recipe.id))
    : [];

  return (
    <ScreenTransition>
      <View ref={drag.rootRef} collapsable={false} style={styles.screen} {...drag.panHandlers}>
        <ScrollView
          ref={drag.scrollRef}
          style={styles.screen}
          contentContainerStyle={{
            paddingTop: insets.top + 18,
            paddingBottom: getTabBarClearance(insets.bottom),
          }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!drag.dragged}
          {...drag.scrollProps}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t("plannerTitle")}</Text>
            <Text style={styles.subtitle}>{`${formatWeekRange(week, language)} · ${mealsLabel}`}</Text>
          </View>

          <View style={styles.weekStrip}>
            {week.map((date, index) => {
              const hasMeals = getPlanDay(plan, weekKeys[index]).length > 0;
              const isDropTarget = drag.hoverDayKey === weekKeys[index];
              return (
                <Pressable
                  key={weekKeys[index]}
                  ref={drag.registerTarget(`strip:${weekKeys[index]}`, weekKeys[index])}
                  accessibilityRole="button"
                  accessibilityLabel={formatWeekdayLong(date, language)}
                  style={styles.weekDay}
                  onPress={() => toggleDay(weekKeys[index])}
                >
                  <Text numberOfLines={1} style={styles.weekDayLabel}>
                    {formatWeekdayShort(date, language)}
                  </Text>
                  <View
                    style={[
                      styles.weekDot,
                      hasMeals && styles.weekDotFilled,
                      isDropTarget && styles.weekDotDropTarget,
                    ]}
                  >
                    <Text
                      style={[
                        styles.weekDotText,
                        (hasMeals || isDropTarget) && styles.weekDotTextFilled,
                      ]}
                    >
                      {formatDayOfMonth(date, language)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {planLoaded && recipes.length > 0 ? (
            <View style={styles.shelf}>
              <View style={styles.shelfHeader}>
                <Text style={styles.shelfTitle}>{t("plannerShelfTitle")}</Text>
                <Text numberOfLines={1} style={styles.shelfHint}>
                  {t("plannerShelfHint")}
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEnabled={!drag.dragged}
                contentContainerStyle={styles.shelfList}
              >
                {recipes.map((recipe) => {
                  const isDragged =
                    drag.dragged?.fromDayKey === null && drag.dragged.recipeId === recipe.id;
                  return (
                    <Pressable
                      key={recipe.id}
                      accessibilityHint={t("plannerShelfHint")}
                      style={[styles.shelfItem, isDragged && styles.dragSource]}
                      delayLongPress={DRAG_HOLD_MS}
                      onPress={() => openRecipe(recipe.id)}
                      onLongPress={(event) =>
                        drag.startDrag({ recipeId: recipe.id, fromDayKey: null }, event)
                      }
                      onPressOut={drag.releaseIfUnclaimed}
                    >
                      <Image source={getRecipeImage(recipe)} style={styles.shelfImage} />
                      <Text numberOfLines={2} style={styles.shelfItemTitle}>
                        {getLocalizedRecipeSummary(recipe, language).title}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {notice ? (
            <Pressable style={styles.notice} onPress={() => setNotice(null)}>
              <Text style={styles.noticeText}>{notice}</Text>
            </Pressable>
          ) : null}

          {!planLoaded ? (
            <ActivityIndicator style={styles.loading} color={wasfaColors.primary} />
          ) : (
            <View style={styles.dayList}>
              {days.map((day) => {
                const isOpen = openDayKey === day.key;
                const meals = day.recipeIds
                  .map((recipeId) => recipesById.get(recipeId))
                  .filter((recipe): recipe is RecipeSummary => !!recipe);
                const tint = day.isToday ? "#FFFFFF" : wasfaColors.ink;
                const isDropTarget = drag.hoverDayKey === day.key;

                return (
                  <View
                    key={day.key}
                    ref={drag.registerTarget(`card:${day.key}`, day.key)}
                    collapsable={false}
                    style={[
                      styles.dayCard,
                      day.isToday && styles.dayCardToday,
                      isDropTarget && styles.dayCardDropTarget,
                      isDropTarget && day.isToday && styles.dayCardTodayDropTarget,
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      style={styles.dayHeader}
                      onPress={() => toggleDay(day.key)}
                    >
                      <Text style={[styles.dayLabel, { color: tint }]}>{day.label}</Text>
                      {day.isToday ? (
                        <View style={styles.todayBadge}>
                          <Text style={styles.todayBadgeText}>{t("plannerToday")}</Text>
                        </View>
                      ) : null}
                      <View style={styles.dayHeaderSpacer} />
                      {!isOpen && meals.length > 0 ? (
                        <View style={styles.thumbStack}>
                          {meals.map((recipe) => (
                            <Image key={recipe.id} source={getRecipeImage(recipe)} style={styles.thumb} />
                          ))}
                        </View>
                      ) : null}
                      <Feather
                        name={isOpen ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={tint}
                        style={styles.dayChevron}
                      />
                    </Pressable>

                    {isOpen ? (
                      <View style={styles.dayBody}>
                        {meals.map((recipe) => {
                          const meta = getMealMeta(recipe);
                          const isDragged =
                            drag.dragged?.fromDayKey === day.key && drag.dragged.recipeId === recipe.id;

                          return (
                            <View
                              key={recipe.id}
                              style={[
                                styles.mealRow,
                                day.isToday && styles.mealRowToday,
                                isDragged && styles.dragSource,
                              ]}
                            >
                              <Pressable
                                style={styles.mealMain}
                                delayLongPress={DRAG_HOLD_MS}
                                onPress={() => openRecipe(recipe.id)}
                                onLongPress={(event) =>
                                  drag.startDrag({ recipeId: recipe.id, fromDayKey: day.key }, event)
                                }
                                onPressOut={drag.releaseIfUnclaimed}
                              >
                                <Image source={getRecipeImage(recipe)} style={styles.mealImage} />
                                <View style={styles.mealCopy}>
                                  <Text numberOfLines={2} style={[styles.mealTitle, { color: tint }]}>
                                    {getLocalizedRecipeSummary(recipe, language).title}
                                  </Text>
                                  {meta ? (
                                    <Text style={[styles.mealMeta, { color: tint }]}>{meta}</Text>
                                  ) : null}
                                </View>
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t("plannerRemoveMeal")}
                                hitSlop={8}
                                style={styles.mealRemove}
                                onPress={() => void handleRemoveMeal(day.key, recipe.id)}
                              >
                                <Feather name="x" size={16} color={tint} style={styles.dayChevron} />
                              </Pressable>
                            </View>
                          );
                        })}

                        <Pressable
                          accessibilityRole="button"
                          style={[styles.addMeal, day.isToday && styles.addMealToday]}
                          onPress={() => setPickerDayKey(day.key)}
                        >
                          <Feather name="plus" size={14} color={tint} />
                          <Text style={[styles.addMealText, { color: tint }]}>{t("plannerAddMeal")}</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {draggedRecipe ? (
          <Animated.View pointerEvents="none" style={[styles.ghostLayer, drag.ghostStyle]}>
            <View style={styles.ghost}>
              <Image source={getRecipeImage(draggedRecipe)} style={styles.ghostImage} />
              <Text numberOfLines={1} style={styles.ghostTitle}>
                {getLocalizedRecipeSummary(draggedRecipe, language).title}
              </Text>
            </View>
          </Animated.View>
        ) : null}
      </View>

      <BottomDrawer
        visible={pickerDayKey !== null}
        onClose={() => setPickerDayKey(null)}
        title={t("plannerPickRecipe")}
        showCloseButton
      >
        {pickerRecipes.length === 0 ? (
          <Text style={styles.pickerEmpty}>
            {recipes.length === 0 ? t("plannerNoRecipes") : t("plannerAllAdded")}
          </Text>
        ) : (
          <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
            {pickerRecipes.map((recipe) => {
              const meta = getMealMeta(recipe);
              return (
                <Pressable
                  key={recipe.id}
                  style={styles.pickerRow}
                  onPress={() => {
                    if (pickerDayKey) void handleAddMeal(pickerDayKey, recipe.id);
                  }}
                >
                  <Image source={getRecipeImage(recipe)} style={styles.mealImage} />
                  <View style={styles.mealCopy}>
                    <Text numberOfLines={2} style={styles.mealTitle}>
                      {getLocalizedRecipeSummary(recipe, language).title}
                    </Text>
                    {meta ? <Text style={styles.mealMeta}>{meta}</Text> : null}
                  </View>
                  <Feather name="plus" size={18} color={wasfaColors.cta} />
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </BottomDrawer>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: wasfaColors.surface,
  },
  header: {
    paddingHorizontal: 20,
    gap: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: wasfaColors.ink,
    textAlign: "left",
  },
  subtitle: {
    fontSize: 14,
    color: wasfaColors.muted,
    textAlign: "left",
  },
  weekStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  weekDay: {
    alignItems: "center",
    gap: 6,
  },
  weekDayLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: wasfaColors.muted,
  },
  weekDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDotFilled: {
    borderColor: wasfaColors.primary,
    backgroundColor: wasfaColors.primary,
  },
  weekDotDropTarget: {
    borderColor: wasfaColors.cta,
    backgroundColor: wasfaColors.cta,
    transform: [{ scale: 1.2 }],
  },
  weekDotText: {
    fontSize: 14,
    fontWeight: "800",
    color: wasfaColors.muted,
  },
  weekDotTextFilled: {
    color: "#FFFFFF",
  },
  shelf: {
    paddingBottom: 16,
    gap: 10,
  },
  shelfHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
  },
  shelfTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  shelfHint: {
    flexShrink: 1,
    fontSize: 12,
    color: wasfaColors.muted,
  },
  shelfList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  shelfItem: {
    width: 76,
    gap: 6,
  },
  shelfImage: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: "#D9C8AE",
  },
  shelfItemTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  dragSource: {
    opacity: 0.35,
  },
  ghostLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  // Sits just above the finger so the day underneath stays visible.
  ghost: {
    marginTop: -78,
    width: 220,
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    ...wasfaShadow.floating,
  },
  ghostImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#D9C8AE",
  },
  ghostTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  notice: {
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: wasfaColors.ctaSoft,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  noticeText: {
    fontSize: 13,
    fontWeight: "600",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  loading: {
    marginTop: 40,
  },
  dayList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  dayCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.soft,
    padding: 16,
  },
  dayCardToday: {
    borderColor: wasfaColors.primary,
    backgroundColor: wasfaColors.primary,
  },
  dayCardDropTarget: {
    borderColor: wasfaColors.cta,
    backgroundColor: wasfaColors.ctaSoft,
    transform: [{ scale: 1.02 }],
  },
  dayCardTodayDropTarget: {
    backgroundColor: wasfaColors.primaryDark,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dayLabel: {
    fontSize: 18,
    fontWeight: "800",
  },
  todayBadge: {
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  dayHeaderSpacer: {
    flex: 1,
  },
  dayChevron: {
    opacity: 0.6,
  },
  thumbStack: {
    flexDirection: "row",
    paddingStart: 10,
  },
  thumb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    marginStart: -10,
    backgroundColor: "#D9C8AE",
  },
  dayBody: {
    marginTop: 12,
    gap: 8,
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 18,
    backgroundColor: "rgba(28,43,28,0.07)",
  },
  mealRowToday: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  mealMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mealImage: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#D9C8AE",
  },
  mealCopy: {
    flex: 1,
    gap: 2,
  },
  mealTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  mealMeta: {
    fontSize: 12,
    opacity: 0.7,
    color: wasfaColors.ink,
    textAlign: "left",
  },
  mealRemove: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  addMeal: {
    height: 42,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(28,43,28,0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addMealToday: {
    borderColor: "rgba(255,255,255,0.35)",
  },
  addMealText: {
    fontSize: 13,
    fontWeight: "700",
  },
  pickerList: {
    maxHeight: 380,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  pickerEmpty: {
    paddingVertical: 20,
    fontSize: 15,
    lineHeight: 22,
    color: wasfaColors.muted,
    textAlign: "center",
  },
});
