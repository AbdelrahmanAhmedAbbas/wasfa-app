import { LocalizedText as Text } from "@/components/LocalizedText";
import {
  SocialImportDrawers,
  type ImportPlatform,
} from "@/components/import/SocialImportDrawers";
import { ScreenTransition } from "@/components/navigation/ScreenTransition";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth/AuthProvider";
import {
  getHomeRecipeCards,
  getHomeRecipeListParams,
  getHomeScrollContentStyle,
  getHomeScrollProps,
  getHomeScreenCopy,
  getHomeScreenLayout,
  getLocalizedRecipeSummary,
  matchesRecipeSearch,
} from "@/lib/home/home-screen";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  assignRecipeToFolder,
  createRecipeFolder,
  deleteRecipeFolder,
  listRecipeFolders,
  listRecipes,
  updateRecipeFolder,
  type RecipeFolder,
  type RecipeSummary,
} from "@/lib/recipes/client";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";
import { FolderNameDrawer } from "@/components/folders/FolderNameDrawer";
import { FolderContextMenu } from "@/components/folders/FolderContextMenu";
import { AddToFolderSheet } from "@/components/recipes/AddToFolderSheet";

function getDisplayName(fullName?: string | null, email?: string | null) {
  if (fullName?.trim()) {
    return fullName.trim().split(/\s+/)[0];
  }

  if (email?.trim()) {
    return email.split("@")[0];
  }

  return "";
}

