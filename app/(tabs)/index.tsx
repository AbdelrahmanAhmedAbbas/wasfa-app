import { LocalizedText as Text } from "@/components/LocalizedText";
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  UIManager,
  View
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  createRecipeFolder,
  listRecipeFolders,
  listRecipes,
  type RecipeFolder,
  type RecipeSummary
} from "@/lib/recipes/client";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";

export default function RecipesHomeScreen() {
  const { isRTL, t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [folders, setFolders] = useState<RecipeFolder[]>([]);

  // null = Folders View. string = Recipes inside a specific folder
  const [selectedFolderId, setSelectedFolderId] = useState<string | "all" | "uncategorized" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
        selectedFolderId === "all" || selectedFolderId === null
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

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      setCreatingFolder(true);
      const folder = await createRecipeFolder(name);
      setFolders((prev) => [...prev, folder]);
      setNewFolderName("");
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create folder.");
    } finally {
      setCreatingFolder(false);
    }
  };

  const currentFolderName = selectedFolderId === "all"
    ? t("allRecipes")
    : selectedFolderId === "uncategorized"
      ? t("uncategorized")
      : folders.find(f => f.id === selectedFolderId)?.name || t("foldersTitle");

  // Filter recipes based on search
  const filteredRecipes = recipes.filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <Pressable
          style={styles.headerButtonLeft}
          onPress={() => setSelectedFolderId(null)}
        >
          <FontAwesome name="folder" size={16} color={onboardingColors.text} style={{ marginRight: 6 }} />
          <Text style={styles.headerButtonText}>{t("foldersTitle")}</Text>
        </Pressable>

        <View style={styles.headerRight}>
          <Pressable style={styles.iconButton}>
            <FontAwesome name="magic" size={18} color={onboardingColors.text} />
          </Pressable>
          <Pressable style={styles.iconButton}>
            <FontAwesome name="cog" size={18} color={onboardingColors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title and Sort */}
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>
            {selectedFolderId === null ? t("foldersTitle") : currentFolderName}
          </Text>
          {selectedFolderId !== null && (
            <Pressable style={styles.sortButton}>
              <Text style={styles.sortText}>{t("sortLabel")}</Text>
              <FontAwesome name="filter" size={16} color={onboardingColors.text} />
            </Pressable>
          )}
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, isRTL && styles.searchContainerRTL]}>
          <FontAwesome name="search" size={16} color={onboardingColors.primary} style={[styles.searchIcon, isRTL && styles.searchIconRTL]} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={selectedFolderId === null ? t("searchFoldersPlaceholder") : t("searchRecipesPlaceholder")}
            placeholderTextColor={onboardingColors.textPlaceholder}
            style={[styles.searchInput, isRTL && styles.searchInputRTL]}
          />
        </View>

        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{t("unlockRecipesBanner")}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.bannerSubtext}>9 {t("importsRemaining")}</Text>
            <View style={styles.bannerBadge}>
              <FontAwesome name="moon-o" size={14} color="#556b2f" style={{ marginRight: 4 }} />
              <Text style={styles.badgeText}>∞</Text>
            </View>
          </View>
        </View>

        {/* How-to tips */}
        <View style={styles.tipsRow}>
          <Text style={styles.tipsText}>{t("howToTips")}</Text>
          <View style={styles.tutorialDropdown}>
            <FontAwesome name="info-circle" size={16} color={onboardingColors.text} style={{ marginRight: 6 }} />
            <Text style={styles.tutorialText}>{t("tutorial")}</Text>
            <FontAwesome name="chevron-down" size={12} color={onboardingColors.text} style={{ marginLeft: 6 }} />
          </View>
        </View>

        {error ? (
          <Pressable style={styles.errorCard} onPress={() => void load(true)}>
            <Text style={[styles.errorBody, { textAlign: align }]}>{error}</Text>
            <Text style={[styles.retryText, { textAlign: align }]}>{t("tapToRetry")}</Text>
          </Pressable>
        ) : null}

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator color={onboardingColors.primary} />
          </View>
        ) : selectedFolderId === null ? (
          /* Render Folders Grid */
          <View style={styles.folderGrid}>
            <View style={styles.folderRow}>
              <Pressable style={styles.folderCard} onPress={() => setSelectedFolderId("all")}>
                <FontAwesome name="folder-open" size={32} color={onboardingColors.primary} style={styles.folderCardIcon} />
                <View>
                  <Text style={styles.folderCardTitle}>{t("allRecipes")}</Text>
                </View>
              </Pressable>
              <Pressable style={styles.folderCard} onPress={() => setSelectedFolderId("uncategorized")}>
                <FontAwesome name="folder" size={32} color={onboardingColors.textMuted} style={styles.folderCardIcon} />
                <View>
                  <Text style={styles.folderCardTitle}>{t("uncategorized")}</Text>
                </View>
              </Pressable>
            </View>

            {folders.map(folder => (
              <Pressable key={folder.id} style={styles.folderCardFull} onPress={() => setSelectedFolderId(folder.id)}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <FontAwesome name="folder" size={24} color={onboardingColors.primary} style={{ marginRight: 12 }} />
                  <Text style={styles.folderCardTitle}>{folder.name}</Text>
                </View>
                <FontAwesome name="chevron-right" size={14} color={onboardingColors.textMuted} />
              </Pressable>
            ))}

            {/* Create Folder Row */}
            <View style={styles.createFolderContainer}>
              <TextInput
                value={newFolderName}
                onChangeText={setNewFolderName}
                placeholder={t("newFolderPlaceholder")}
                placeholderTextColor={onboardingColors.textPlaceholder}
                style={styles.newFolderInput}
              />
              <Pressable
                style={[styles.createFolderButton, creatingFolder && { opacity: 0.6 }]}
                onPress={() => void handleCreateFolder()}
                disabled={creatingFolder}
              >
                <Text style={styles.createFolderBtnText}>{t("create")}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* Render Recipes List/Grid */
          <View style={styles.recipesGrid}>
            {filteredRecipes.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={[styles.emptyTitle, { textAlign: align }]}>{t("noRecipesFound")}</Text>
                <Text style={[styles.emptyBody, { textAlign: align }]}>
                  {t("noRecipesHint")}
                </Text>
              </View>
            ) : (
              filteredRecipes.map((recipe) => (
                <Pressable
                  key={recipe.id}
                  style={styles.recipeCardImage}
                  onPress={() => router.push({ pathname: "/recipe/[id]", params: { id: recipe.id } })}
                >
                  <Image
                    source={recipe.source_thumbnail_url ? { uri: recipe.source_thumbnail_url } : onboardingImages.mascotTyping}
                    style={styles.recipeImage}
                    resizeMode="cover"
                  />
                  <View style={styles.recipeOverlay}>
                    <View>
                      <Text style={styles.recipeTitleText} numberOfLines={2}>
                        {recipe.title}
                      </Text>
                    </View>
                    <View style={styles.recipeMetaPill}>
                      <FontAwesome name="users" size={12} color="#000" style={{ marginRight: 4 }} />
                      <Text style={styles.recipePillText}>
                        {typeof recipe.servings === "number" ? recipe.servings : "-"}
                      </Text>
                      <FontAwesome name="clock-o" size={12} color="#000" style={{ marginLeft: 10, marginRight: 4 }} />
                      <Text style={styles.recipePillText}>
                        {recipe.prep_minutes || recipe.cook_minutes ? `${(recipe.prep_minutes || 0) + (recipe.cook_minutes || 0)} min` : "-"}
                      </Text>
                      <FontAwesome name="shopping-cart" size={12} color="#000" style={{ marginLeft: 10 }} />
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fffaf6", // lighter background from the image
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerButtonLeft: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e0dcd6",
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: onboardingColors.text,
  },
  headerRight: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e0dcd6",
  },
  content: {
    padding: 16,
    paddingBottom: 100, // Make room for floating tab bar
    gap: 16,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: onboardingColors.primaryDark,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  sortText: {
    fontSize: 16,
    fontWeight: "600",
    color: onboardingColors.text,
    marginRight: 6,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0dcd6",
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: onboardingColors.text,
  },
  searchContainerRTL: {
    flexDirection: "row-reverse",
  },
  searchIconRTL: {
    marginRight: 0,
    marginLeft: 10,
  },
  searchInputRTL: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  banner: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0dcd6",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4a6b4a", // dark green text
  },
  bannerSubtext: {
    fontSize: 9,
    color: "#ff6b6b", // slightly red
    marginRight: 10,
  },
  bannerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f0e1",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#556b2f",
  },
  tipsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  tipsText: {
    fontSize: 15,
    fontWeight: "600",
    color: onboardingColors.text,
  },
  tutorialDropdown: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0dcd6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tutorialText: {
    fontSize: 14,
    fontWeight: "600",
    color: onboardingColors.text,
  },
  centerContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  folderGrid: {
    gap: 12,
  },
  folderRow: {
    flexDirection: "row",
    gap: 12,
  },
  folderCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0dcd6",
    borderRadius: 20,
    padding: 20,
    justifyContent: "space-between",
    height: 120,
  },
  folderCardFull: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0dcd6",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "space-between",
  },
  folderCardIcon: {
    marginBottom: 8,
  },
  folderCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: onboardingColors.text,
  },
  folderCardCount: {
    fontSize: 13,
    color: onboardingColors.textMuted,
    marginTop: 4,
  },
  createFolderContainer: {
    flexDirection: "row",
    marginTop: 10,
    gap: 10,
  },
  newFolderInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0dcd6",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    fontSize: 15,
  },
  createFolderButton: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: onboardingColors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    height: 48,
  },
  createFolderBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  recipesGrid: {
    gap: 16,
  },
  recipeCardImage: {
    height: 260,
    borderRadius: 24,
    overflow: "hidden",
  },
  recipeImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  recipeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 16,
    justifyContent: "space-between",
  },
  recipeTitleText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  recipeMetaPill: {
    backgroundColor: "rgba(255,255,255,0.9)",
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recipePillText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0dcd6",
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: onboardingColors.primaryDark,
  },
  emptyBody: {
    fontSize: 14,
    color: onboardingColors.textMuted,
    marginTop: 6,
    textAlign: "center",
  },
  errorCard: {
    backgroundColor: "#fff6f6",
    borderWidth: 1,
    borderColor: "#e2bdbd",
    padding: 12,
    borderRadius: 12,
  },
  errorBody: {
    color: "#8a2626",
    fontSize: 14,
  },
  retryText: {
    color: "#8a2626",
    fontWeight: "700",
    fontSize: 14,
    marginTop: 4,
  },
});
