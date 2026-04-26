import { LocalizedText as Text } from "@/components/LocalizedText";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { deleteRecipeById, getRecipeById, type RecipeDetail } from "@/lib/recipes/client";
import { addRecipeIngredientsToShoppingList } from "@/lib/shopping/client";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";

type RecipeIngredient = RecipeDetail["ingredients_json"][number];

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
  yellow: "#F5A623",
};

function formatDuration(recipe: RecipeDetail) {
  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
  if (total > 0) return `${total} mins`;
  if (recipe.prep_minutes) return `${recipe.prep_minutes} mins`;
  if (recipe.cook_minutes) return `${recipe.cook_minutes} mins`;
  return "-";
}

function getNutritionNumber(recipe: RecipeDetail, key: string) {
  const value = recipe.nutrition_json?.[key];
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function getIngredientAmount(item: RecipeIngredient) {
  return [item.quantity, item.unit || item.size].filter(Boolean).join(" ").trim();
}

function getIngredientNote(item: RecipeIngredient) {
  if (item.notes) return item.notes;
  if (item.preparation) return item.preparation;
  if (item.source === "web_research") return "WEB";
  if (item.source === "video_ocr") return "OCR";
  return null;
}

function getSourceLabel(recipe: RecipeDetail) {
  if (recipe.source_platform && recipe.source_platform !== "unknown") {
    return recipe.source_platform[0].toUpperCase() + recipe.source_platform.slice(1);
  }
  return "Imported";
}

export default function RecipeDetailsScreen() {
  const { isRTL, t } = useLanguage();
  const params = useLocalSearchParams<{ id?: string }>();
  const recipeId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const insets = useSafeAreaInsets();
  const align = isRTL ? "right" : "left";

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

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

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

  const handleAddToShoppingList = async () => {
    if (!recipe) return;
    try {
      setWorking(true);
      await addRecipeIngredientsToShoppingList(recipe);
      showToast(t("ingredientsAdded"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("recipeNotFound"));
    } finally {
      setWorking(false);
    }
  };

  const handleOpenReel = async () => {
    if (!recipe?.source_reel_url) return;
    try {
      await Linking.openURL(recipe.source_reel_url);
    } catch {
      setError(t("couldNotOpenLink"));
    }
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
  const sourceLabel = getSourceLabel(recipe);
  const ingredientCount = recipe.ingredients_json.length;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 96 + insets.bottom }]}
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
              <Pressable onPress={() => void handleOpenReel()} style={styles.glassButton}>
                <FontAwesome name="external-link" size={17} color="#FFFFFF" />
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
                  {recipe.title}
                </Text>
                {recipe.description ? (
                  <Text style={[styles.description, { textAlign: align }]} numberOfLines={4}>
                    {recipe.description}
                  </Text>
                ) : null}
              </View>

              <View style={styles.tagColumn}>
                <View style={styles.mintPill}>
                  <Text style={styles.mintPillText}>{sourceLabel}</Text>
                </View>
                <View style={styles.greenPill}>
                  <Text style={styles.greenPillText}>Recipe</Text>
                </View>
                <View style={styles.ratingRow}>
                  <FontAwesome name="star" size={14} color={colors.yellow} />
                  <Text style={styles.ratingText}>4.8</Text>
                </View>
              </View>
            </View>

            <View style={styles.metaWrap}>
              <MetaPill icon="clock-o" label={formatDuration(recipe)} />
              <MetaPill icon="users" label={`${recipe.servings ?? "-"} Servings`} />
              <MetaPill icon="fire" label={calories ? `${calories} kcal` : "kcal"} />
            </View>

            <Pressable
              style={[styles.primaryButton, working && styles.disabledButton]}
              onPress={() => void handleAddToShoppingList()}
              disabled={working}
            >
              {working ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <FontAwesome name="calendar-plus-o" size={17} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Add to menu</Text>
                </>
              )}
            </Pressable>
          </View>

          <SectionTitle title="Nutrition" />
          <View style={styles.nutritionGrid}>
            <MacroCard label="Protein" value={protein ? `${protein}g` : "-"} tone="green" />
            <MacroCard label="Carbs" value={carbs ? `${carbs}g` : "-"} tone="red" />
            <MacroCard label="Fats" value={fat ? `${fat}g` : "-"} tone="yellow" />
            <MacroCard label="Calories" value={calories ? `${calories}` : "-"} tone="orange" wide />
          </View>

          <SectionTitle title="Ingredients" />
          <View style={styles.ingredientsList}>
            {recipe.ingredients_json.map((item, index) => (
              <IngredientRow key={`${item.name}-${index}`} item={item} />
            ))}
          </View>

          <Pressable
            style={[styles.secondaryAction, working && styles.disabledButton]}
            onPress={() => void handleAddToShoppingList()}
            disabled={working}
          >
            <FontAwesome name="cart-plus" size={18} color={colors.primaryDark} />
            <Text style={styles.secondaryActionText}>Add {ingredientCount} to Grocery List</Text>
          </Pressable>

          <SectionTitle title="Instructions" />
          <View style={styles.stepsList}>
            {recipe.steps_json
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((item, index) => (
                <View key={`step-${index}`} style={styles.stepCard}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{item.order || index + 1}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepText, { textAlign: align }]}>{item.text}</Text>
                    {typeof item.duration_minutes === "number" ? (
                      <Text style={[styles.stepMeta, { textAlign: align }]}>~{item.duration_minutes} min</Text>
                    ) : null}
                  </View>
                </View>
              ))}
          </View>

          <View style={styles.chefTipCard}>
            <Image source={onboardingImages.mascotReading} style={styles.tipMascot} resizeMode="contain" />
            <View style={styles.tipTitleRow}>
              <FontAwesome name="lightbulb-o" size={18} color={colors.primaryDark} />
              <Text style={styles.tipTitle}>Chef's Tip</Text>
            </View>
            <Text style={styles.tipText}>
              Check the quantities before cooking, then add everything to your grocery list in one tap.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomNavigation, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <BottomNavItem icon="home" label="Home" onPress={() => router.replace("/(tabs)")} />
        <BottomNavItem icon="cutlery" label="Recipes" active onPress={() => router.replace("/(tabs)")} />
        <BottomNavItem icon="calendar" label="Plan" onPress={() => router.replace("/(tabs)/planner")} />
        <BottomNavItem icon="shopping-cart" label="Grocery" onPress={() => router.replace("/(tabs)/grocery")} />
        <BottomNavItem icon="user-o" label="Profile" onPress={() => router.replace("/(tabs)/profile")} />
      </View>

      {toast ? (
        <View style={[styles.toast, { bottom: Math.max(insets.bottom, 12) + 76 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
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

function IngredientRow({ item }: { item: RecipeIngredient }) {
  const amount = getIngredientAmount(item);
  const note = getIngredientNote(item);
  return (
    <View style={styles.ingredientRow}>
      <View style={styles.ingredientLeft}>
        <View style={styles.checkbox}>
          <FontAwesome name="check" size={10} color={colors.primary} />
        </View>
        <View style={styles.ingredientNameBlock}>
          <Text style={styles.ingredientName}>{item.name}</Text>
          {note ? (
            <View style={styles.notePill}>
              <Text style={styles.notePillText}>{note.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text style={styles.ingredientAmount}>{amount || "-"}</Text>
    </View>
  );
}

function BottomNavItem({
  icon,
  label,
  active,
  onPress,
}: {
  icon: ComponentProps<typeof FontAwesome>["name"];
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.bottomNavItem, active && styles.bottomNavItemActive]} onPress={onPress}>
      <FontAwesome name={icon} size={18} color={active ? colors.primaryDark : colors.muted} />
      <Text style={[styles.bottomNavText, active && styles.bottomNavTextActive]}>{label}</Text>
    </Pressable>
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
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    color: colors.text,
    fontSize: 14,
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
  primaryButton: {
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
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
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#72796F",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientNameBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  ingredientName: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
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
    borderColor: "rgba(186,26,26,0.2)",
    backgroundColor: colors.warningBg,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  notePillText: {
    color: colors.warningText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  secondaryAction: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: colors.softGreen,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryActionText: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: "700",
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
  bottomNavigation: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 12,
    paddingHorizontal: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 8,
  },
  bottomNavItem: {
    minWidth: 58,
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 8,
  },
  bottomNavItemActive: {
    backgroundColor: colors.softGreen,
  },
  bottomNavText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  bottomNavTextActive: {
    color: colors.primaryDark,
  },
  disabledButton: {
    opacity: 0.6,
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    borderRadius: 999,
    backgroundColor: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
