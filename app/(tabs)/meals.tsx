import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  assignRecipeToFolder,
  createRecipeFolder,
  deleteRecipeById,
  listRecipeFolders,
  listRecipes,
  type RecipeFolder,
  type RecipeSummary,
} from "@/lib/recipes/client";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";

export default function MealsScreen() {
  const { isRTL } = useLanguage();
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [folders, setFolders] = useState<RecipeFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | "all" | "uncategorized">("all");
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    if (!silent) setLoading(true);
    try {
      const folderFilter =
        selectedFolderId === "all"
          ? undefined
          : selectedFolderId === "uncategorized"
            ? null
            : selectedFolderId;
      const [data, foldersData] = await Promise.all([
        listRecipes({ folderId: folderFilter }),
        listRecipeFolders(),
      ]);
      setRecipes(data);
      setFolders(foldersData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recipes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFolderId]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const align = isRTL ? "right" : "left";

  const formatTime = (recipe: RecipeSummary) => {
    const prep = typeof recipe.prep_minutes === "number" ? `${recipe.prep_minutes}m prep` : null;
    const cook = typeof recipe.cook_minutes === "number" ? `${recipe.cook_minutes}m cook` : null;
    if (prep && cook) return `${prep} • ${cook}`;
    return prep || cook || "Time estimated by AI";
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      setCreatingFolder(true);
      const folder = await createRecipeFolder(name);
      setFolders((prev) => [...prev, folder]);
      setNewFolderName("");
      setSelectedFolderId(folder.id);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create folder.");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleMoveRecipe = async (recipeId: string, folderId: string | null) => {
    try {
      setRefreshing(true);
      await assignRecipeToFolder(recipeId, folderId);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedRecipeId(null);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to move recipe.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteRecipe = (recipeId: string) => {
    Alert.alert("Delete recipe?", "This removes the recipe from your library.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            const previous = recipes;
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setRecipes((prev) => prev.filter((item) => item.id !== recipeId));
            try {
              await deleteRecipeById(recipeId);
            } catch (e) {
              setRecipes(previous);
              setError(e instanceof Error ? e.message : "Failed to delete recipe.");
            }
          })();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={onboardingColors.primary} />
        <Text style={styles.loadingText}>Loading recipes...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroTextWrap}>
            <Text style={[styles.eyebrow, { textAlign: align }]}>Wasfa Recipes</Text>
            <Text style={[styles.title, { textAlign: align }]}>Your recipe library</Text>
            <Text style={[styles.subtitle, { textAlign: align }]}>
              Imported recipes are auto-saved here after extraction.
            </Text>
          </View>
          <Image source={onboardingImages.mascotReading} style={styles.heroMascot} resizeMode="contain" />
        </View>
      </View>

      <View style={styles.folderFilters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderFiltersInner}>
          <Pressable
            style={[styles.folderChip, selectedFolderId === "all" && styles.folderChipActive]}
            onPress={() => setSelectedFolderId("all")}
          >
            <Text style={[styles.folderChipText, selectedFolderId === "all" && styles.folderChipTextActive]}>All</Text>
          </Pressable>
          <Pressable
            style={[styles.folderChip, selectedFolderId === "uncategorized" && styles.folderChipActive]}
            onPress={() => setSelectedFolderId("uncategorized")}
          >
            <Text
              style={[
                styles.folderChipText,
                selectedFolderId === "uncategorized" && styles.folderChipTextActive,
              ]}
            >
              Uncategorized
            </Text>
          </Pressable>
          {folders.map((folder) => (
            <Pressable
              key={folder.id}
              style={[styles.folderChip, selectedFolderId === folder.id && styles.folderChipActive]}
              onPress={() => setSelectedFolderId(folder.id)}
            >
              <Text
                style={[
                  styles.folderChipText,
                  selectedFolderId === folder.id && styles.folderChipTextActive,
                ]}
              >
                {folder.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.createFolderRow}>
          <TextInput
            value={newFolderName}
            onChangeText={setNewFolderName}
            placeholder="New folder"
            placeholderTextColor={onboardingColors.textPlaceholder}
            style={styles.folderInput}
          />
          <Pressable
            style={[styles.createFolderButton, creatingFolder && styles.refreshButtonDisabled]}
            onPress={() => void handleCreateFolder()}
            disabled={creatingFolder}
          >
            <Text style={styles.createFolderButtonText}>Create</Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <Pressable style={styles.errorCard} onPress={() => void load(true)}>
          <Text style={[styles.errorTitle, { textAlign: align }]}>Couldn&apos;t load recipes</Text>
          <Text style={[styles.errorBody, { textAlign: align }]}>{error}</Text>
          <Text style={[styles.retryText, { textAlign: align }]}>Tap to retry</Text>
        </Pressable>
      ) : null}

      {recipes.length === 0 ? (
        <View style={styles.emptyCard}>
          <Image source={onboardingImages.mascotReading} resizeMode="contain" style={styles.emptyImage} />
          <Text style={[styles.emptyTitle, { textAlign: align }]}>No recipes yet</Text>
          <Text style={[styles.emptyBody, { textAlign: align }]}>
            Import a TikTok or Instagram recipe from Home and it will appear here.
          </Text>
        </View>
      ) : (
        recipes.map((recipe) => (
          <View key={recipe.id} style={styles.recipeCard}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/recipe/[id]",
                  params: { id: recipe.id },
                })
              }
            >
              <Image
                source={
                  recipe.source_thumbnail_url
                    ? { uri: recipe.source_thumbnail_url }
                    : onboardingImages.mascotTyping
                }
                resizeMode="cover"
                style={styles.recipeThumb}
              />
              <Text style={[styles.recipeTitle, { textAlign: align }]}>{recipe.title}</Text>
              {recipe.description ? (
                <Text numberOfLines={2} style={[styles.recipeDescription, { textAlign: align }]}>
                  {recipe.description}
                </Text>
              ) : null}
              <Text style={[styles.recipeMeta, { textAlign: align }]}>
                {formatTime(recipe)}
                {typeof recipe.servings === "number" ? ` • ${recipe.servings} servings` : ""}
              </Text>
            </Pressable>
            <View style={styles.recipeActions}>
              <Pressable
                style={styles.smallActionButton}
                onPress={() =>
                  setExpandedRecipeId((prev) => (prev === recipe.id ? null : recipe.id))
                }
              >
                <Text style={styles.smallActionText}>Move</Text>
              </Pressable>
              <Pressable
                style={[styles.smallActionButton, styles.deleteActionButton]}
                onPress={() => handleDeleteRecipe(recipe.id)}
              >
                <Text style={styles.deleteActionText}>Delete</Text>
              </Pressable>
            </View>
            {expandedRecipeId === recipe.id ? (
              <View style={styles.movePanel}>
                <Text style={[styles.moveTitle, { textAlign: align }]}>Move to folder</Text>
                <View style={styles.moveButtons}>
                  <Pressable
                    style={styles.moveChip}
                    onPress={() => void handleMoveRecipe(recipe.id, null)}
                  >
                    <Text style={styles.moveChipText}>Uncategorized</Text>
                  </Pressable>
                  {folders.map((folder) => (
                    <Pressable
                      key={`${recipe.id}-${folder.id}`}
                      style={styles.moveChip}
                      onPress={() => void handleMoveRecipe(recipe.id, folder.id)}
                    >
                      <Text style={styles.moveChipText}>{folder.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ))
      )}

      <Pressable
        style={[styles.refreshButton, refreshing && styles.refreshButtonDisabled]}
        onPress={() => void load(true)}
        disabled={refreshing}
      >
        {refreshing ? <ActivityIndicator color={onboardingColors.textOnDark} /> : <Text style={styles.refreshText}>Refresh</Text>}
      </Pressable>
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
    paddingBottom: 42,
    gap: 12,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: onboardingColors.backgroundBase,
  },
  loadingText: {
    fontSize: 14,
    color: onboardingColors.textMuted,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    padding: 18,
  },
  heroTop: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  heroTextWrap: {
    flex: 1,
  },
  heroMascot: {
    width: 74,
    height: 74,
  },
  eyebrow: {
    fontSize: 13,
    color: onboardingColors.textMuted,
    fontWeight: "600",
  },
  title: {
    marginTop: 8,
    fontSize: 29,
    fontWeight: "800",
    color: onboardingColors.primaryDark,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 16,
    color: onboardingColors.textSecondary,
    lineHeight: 23,
  },
  folderFilters: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    padding: 10,
    gap: 10,
  },
  folderFiltersInner: {
    gap: 8,
    paddingRight: 20,
  },
  folderChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.cardSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  folderChipActive: {
    backgroundColor: onboardingColors.accent,
    borderColor: onboardingColors.accentBorder,
  },
  folderChipText: {
    color: onboardingColors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  folderChipTextActive: {
    color: onboardingColors.primaryDark,
  },
  createFolderRow: {
    flexDirection: "row",
    gap: 8,
  },
  folderInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.cardSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: onboardingColors.text,
    fontSize: 14,
  },
  createFolderButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: onboardingColors.accentBorder,
    backgroundColor: onboardingColors.primary,
    minWidth: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  createFolderButtonText: {
    color: onboardingColors.textOnDark,
    fontWeight: "700",
    fontSize: 13,
  },
  errorCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2bdbd",
    backgroundColor: "#fff6f6",
    padding: 14,
    gap: 6,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#8a2626",
  },
  errorBody: {
    fontSize: 14,
    color: "#944343",
  },
  retryText: {
    fontSize: 13,
    color: "#8a2626",
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.cardSoft,
    padding: 18,
    alignItems: "center",
  },
  emptyImage: {
    width: 140,
    height: 140,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: onboardingColors.primaryDark,
    marginTop: 6,
  },
  emptyBody: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: onboardingColors.textMuted,
  },
  recipeCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    padding: 14,
    gap: 7,
  },
  recipeThumb: {
    width: "100%",
    height: 150,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: onboardingColors.cardSoft,
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: onboardingColors.text,
  },
  recipeDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: onboardingColors.textSecondary,
  },
  recipeMeta: {
    fontSize: 13,
    color: onboardingColors.primaryAccent,
    fontWeight: "700",
  },
  recipeActions: {
    flexDirection: "row",
    gap: 8,
  },
  smallActionButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: onboardingColors.accentBorder,
    backgroundColor: onboardingColors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallActionText: {
    color: onboardingColors.primaryDark,
    fontWeight: "700",
    fontSize: 12,
  },
  deleteActionButton: {
    borderColor: "#cb9393",
    backgroundColor: "#fff2f2",
  },
  deleteActionText: {
    color: "#8f3737",
    fontWeight: "700",
    fontSize: 12,
  },
  movePanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.cardSoft,
    padding: 10,
    gap: 8,
  },
  moveTitle: {
    fontSize: 13,
    color: onboardingColors.textMuted,
    fontWeight: "700",
  },
  moveButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  moveChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  moveChipText: {
    color: onboardingColors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  refreshButton: {
    borderRadius: 14,
    backgroundColor: onboardingColors.primary,
    borderWidth: 1,
    borderColor: onboardingColors.accentBorder,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  refreshButtonDisabled: {
    opacity: 0.65,
  },
  refreshText: {
    fontSize: 16,
    color: onboardingColors.textOnDark,
    fontWeight: "700",
  },
});
