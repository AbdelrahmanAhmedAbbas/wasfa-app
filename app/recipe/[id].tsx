import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { deleteRecipeById, getRecipeById, type RecipeDetail } from "@/lib/recipes/client";
import { addRecipeIngredientsToShoppingList } from "@/lib/shopping/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
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
  const { isRTL } = useLanguage();
  const params = useLocalSearchParams<{ id?: string }>();
  const recipeId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!recipeId) {
      setError("Missing recipe id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await getRecipeById(recipeId);
      if (!row) {
        setError("Recipe not found.");
        setRecipe(null);
      } else {
        setRecipe(row);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recipe.");
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

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
    Alert.alert("Delete recipe?", "This will remove the recipe from your library.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              setWorking(true);
              await deleteRecipeById(recipe.id);
              router.replace("/(tabs)/meals");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to delete recipe.");
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
      showToast("Ingredients added to shopping list.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add ingredients.");
    } finally {
      setWorking(false);
    }
  };

  const handleOpenReel = async () => {
    if (!recipe?.source_reel_url) return;
    try {
      await Linking.openURL(recipe.source_reel_url);
    } catch {
      setError("Could not open source link.");
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={onboardingColors.primary} />
        <Text style={styles.loadingText}>Loading recipe...</Text>
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.errorTitle, { textAlign: align }]}>Couldn&apos;t open recipe</Text>
        <Text style={[styles.errorBody, { textAlign: align }]}>{error ?? "Unknown error"}</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.headerBack} onPress={() => router.back()}>
        <Text style={styles.headerBackText}>Back</Text>
      </Pressable>

      <View style={styles.heroCard}>
        <View style={styles.heroImageWrap}>
          <Image
            source={
              recipe.source_thumbnail_url
                ? { uri: recipe.source_thumbnail_url }
                : onboardingImages.mascotTyping
            }
            resizeMode="cover"
            style={styles.heroImage}
          />
        </View>
        <Text style={[styles.title, { textAlign: align }]}>{recipe.title}</Text>
        {recipe.description ? (
          <Text style={[styles.description, { textAlign: align }]}>{recipe.description}</Text>
        ) : null}
        <Text style={[styles.meta, { textAlign: align }]}>
          {typeof recipe.servings === "number" ? `${recipe.servings} servings` : "Servings estimated"}
          {typeof recipe.prep_minutes === "number" ? ` • ${recipe.prep_minutes}m prep` : ""}
          {typeof recipe.cook_minutes === "number" ? ` • ${recipe.cook_minutes}m cook` : ""}
        </Text>
        <View style={styles.heroActions}>
          {recipe.source_reel_url ? (
            <Pressable style={styles.smallButton} onPress={() => void handleOpenReel()}>
              <Text style={styles.smallButtonText}>Open Reel</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.smallButton, working && styles.disabledButton]}
            onPress={() => void handleAddToShoppingList()}
            disabled={working}
          >
            <Text style={styles.smallButtonText}>Add To Shopping List</Text>
          </Pressable>
          <Pressable
            style={[styles.smallButton, styles.deleteButton, working && styles.disabledButton]}
            onPress={handleDeleteRecipe}
            disabled={working}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, { textAlign: align }]}>Ingredients</Text>
        {recipe.ingredients_json.map((item, index) => (
          <Text key={`ing-${index}`} style={[styles.rowText, { textAlign: align }]}>
            {`\u2022 ${formatIngredient(item)}`}
          </Text>
        ))}
      </View>

      <View style={styles.sectionCard}>
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
      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: onboardingColors.backgroundBase,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
    backgroundColor: onboardingColors.backgroundBase,
  },
  loadingText: {
    color: onboardingColors.textMuted,
    fontSize: 14,
  },
  headerBack: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
  },
  headerBackText: {
    color: onboardingColors.primaryDark,
    fontWeight: "700",
    fontSize: 14,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    padding: 16,
    gap: 8,
  },
  heroImageWrap: {
    width: "100%",
    height: 190,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 4,
    backgroundColor: onboardingColors.cardSoft,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: onboardingColors.primaryDark,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: onboardingColors.textSecondary,
  },
  meta: {
    fontSize: 13,
    color: onboardingColors.primaryAccent,
    fontWeight: "700",
  },
  heroActions: {
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  smallButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: onboardingColors.accentBorder,
    backgroundColor: onboardingColors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: onboardingColors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },
  deleteButton: {
    borderColor: "#c87070",
    backgroundColor: "#fff1f1",
  },
  deleteButtonText: {
    color: "#973636",
    fontSize: 13,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.55,
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: onboardingColors.text,
  },
  rowText: {
    fontSize: 15,
    lineHeight: 22,
    color: onboardingColors.textSecondary,
  },
  stepRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: onboardingColors.primary,
  },
  stepBadgeText: {
    color: onboardingColors.textOnDark,
    fontWeight: "700",
    fontSize: 13,
  },
  stepBody: {
    flex: 1,
    gap: 3,
    paddingTop: 2,
  },
  stepText: {
    fontSize: 15,
    lineHeight: 22,
    color: onboardingColors.text,
  },
  stepMeta: {
    fontSize: 12,
    color: onboardingColors.textMuted,
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
  toast: {
    borderRadius: 12,
    backgroundColor: onboardingColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "center",
  },
  toastText: {
    color: onboardingColors.textOnDark,
    fontWeight: "700",
    fontSize: 13,
  },
});