function wrapLtrInlineText(value: string) {
  return /[A-Za-z0-9]/.test(value) ? `\u2066${value}\u2069` : value;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, isRTL, language } = useLanguage();
  const bottomContentPadding = Math.max(insets.bottom + 176, 176);
  const addButtonOffset = Math.max(insets.bottom + 96, 96);

  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [allRecipes, setAllRecipes] = useState<RecipeSummary[]>([]);
  const [folders, setFolders] = useState<RecipeFolder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshingHome, setRefreshingHome] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderDrawerVisible, setFolderDrawerVisible] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<RecipeFolder | null>(null);
  const [contextMenuFolder, setContextMenuFolder] = useState<RecipeFolder | null>(null);
  const [addToFolderRecipe, setAddToFolderRecipe] = useState<RecipeSummary | null>(null);
  const [importDrawerState, setImportDrawerState] = useState<"closed" | "platforms" | "guide">("closed");
  const [selectedImportPlatform, setSelectedImportPlatform] = useState<ImportPlatform | null>(null);

  const loadHomeData = useCallback(async (options?: { showSpinner?: boolean; showRefresh?: boolean }) => {
    const showSpinner = options?.showSpinner ?? false;
    const showRefresh = options?.showRefresh ?? false;

    if (showSpinner) setLoading(true);
    if (showRefresh) setRefreshingHome(true);

    try {
      const selectedRecipeParams = getHomeRecipeListParams(selectedFolderId);
      const folderPromise = listRecipeFolders();
      const allRecipesPromise = listRecipes();
      const selectedRecipesPromise = selectedRecipeParams
        ? listRecipes(selectedRecipeParams)
        : allRecipesPromise;
      const [foldersData, allRecipesData, selectedRecipesData] = await Promise.all([
        folderPromise,
        allRecipesPromise,
        selectedRecipesPromise,
      ]);

      setFolders(foldersData);
      setAllRecipes(allRecipesData);
      setRecipes(selectedRecipesData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("homeLoadFoldersError"));
    } finally {
      if (showSpinner) setLoading(false);
      if (showRefresh) setRefreshingHome(false);
    }
  }, [selectedFolderId, t]);

  useEffect(() => {
    void loadHomeData({ showSpinner: true });
  }, [loadHomeData]);

  const handleRefreshHome = useCallback(() => {
    void loadHomeData({ showRefresh: true });
  }, [loadHomeData]);

  const displayName = getDisplayName(
    typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null,
    user?.email ?? null
  ) || t("homeGuestChef");
  const displayNameLabel = useMemo(() => wrapLtrInlineText(displayName), [displayName]);
  const homeLayout = getHomeScreenLayout(isRTL);
  const homeScrollProps = useMemo(() => getHomeScrollProps(), []);
  const homeScrollContentStyle = useMemo(
    () => getHomeScrollContentStyle(bottomContentPadding),
    [bottomContentPadding]
  );

  const filteredRecipes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return recipes;
    return recipes.filter((recipe) => matchesRecipeSearch(recipe, query));
  }, [recipes, searchQuery]);

  const recipeCards = useMemo(
    () =>
      getHomeRecipeCards<ImageSourcePropType>({
        recipes: filteredRecipes,
        language,
        minuteLabel: t("homeMinuteShort"),
        fallbackImage: onboardingImages.demoKabsaSocial,
      }),
    [filteredRecipes, t]
  );

  const homeCopy = useMemo(
    () =>
      getHomeScreenCopy({
        displayName,
        folderCount: folders.length,
        importedRecipeCount: allRecipes.length,
        recipeCount: filteredRecipes.length,
        selectedFolderName: selectedFolderId
          ? folders.find((folder) => folder.id === selectedFolderId)?.name ?? null
          : null,
        translate: t,
      }),
    [allRecipes.length, displayName, filteredRecipes.length, folders, selectedFolderId, t]
  );

  const getFolderRecipeCount = useCallback(
    (folderId: string | null) =>
      folderId === null
        ? allRecipes.length
        : allRecipes.filter((recipe) => recipe.folder_id === folderId).length,
    [allRecipes]
  );

  const handleSaveFolder = async (name: string) => {
    if (folderToEdit) {
      const updated = await updateRecipeFolder(folderToEdit.id, name);
      setFolders((curr) => curr.map((f) => (f.id === updated.id ? updated : f)));
    } else {
      const folder = await createRecipeFolder(name);
      setFolders((current) => [...current, folder]);
    }
  };

  const handleDeleteFolder = (folder: RecipeFolder) => {
    Alert.alert(
      t("homeDeleteFolderTitle"),
      t("homeDeleteFolderMessage").replace("{name}", folder.name),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRecipeFolder(folder.id);
              setFolders((curr) => curr.filter((f) => f.id !== folder.id));
              setAllRecipes((curr) =>
                curr.map((recipe) =>
                  recipe.folder_id === folder.id ? { ...recipe, folder_id: null } : recipe
                )
              );
              if (selectedFolderId === folder.id) {
                setSelectedFolderId(null);
              }
              if (selectedFolderId === null) {
                // Refresh recipes to show the newly uncategorized ones
                const recipesData = await listRecipes();
                setRecipes(recipesData);
                setAllRecipes(recipesData);
              }
            } catch (e) {
              Alert.alert(t("homeSomethingWentWrong"), t("homeDeleteFolderError"));
            }
          },
        },
      ]
    );
  };

  const handleAssignRecipe = async (recipeId: string, targetFolderId: string | null) => {
    await assignRecipeToFolder(recipeId, targetFolderId);
    setAllRecipes((curr) =>
      curr.map((recipe) => (recipe.id === recipeId ? { ...recipe, folder_id: targetFolderId } : recipe))
    );
    if (selectedFolderId !== null && targetFolderId !== selectedFolderId) {
      setRecipes((curr) => curr.filter((r) => r.id !== recipeId));
    } else {
      setRecipes((curr) =>
        curr.map((recipe) => (recipe.id === recipeId ? { ...recipe, folder_id: targetFolderId } : recipe))
      );
    }
  };

  const handleOpenImportDrawers = () => {
    setSelectedImportPlatform(null);
    setImportDrawerState("platforms");
  };

  const handleCloseImportDrawers = () => {
    setSelectedImportPlatform(null);
    setImportDrawerState("closed");
  };

  const handleSelectImportPlatform = (platform: ImportPlatform) => {
    setSelectedImportPlatform(platform);
    setImportDrawerState("guide");
  };

  const handleCloseImportGuide = () => {
    setSelectedImportPlatform(null);
    setImportDrawerState("platforms");
  };

  const renderImportedFolderCard = () => (
    <Pressable
      key="imported-recipes"
      style={[
        styles.importedFolderCard,
        selectedFolderId === null && styles.folderCardSelected,
      ]}
      onPress={() => setSelectedFolderId(null)}
    >
      <View style={styles.importedFolderContent}>
        <View style={styles.folderIconWrap}>
          <FontAwesome name="folder" size={18} color={onboardingColors.primaryDark} />
        </View>
        <Text
          numberOfLines={2}
          style={[
            styles.importedFolderTitle,
            {
              alignSelf: "stretch",
              textAlign: homeLayout.textAlign,
              writingDirection: homeLayout.writingDirection,
            },
          ]}
        >
          {homeCopy.importedFolderTitle}
        </Text>
        <Text
          style={[
            styles.importedFolderMeta,
            { alignSelf: "stretch", textAlign: homeLayout.textAlign },
          ]}
        >
          {homeCopy.importedFolderMeta}
        </Text>
      </View>
    </Pressable>
  );

  const renderFolderCards = () =>
    folders.map((folder) => (
      <Pressable
        key={folder.id}
        style={[
          styles.folderCard,
          selectedFolderId === folder.id && styles.folderCardSelected,
        ]}
        onPress={() => setSelectedFolderId(folder.id)}
        onLongPress={() => setContextMenuFolder(folder)}
      >
        <View style={styles.folderIconWrap}>
          <FontAwesome name="folder" size={18} color={onboardingColors.primaryDark} />
        </View>
        <Text
          numberOfLines={2}
          style={[
            styles.folderCardTitle,
            {
              alignSelf: "stretch",
              textAlign: homeLayout.textAlign,
              writingDirection: homeLayout.writingDirection,
            },
          ]}
        >
          {folder.name}
        </Text>
        <Text style={[styles.folderCardMeta, { textAlign: homeLayout.textAlign }]}>
          {t("homeRecipeCount").replace("{count}", String(getFolderRecipeCount(folder.id)))}
        </Text>
      </Pressable>
    ));

  const renderNewFolderCard = () => (
    <Pressable
      key="new-folder"
      style={styles.newFolderCard}
      onPress={() => {
        setFolderToEdit(null);
        setFolderDrawerVisible(true);
      }}
    >
      <View style={styles.newFolderIcon}>
        <FontAwesome name="plus-circle" size={22} color="#617263" />
      </View>
      <Text style={[styles.newFolderText, { textAlign: "center" }]}>
        {homeCopy.newFolderText}
      </Text>
    </Pressable>
  );

  const renderFolderTiles = () =>
    isRTL ? (
      <>
        {renderNewFolderCard()}
        {renderFolderCards()}
        {renderImportedFolderCard()}
      </>
    ) : (
      <>
        {renderImportedFolderCard()}
        {renderFolderCards()}
        {renderNewFolderCard()}
      </>
    );

  return (
    <ScreenTransition>
      <View style={[styles.screen, { paddingTop: Math.max(insets.top, 16) }]}>
        <ScrollView
          style={styles.homeScroll}
          contentContainerStyle={[styles.content, homeScrollContentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          alwaysBounceVertical={homeScrollProps.alwaysBounceVertical}
          bounces={homeScrollProps.bounces}
          refreshControl={
            <RefreshControl
              refreshing={refreshingHome}
              onRefresh={handleRefreshHome}
              tintColor={onboardingColors.primary}
              colors={[onboardingColors.primary]}
            />
          }
        >
        <View style={styles.libraryIntro}>
          <Text
            style={[
              styles.libraryGreeting,
              {
                textAlign: homeLayout.textAlign,
                writingDirection: homeLayout.writingDirection,
              },
            ]}
          >
            {`${t("homeGreeting")} ${displayNameLabel}!`}
          </Text>
          <Text
            style={[
              styles.librarySubtitle,
              {
                textAlign: homeLayout.textAlign,
                writingDirection: homeLayout.writingDirection,
              },
            ]}
          >
            {homeCopy.menuSubtitle}
          </Text>
        </View>

        <View style={[styles.searchRow]}>
          <FontAwesome name="search" size={16} color="#7E8576" />
          <TextInput
            placeholder={homeCopy.searchPlaceholder}
            placeholderTextColor="#9AA094"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[
              styles.searchInput,
              {
                textAlign: homeLayout.textAlign,
                writingDirection: homeLayout.writingDirection,
              },
            ]}
          />
        </View>

        <View style={[styles.filtersRow]}>
          <Pressable style={[styles.filterChip, styles.filterChipActive]}>
            <FontAwesome name="clock-o" size={12} color={onboardingColors.primaryDark} />
            <Text style={styles.filterChipText}>{homeCopy.filterTime}</Text>
            <FontAwesome name="chevron-down" size={10} color={onboardingColors.text} />
          </Pressable>
          <Pressable style={[styles.filterChipWide]}>
            <FontAwesome name="cutlery" size={12} color="#7E8576" />
            <Text style={styles.filterChipText}>{homeCopy.filterMainIngredient}</Text>
            <FontAwesome name="chevron-down" size={10} color={onboardingColors.text} />
          </Pressable>
        </View>

        {error ? (
          <Pressable style={styles.errorCard} onPress={() => void loadHomeData({ showSpinner: true })}>
            <Text style={[styles.errorTitle, { textAlign: homeLayout.textAlign }]}>
              {homeCopy.errorTitle}
            </Text>
            <Text
              style={[
                styles.errorBody,
                {
                  textAlign: homeLayout.textAlign,
                  writingDirection: homeLayout.writingDirection,
                },
              ]}
            >
              {error}
            </Text>
            <Text style={[styles.errorHint, { textAlign: homeLayout.textAlign }]}>
              {homeCopy.errorHint}
            </Text>
          </Pressable>
        ) : null}

        <View style={[styles.sectionHeader]}>
          <Text style={[styles.sectionTitle, { textAlign: homeLayout.textAlign }]}>
            {homeCopy.sectionTitle}
          </Text>
          <Pressable style={styles.viewAllButton} onPress={() => setSelectedFolderId(null)}>
            {loading ? <ActivityIndicator size="small" color={onboardingColors.primary} /> : null}
            <Text style={styles.viewAllText}>{homeCopy.sectionAction}</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.folderScroller}
        >
          {renderFolderTiles()}
        </ScrollView>

        <View style={styles.recipeSectionHeader}>
          <View style={styles.recipeSectionHeaderText}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  alignSelf: "stretch",
                  textAlign: homeLayout.textAlign,
                  writingDirection: homeLayout.writingDirection,
                },
              ]}
            >
              {homeCopy.recipeSectionTitle}
            </Text>
            <Text style={styles.sectionMeta}>{homeCopy.recipeSectionMeta}</Text>
          </View>
        </View>

          {recipeCards.length > 0 ? (
            <View style={styles.recipeList}>
              {recipeCards.map((recipe) => {
                const fullRecipe = recipes.find((item) => item.id === recipe.recipeId);
                const cardDescription = fullRecipe
                  ? getLocalizedRecipeSummary(fullRecipe, language).description
                  : null;
                return (
                <Pressable
                  key={recipe.id}
                  style={styles.recipeCard}
                  onPress={() => {
                    router.push({ pathname: "/recipe/[id]", params: { id: recipe.recipeId } });
                  }}
                >
                  <View style={styles.recipeImageWrap}>
                    <Image source={recipe.image} style={styles.recipeImage} />
                    <View style={styles.recipeTimePill}>
                      <FontAwesome name="clock-o" size={10} color="#FFFFFF" />
                      <Text style={styles.recipeTimeText}>{recipe.minutes}</Text>
                    </View>
                    <Pressable
                      style={[styles.recipeMenu, homeLayout.recipeMenuPosition]}
                      onPress={(e) => {
                        e.stopPropagation();
                        const fullRecipe = recipes.find((r) => r.id === recipe.recipeId);
                        if (fullRecipe) setAddToFolderRecipe(fullRecipe);
                      }}
                    >
                      <FontAwesome name="ellipsis-h" size={14} color="#2C332A" />
                    </Pressable>
                  </View>
                  <View style={styles.recipeCardBody}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.recipeTitle,
                        {
                          alignSelf: "stretch",
                          textAlign: homeLayout.textAlign,
                          writingDirection: homeLayout.writingDirection,
                        },
                      ]}
                    >
                      {recipe.title}
                    </Text>
                    {cardDescription ? (
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.recipeDescription,
                          {
                            textAlign: homeLayout.textAlign,
                            writingDirection: homeLayout.writingDirection,
                          },
                        ]}
                      >
                        {cardDescription}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                );
              })}
            </View>
          ) : (
            <Pressable
              style={styles.emptyRecipesCard}
              onPress={handleOpenImportDrawers}
            >
              <View style={styles.emptyRecipesIcon}>
                <FontAwesome name="plus" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.emptyRecipesCopy}>
                <Text style={[styles.emptyRecipesTitle, { textAlign: homeLayout.textAlign }]}>
                  {t("noRecipesFound")}
                </Text>
                <Text
                  style={[
                    styles.emptyRecipesBody,
                    {
                      textAlign: homeLayout.textAlign,
                      writingDirection: homeLayout.writingDirection,
                    },
                  ]}
                >
                  {t("homeEmptyRecipesBody")}
                </Text>
              </View>
            </Pressable>
          )}
        </ScrollView>
        
        <FolderNameDrawer
          visible={folderDrawerVisible}
          initialName={folderToEdit?.name || ""}
          title={folderToEdit ? t("homeRenameFolder") : t("homeNewFolder")}
          onClose={() => setFolderDrawerVisible(false)}
          onConfirm={handleSaveFolder}
        />

        <FolderContextMenu
          folder={contextMenuFolder}
          visible={!!contextMenuFolder}
          onClose={() => setContextMenuFolder(null)}
          onRename={(folder) => {
            setFolderToEdit(folder);
            setFolderDrawerVisible(true);
          }}
          onDelete={handleDeleteFolder}
        />

        <AddToFolderSheet
          recipe={addToFolderRecipe}
          folders={folders}
          visible={!!addToFolderRecipe}
          onClose={() => setAddToFolderRecipe(null)}
          onAssign={handleAssignRecipe}
        />

        <SocialImportDrawers
          isPrimaryVisible={importDrawerState !== "closed"}
          selectedPlatform={importDrawerState === "guide" ? selectedImportPlatform : null}
          t={t}
          onClosePrimary={handleCloseImportDrawers}
          onSelectPlatform={handleSelectImportPlatform}
          onCloseGuide={handleCloseImportGuide}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={homeCopy.primaryCta}
          style={[
            styles.floatingAddButton,
            isRTL ? { left: 18, bottom: addButtonOffset } : { right: 18, bottom: addButtonOffset },
          ]}
          onPress={handleOpenImportDrawers}
        >
          <FontAwesome name="plus" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FAF9F4",
  },
  homeScroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 22,
    gap: 14,
  },
  libraryIntro: {
    paddingTop: 8,
    gap: 3,
  },
  libraryGreeting: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "900",
    color: onboardingColors.primaryDark,
  },
  librarySubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "#6E7A68",
  },
  searchRow: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6E5DD",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#1F281D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#23271F",
  },
  filtersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterChip: {
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E4DA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  filterChipActive: {
    borderColor: "#DCEFD2",
    backgroundColor: "#E6F5DF",
  },
  filterChipWide: {
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E4DA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2A2D24",
  },
  errorCard: {
    backgroundColor: "#FFF1EE",
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#5D2E25",
  },
  errorBody: {
    fontSize: 13,
    color: "#7F4B3F",
  },
  errorHint: {
    fontSize: 12,
    color: "#996051",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: onboardingColors.primaryDark,
  },
  viewAllButton: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#729B68",
  },
  folderScroller: {
    gap: 12,
    paddingRight: 18,
    paddingLeft: 2,
  },
  importedFolderCard: {
    width: 122,
    height: 122,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EBDD",
    padding: 14,
    justifyContent: "space-between",
  },
  importedFolderContent: {
    flex: 1,
    justifyContent: "space-between",
    gap: 8,
  },
  importedFolderTitle: {
    color: "#46513F",
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "800",
    width: "100%",
  },
  importedFolderMeta: {
    color: "#5D8B55",
    fontSize: 11,
    fontWeight: "800",
    width: "100%",
  },
  folderCard: {
    width: 122,
    height: 122,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EBDD",
    padding: 14,
    justifyContent: "space-between",
  },
  folderCardSelected: {
    borderColor: onboardingColors.primary,
  },
  folderIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#E6F0DB",
    alignItems: "center",
    justifyContent: "center",
  },
  folderCardTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: "#2C3128",
    width: "100%",
  },
  folderCardMeta: {
    fontSize: 11,
    fontWeight: "800",
    color: "#5D8B55",
    width: "100%",
  },
  newFolderCard: {
    width: 122,
    height: 122,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#DBE6CF",
    backgroundColor: "#FAFCF4",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  newFolderIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E9F1E2",
    alignItems: "center",
    justifyContent: "center",
  },
  newFolderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4F6E42",
    width: "100%",
  },
  recipeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  recipeSectionHeaderText: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  sectionMeta: {
    fontSize: 13,
    color: "#8A9084",
  },
  recipeList: {
    gap: 14,
  },
  recipeCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EBDD",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  recipeImageWrap: {
    width: "100%",
    height: 144,
    overflow: "hidden",
    backgroundColor: "#D9DED3",
  },
  recipeImage: {
    width: "100%",
    height: "100%",
  },
  recipeMenu: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  recipeTimePill: {
    position: "absolute",
    left: 10,
    bottom: 10,
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(34, 40, 32, 0.78)",
  },
  recipeTimeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  recipeCardBody: {
    padding: 12,
    gap: 4,
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#20241D",
    width: "100%",
  },
  recipeDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: "#7B816F",
  },
  emptyRecipesCard: {
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6E5DD",
    backgroundColor: "#FFFFFF",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emptyRecipesIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: onboardingColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyRecipesCopy: {
    flex: 1,
    gap: 4,
  },
  emptyRecipesTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#20241D",
  },
  emptyRecipesBody: {
    fontSize: 13,
    lineHeight: 18,
    color: "#7B816F",
  },
  floatingAddButton: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: onboardingColors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: onboardingColors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 8,
  },
});
