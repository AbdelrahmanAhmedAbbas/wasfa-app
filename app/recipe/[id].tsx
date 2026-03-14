import { LocalizedText as Text } from "@/components/LocalizedText";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { deleteRecipeById, getRecipeById, type RecipeDetail } from "@/lib/recipes/client";
import { addRecipeIngredientsToShoppingList } from "@/lib/shopping/client";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";

function formatIngredient(item: {
  name: string;
  quantity?: string;
  unit?: string;
  notes?: string;
}) {
  const core = [item.quantity, item.unit, item.name].filter(Boolean).join(" ").trim();
  return item.notes ? `${core} (${item.notes})` : core;
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

  const align = isRTL ? "right" : "left";

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
        <ActivityIndicator color={onboardingColors.primary} />
        <Text style={styles.loadingText}>{t("recipeLoading")}</Text>
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.errorTitle, { textAlign: align }]}>{t("recipeNotFound")}</Text>
        <Text style={[styles.errorBody, { textAlign: align }]}>{error ?? t("recipeUnknownError")}</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{t("back")}</Text>
        </Pressable>
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.errorTitle, { textAlign: align }]}>{t("recipeNotFound")}</Text>
        <Text style={[styles.errorBody, { textAlign: align }]}>{error ?? t("recipeUnknownError")}</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{t("back")}</Text>
        </Pressable>
      </View>
    );
  }

  const numItems = recipe.ingredients_json?.length || 0;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false}>

        <View style={styles.imageContainer}>
          <Image
            source={
              recipe.source_thumbnail_url
                ? { uri: recipe.source_thumbnail_url }
                : onboardingImages.mascotTyping
            }
            resizeMode="cover"
            style={styles.heroImage}
          />

          <View style={[styles.topControls, { paddingTop: Math.max(insets.top, 16) }]}>
            <Pressable onPress={() => router.back()} style={styles.iconButton}>
              <FontAwesome name="times" size={24} color="#fff" />
            </Pressable>
            <View style={styles.cartBadge}>
              <FontAwesome name="shopping-cart" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.cartBadgeText}>0</Text>
            </View>
          </View>

          <View style={styles.floatingLogoWrap}>
            <View style={styles.floatingLogo}>
              <Text style={styles.logoTopText}>EatingWell</Text>
            </View>
          </View>
        </View>

        <View style={styles.mainContent}>
          <Text style={styles.authorName}>EatingWell</Text>
          <Text style={[styles.title, { textAlign: "center" }]}>{recipe.title}</Text>

          <View style={styles.actionRow}>
            <Pressable style={styles.actionIconBtn}>
              <FontAwesome name="heart" size={24} color="#5ba845" />
            </Pressable>
            <Pressable style={styles.actionIconBtn} onPress={() => void handleOpenReel()}>
              <FontAwesome name="share-square-o" size={26} color="#000" />
            </Pressable>
            <Pressable style={styles.actionIconBtn} onPress={handleDeleteRecipe}>
              <FontAwesome name="trash-o" size={24} color="#000" />
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Active time</Text>
              <Text style={styles.statValue}>{recipe.prep_minutes || "-"} min</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total time</Text>
              <Text style={styles.statValue}>{recipe.prep_minutes || recipe.cook_minutes ? `${(recipe.prep_minutes || 0) + (recipe.cook_minutes || 0)} min` : "-"}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Servings</Text>
              <Text style={styles.statValue}>{recipe.servings || "-"}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBoxRelative}>
              <Text style={styles.statLabel}>Calories</Text>
              <Text style={styles.statValue}>-</Text>
              <FontAwesome name="info-circle" size={12} color="#000" style={styles.infoIcon} />
            </View>
          </View>

          {recipe.description ? (
            <Text style={[styles.description, { textAlign: align }]}>{recipe.description}</Text>
          ) : null}

          <View style={styles.sectionDivider} />

          <Text style={[styles.sectionTitle, { textAlign: align }]}>Ingredients</Text>
          {recipe.ingredients_json.map((item, index) => (
            <Text key={`ing-${index}`} style={[styles.rowText, { textAlign: align }]}>
              {`• ${formatIngredient(item)}`}
            </Text>
          ))}

          <View style={styles.sectionDivider} />

          <Text style={[styles.sectionTitle, { textAlign: align }]}>Steps</Text>
          {recipe.steps_json
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((item, index) => (
              <View key={`step-${index}`} style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{item.order || index + 1}</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={[styles.stepText, { textAlign: align }]}>{item.text}</Text>
                  {typeof item.duration_minutes === "number" ? (
                    <Text style={[styles.stepMeta, { textAlign: align }]}>
                      ~{item.duration_minutes} min
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
        </View>

        {/* Extra space at bottom for the fixed button */}
        <View style={{ height: 100 }} />

      </ScrollView>

      {/* Fixed Bottom Button View */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable
          style={[styles.mainButton, working && styles.disabledButton]}
          onPress={() => void handleAddToShoppingList()}
          disabled={working}
        >
          {working ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.mainButtonText}>Add {numItems} items to cart</Text>
          )}
        </Pressable>
      </View>

      {toast ? (
        <View style={[styles.toast, { bottom: Math.max(insets.bottom, 20) + 80 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
    backgroundColor: "#fff",
  },
  loadingText: {
    color: onboardingColors.textMuted,
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#8a2626",
  },
  errorBody: {
    fontSize: 14,
    color: "#944343",
  },
  backButton: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: onboardingColors.primaryDark,
    fontWeight: "700",
  },
  imageContainer: {
    width: "100%",
    height: 400,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  topControls: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cartBadge: {
    flexDirection: "row",
    backgroundColor: "#5ba845",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cartBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  floatingLogoWrap: {
    position: "absolute",
    bottom: -24,
    alignSelf: "center",
    zIndex: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2e453e",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  logoTopText: {
    color: "#e8c963",
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
  },
  mainContent: {
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  authorName: {
    textAlign: "center",
    fontSize: 12,
    color: "#6b6b6b",
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1c1c1c",
    lineHeight: 32,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginBottom: 24,
  },
  actionIconBtn: {
    padding: 4,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e8e8e8",
    paddingVertical: 14,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statBoxRelative: {
    flex: 1,
    alignItems: "center",
    position: "relative",
  },
  statLabel: {
    fontSize: 11,
    color: "#6b6b6b",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1c1c1c",
  },
  statDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "#e8e8e8",
  },
  infoIcon: {
    position: "absolute",
    right: 4,
    bottom: 2,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: "#4a4a4a",
    marginBottom: 20,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#e8e8e8",
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1c1c1c",
    marginBottom: 16,
  },
  rowText: {
    fontSize: 15,
    lineHeight: 24,
    color: "#4a4a4a",
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#5ba845",
  },
  stepBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  stepBody: {
    flex: 1,
    paddingTop: 2,
  },
  stepText: {
    fontSize: 15,
    lineHeight: 24,
    color: "#1c1c1c",
  },
  stepMeta: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: "#e8e8e8",
  },
  mainButton: {
    backgroundColor: "#5ba845",
    borderRadius: 16,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  mainButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
  toast: {
    position: "absolute",
    backgroundColor: "#333",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: "center",
  },
  toastText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
