import { track } from "@/lib/analytics/posthog";
import { LocalizedText as Text } from "@/components/LocalizedText";
import { useImportSheet } from "@/components/import/ImportSheetContext";
import { ScreenTransition } from "@/components/navigation/ScreenTransition";
import { PhotoScrim } from "@/components/wasfa/PhotoScrim";
import Feather from "@expo/vector-icons/Feather";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "@/lib/home/home-screen";
import {
  EMPTY_RECIPE_FILTERS,
  countActiveFilters,
  getRecipeFilterOptions,
  matchesRecipeFilters,
  matchesRecipeSearch,
  pruneRecipeFilters,
  type RecipeFilters,
} from "@/lib/home/recipe-filters";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { subscribeToFinishedImports } from "@/lib/notifications/importEvents";
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
import { toArabicIndicDigits } from "@/lib/recipes/numerals";
import { onboardingImages } from "@/lib/theme/onboarding";
import { getTabBarClearance, wasfaColors } from "@/lib/theme/wasfa";
import { FolderNameDrawer } from "@/components/folders/FolderNameDrawer";
import { FolderContextMenu } from "@/components/folders/FolderContextMenu";
import { AddToFolderSheet } from "@/components/recipes/AddToFolderSheet";
import {
  MAIN_INGREDIENT_LABELS,
  RecipeFilterSheet,
  TIME_FILTER_LABELS,
} from "@/components/recipes/RecipeFilterSheet";

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

// How many recipes the "Recently saved" carousel shows before "See all".
const RECENT_CAROUSEL_LIMIT = 8;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, isRTL, language } = useLanguage();
  const importSheet = useImportSheet();
  const bottomContentPadding = getTabBarClearance(insets.bottom);

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
  const [filters, setFilters] = useState<RecipeFilters>(EMPTY_RECIPE_FILTERS);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [showAllRecipes, setShowAllRecipes] = useState(false);

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

  // The tabs stay open under an import or a recipe, so the library reloads each
  // time this screen comes back into view; only a first load or a folder change
  // shows the spinner.
  const loadedFolderRef = useRef<string | null | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      const showSpinner = loadedFolderRef.current !== selectedFolderId;
      loadedFolderRef.current = selectedFolderId;
      void loadHomeData({ showSpinner });
    }, [loadHomeData, selectedFolderId])
  );

  // An import the user left running adds its recipe while this screen is already in view.
  useEffect(() => subscribeToFinishedImports(() => void loadHomeData()), [loadHomeData]);

  const handleRefreshHome = useCallback(() => {
    void loadHomeData({ showRefresh: true });
  }, [loadHomeData]);

  const displayName = getDisplayName(
    user?.name ?? null,
    user?.email ?? null
  ) || t("homeDefaultName");
  const displayNameLabel = useMemo(() => wrapLtrInlineText(displayName), [displayName]);
  const homeLayout = getHomeScreenLayout(isRTL);
  const homeScrollProps = useMemo(() => getHomeScrollProps(), []);
  const homeScrollContentStyle = useMemo(
    () => getHomeScrollContentStyle(bottomContentPadding),
    [bottomContentPadding]
  );

  // The filter choices come from the whole library, so they stay put while a
  // folder is open.
  const filterOptions = useMemo(() => getRecipeFilterOptions(allRecipes, language), [allRecipes, language]);
  const activeFilterCount = countActiveFilters(filters);

  useEffect(() => {
    if (loading) return;
    setFilters((current) => pruneRecipeFilters(current, filterOptions));
  }, [filterOptions, loading]);

  const filteredRecipes = useMemo(
    () =>
      recipes.filter(
        (recipe) => matchesRecipeSearch(recipe, searchQuery) && matchesRecipeFilters(recipe, filters)
      ),
    [filters, recipes, searchQuery]
  );

  const activeFilterChips = useMemo(() => {
    const labelFor = (options: { key: string; label: string }[], key: string) =>
      options.find((option) => option.key === key)?.label ?? key;
    return [
      ...(filters.maxMinutes === 30 || filters.maxMinutes === 60
        ? [
            {
              key: "time",
              label: t(TIME_FILTER_LABELS[filters.maxMinutes]),
              remove: () => setFilters((current) => ({ ...current, maxMinutes: null })),
            },
          ]
        : []),
      ...filters.mealTypes.map((key) => ({
        key: `meal-${key}`,
        label: labelFor(filterOptions.mealTypes, key),
        remove: () =>
          setFilters((current) => ({
            ...current,
            mealTypes: current.mealTypes.filter((entry) => entry !== key),
          })),
      })),
      ...filters.cuisines.map((key) => ({
        key: `cuisine-${key}`,
        label: labelFor(filterOptions.cuisines, key),
        remove: () =>
          setFilters((current) => ({
            ...current,
            cuisines: current.cuisines.filter((entry) => entry !== key),
          })),
      })),
      ...filters.ingredients.map((ingredient) => ({
        key: `ingredient-${ingredient}`,
        label: t(MAIN_INGREDIENT_LABELS[ingredient]),
        remove: () =>
          setFilters((current) => ({
            ...current,
            ingredients: current.ingredients.filter((entry) => entry !== ingredient),
          })),
      })),
    ];
  }, [filterOptions, filters, t]);

  const recipeCards = useMemo(
    () =>
      getHomeRecipeCards<ImageSourcePropType>({
        recipes: filteredRecipes,
        language,
        minuteLabel: t("homeMinuteShort"),
        fallbackImage: onboardingImages.demoKabsaSocial,
      }),
    [filteredRecipes, language, t]
  );

  // The carousel is the resting state; any narrowing (search, filters, folder)
  // or "See all" switches to the full grid.
  const isFiltering = searchQuery.trim().length > 0 || activeFilterCount > 0 || selectedFolderId !== null;
  const showGrid = showAllRecipes || isFiltering;
  const carouselCards = useMemo(() => recipeCards.slice(0, RECENT_CAROUSEL_LIMIT), [recipeCards]);

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
      track("folder_renamed");
      setFolders((curr) => curr.map((f) => (f.id === updated.id ? updated : f)));
    } else {
      const folder = await createRecipeFolder(name);
      track("folder_created");
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
              track("folder_deleted");
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
    track("recipe_moved_to_folder", { into_folder: targetFolderId !== null });
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

  const localizeDigits = (value: string) => (language === "ar" ? toArabicIndicDigits(value) : value);
  const formatRecipeCount = (count: number) =>
    localizeDigits(t("homeRecipeCount").replace("{count}", String(count)));

  const openRecipe = (recipeId: string) => {
    router.push({ pathname: "/recipe/[id]", params: { id: recipeId } });
  };

  const openRecipeOptions = (recipeId: string) => {
    const fullRecipe = recipes.find((item) => item.id === recipeId);
    if (fullRecipe) setAddToFolderRecipe(fullRecipe);
  };

  const renderFolderTile = (folderId: string | null, name: string, onLongPress?: () => void) => {
    const selected = selectedFolderId === folderId;
    return (
      <Pressable
        key={folderId ?? "imported-recipes"}
        style={[styles.folderCard, selected && styles.folderCardSelected]}
        onPress={() => setSelectedFolderId(folderId)}
        onLongPress={onLongPress}
      >
        <View style={styles.folderIconWrap}>
          <Feather name="folder" size={18} color={wasfaColors.primaryDark} />
        </View>
        <View style={styles.folderCopy}>
          <Text
            numberOfLines={1}
            style={[
              styles.folderCardTitle,
              { textAlign: homeLayout.textAlign, writingDirection: homeLayout.writingDirection },
            ]}
          >
            {name}
          </Text>
          <Text style={[styles.folderCardMeta, { textAlign: homeLayout.textAlign }]}>
            {formatRecipeCount(getFolderRecipeCount(folderId))}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderImportedFolderCard = () => renderFolderTile(null, homeCopy.importedFolderTitle);

  const renderFolderCards = () =>
    folders.map((folder) =>
      renderFolderTile(folder.id, folder.name, () => setContextMenuFolder(folder))
    );

  const renderNewFolderCard = () => (
    <Pressable
      key="new-folder"
      style={styles.newFolderCard}
      onPress={() => {
        setFolderToEdit(null);
        setFolderDrawerVisible(true);
      }}
    >
      <Feather name="plus" size={16} color={wasfaColors.muted} />
      <Text style={styles.newFolderText}>{homeCopy.newFolderText}</Text>
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

  const renderRecipeCard = (recipe: (typeof recipeCards)[number], layout: "carousel" | "grid") => (
    <Pressable
      key={recipe.id}
      style={[styles.recipeCard, layout === "carousel" ? styles.recipeCardCarousel : styles.recipeCardGrid]}
      onPress={() => openRecipe(recipe.recipeId)}
      onLongPress={() => openRecipeOptions(recipe.recipeId)}
    >
      <Image source={recipe.image} style={styles.recipeImage} />
      <PhotoScrim />
      <View style={styles.recipeTimePill}>
        <Text style={styles.recipeTimeText}>{localizeDigits(recipe.minutes)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("homeRecipeOptions")}
        hitSlop={8}
        style={styles.recipeMenu}
        onPress={(e) => {
          e.stopPropagation();
          openRecipeOptions(recipe.recipeId);
        }}
      >
        <Feather name="more-horizontal" size={16} color={wasfaColors.ink} />
      </Pressable>
      <Text
        numberOfLines={3}
        style={[
          styles.recipeTitle,
          { textAlign: homeLayout.textAlign, writingDirection: homeLayout.writingDirection },
        ]}
      >
        {recipe.title}
      </Text>
    </Pressable>
  );

  const recipeSectionTitle =
    selectedFolderId !== null
      ? homeCopy.recipeSectionTitle
      : showGrid
        ? homeCopy.importedFolderTitle
        : t("homeRecentlySaved");
  const libraryIsEmpty = !loading && allRecipes.length === 0;

  return (
    <ScreenTransition>
      <View style={styles.screen}>
        <ScrollView
          style={styles.homeScroll}
          contentContainerStyle={homeScrollContentStyle}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          alwaysBounceVertical={homeScrollProps.alwaysBounceVertical}
          bounces={homeScrollProps.bounces}
          refreshControl={
            <RefreshControl
              refreshing={refreshingHome}
              onRefresh={handleRefreshHome}
              tintColor="#FFFFFF"
              colors={[wasfaColors.primary]}
            />
          }
        >
          <View style={[styles.hero, { paddingTop: insets.top + 18 }]}>
            <Image
              source={onboardingImages.mascot}
              resizeMode="contain"
              style={[
                styles.heroMascot,
                { top: insets.top - 4, transform: [{ rotate: isRTL ? "-12deg" : "12deg" }] },
              ]}
            />
            <View style={styles.heroCopy}>
              <Text
                style={[
                  styles.heroGreeting,
                  { textAlign: homeLayout.textAlign, writingDirection: homeLayout.writingDirection },
                ]}
              >
                {`${t("homeGreeting")} ${displayNameLabel}!`}
              </Text>
              <Text
                style={[
                  styles.heroTitle,
                  isRTL && styles.heroTitleArabic,
                  { textAlign: homeLayout.textAlign, writingDirection: homeLayout.writingDirection },
                ]}
              >
                {t("homeAsk")}
              </Text>
            </View>
            <View style={styles.searchBar}>
              <View style={styles.searchRow}>
                <Feather name="search" size={18} color={wasfaColors.ink} />
                <TextInput
                  placeholder={homeCopy.searchPlaceholder}
                  placeholderTextColor={wasfaColors.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onEndEditing={() => {
                    // The words searched for are not recorded, only that a search was made.
                    if (searchQuery.trim()) track("recipes_searched", { results: filteredRecipes.length });
                  }}
                  autoCorrect={false}
                  returnKeyType="search"
                  style={[
                    styles.searchInput,
                    { textAlign: homeLayout.textAlign, writingDirection: homeLayout.writingDirection },
                  ]}
                />
                {searchQuery ? (
                  <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setSearchQuery("")}>
                    <Feather name="x" size={18} color={wasfaColors.muted} />
                  </Pressable>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("homeFilters")}
                style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
                onPress={() => setFilterSheetVisible(true)}
              >
                <Feather
                  name="sliders"
                  size={20}
                  color={activeFilterCount > 0 ? "#FFFFFF" : wasfaColors.ink}
                />
                {activeFilterCount > 0 ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{localizeDigits(String(activeFilterCount))}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          </View>

          {error ? (
            <Pressable style={styles.errorCard} onPress={() => void loadHomeData({ showSpinner: true })}>
              <Text style={[styles.errorTitle, { textAlign: homeLayout.textAlign }]}>
                {homeCopy.errorTitle}
              </Text>
              <Text
                style={[
                  styles.errorBody,
                  { textAlign: homeLayout.textAlign, writingDirection: homeLayout.writingDirection },
                ]}
              >
                {error}
              </Text>
              <Text style={[styles.errorHint, { textAlign: homeLayout.textAlign }]}>
                {homeCopy.errorHint}
              </Text>
            </Pressable>
          ) : null}

          {activeFilterChips.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.activeFilters}
              contentContainerStyle={styles.activeFiltersContent}
            >
              {activeFilterChips.map((chip) => (
                <Pressable
                  key={chip.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("profileDislikeRemove")} ${chip.label}`}
                  style={styles.activeFilterChip}
                  onPress={chip.remove}
                >
                  <Text style={styles.activeFilterText}>{chip.label}</Text>
                  <Feather name="x" size={14} color={wasfaColors.ink} />
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                style={styles.clearFilters}
                onPress={() => setFilters(EMPTY_RECIPE_FILTERS)}
              >
                <Text style={styles.clearFiltersText}>{t("homeFilterClear")}</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { textAlign: homeLayout.textAlign }]}>
              {homeCopy.sectionTitle}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalScrollView}
            contentContainerStyle={styles.horizontalScroller}
          >
            {renderFolderTiles()}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text
              numberOfLines={1}
              style={[
                styles.sectionTitle,
                styles.sectionTitleFlexible,
                { textAlign: homeLayout.textAlign, writingDirection: homeLayout.writingDirection },
              ]}
            >
              {recipeSectionTitle}
            </Text>
            {loading ? <ActivityIndicator size="small" color={wasfaColors.primary} /> : null}
            {!isFiltering && recipeCards.length > 0 ? (
              <Pressable hitSlop={8} onPress={() => setShowAllRecipes((current) => !current)}>
                <Text style={styles.sectionAction}>
                  {showAllRecipes ? t("homeShowLess") : t("homeSeeAll")}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {recipeCards.length === 0 ? (
            libraryIsEmpty ? (
              <Pressable style={styles.emptyCard} onPress={importSheet.open}>
                <Image source={onboardingImages.mascotReading} resizeMode="contain" style={styles.emptyImage} />
                <Text style={styles.emptyTitle}>{t("homeEmptyLibraryTitle")}</Text>
                <Text style={styles.emptyBody}>{t("homeEmptyLibraryBody")}</Text>
              </Pressable>
            ) : loading ? null : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{t("homeNoMatchesTitle")}</Text>
                <Text style={styles.emptyBody}>{t("homeNoMatchesBody")}</Text>
              </View>
            )
          ) : showGrid ? (
            <View style={styles.recipeGrid}>
              {recipeCards.map((recipe) => renderRecipeCard(recipe, "grid"))}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScrollView}
              contentContainerStyle={styles.horizontalScroller}
            >
              {carouselCards.map((recipe) => renderRecipeCard(recipe, "carousel"))}
            </ScrollView>
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

        <RecipeFilterSheet
          visible={filterSheetVisible}
          onClose={() => {
            setFilterSheetVisible(false);
            if (activeFilterCount > 0) {
              track("recipes_filtered", { filters: activeFilterCount, results: filteredRecipes.length });
            }
          }}
          filters={filters}
          onChange={setFilters}
          options={filterOptions}
          resultCount={filteredRecipes.length}
        />

        <AddToFolderSheet
          recipe={addToFolderRecipe}
          folders={folders}
          visible={!!addToFolderRecipe}
          onClose={() => setAddToFolderRecipe(null)}
          onAssign={handleAssignRecipe}
        />
      </View>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: wasfaColors.surface,
  },
  homeScroll: {
    flex: 1,
  },
  hero: {
    overflow: "hidden",
    backgroundColor: wasfaColors.primary,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  heroMascot: {
    position: "absolute",
    end: -18,
    width: 150,
    height: 150,
  },
  heroCopy: {
    maxWidth: "72%",
    gap: 4,
  },
  heroGreeting: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },
  heroTitle: {
    fontSize: 33,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: "#FFFFFF",
  },
  // Arabic marks above the line clip in a tight line box, and letter spacing breaks joining.
  heroTitleArabic: {
    lineHeight: 44,
    letterSpacing: 0,
  },
  searchBar: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchRow: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    backgroundColor: wasfaColors.surface,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: wasfaColors.ink,
  },
  errorCard: {
    marginTop: 16,
    marginHorizontal: 20,
    backgroundColor: "#FFF1EE",
    borderRadius: 20,
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
  filterButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: wasfaColors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  filterButtonActive: {
    backgroundColor: wasfaColors.cta,
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    end: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: wasfaColors.primary,
    backgroundColor: wasfaColors.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  activeFilters: {
    flexGrow: 0,
    marginTop: 16,
  },
  activeFiltersContent: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: "center",
  },
  activeFilterChip: {
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: wasfaColors.cta,
    backgroundColor: wasfaColors.ctaSoft,
    paddingStart: 14,
    paddingEnd: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeFilterText: {
    fontSize: 13,
    fontWeight: "700",
    color: wasfaColors.ink,
  },
  clearFilters: {
    paddingHorizontal: 8,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: "700",
    color: wasfaColors.primaryDark,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: wasfaColors.ink,
  },
  sectionTitleFlexible: {
    flex: 1,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: "700",
    color: wasfaColors.primary,
  },
  // Keeps a row at its content height when the page is shorter than the screen.
  horizontalScrollView: {
    flexGrow: 0,
  },
  horizontalScroller: {
    gap: 12,
    paddingHorizontal: 20,
  },
  folderCard: {
    minWidth: 150,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.soft,
    paddingVertical: 10,
    paddingStart: 10,
    paddingEnd: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  folderCardSelected: {
    borderColor: wasfaColors.cta,
    backgroundColor: wasfaColors.ctaSoft,
  },
  folderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: wasfaColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  folderCopy: {
    gap: 1,
  },
  folderCardTitle: {
    maxWidth: 140,
    fontSize: 15,
    fontWeight: "800",
    color: wasfaColors.ink,
  },
  folderCardMeta: {
    fontSize: 12,
    color: wasfaColors.muted,
  },
  newFolderCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: wasfaColors.checkBorder,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  newFolderText: {
    fontSize: 13,
    fontWeight: "700",
    color: wasfaColors.muted,
  },
  recipeGrid: {
    marginHorizontal: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  recipeCard: {
    height: 236,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#D9C8AE",
    justifyContent: "flex-end",
  },
  recipeCardCarousel: {
    width: 176,
  },
  recipeCardGrid: {
    flexBasis: "47%",
    flexGrow: 1,
    maxWidth: "48.5%",
  },
  recipeImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  recipeTimePill: {
    position: "absolute",
    top: 12,
    start: 12,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: wasfaColors.surface,
  },
  recipeTimeText: {
    fontSize: 12,
    fontWeight: "800",
    color: wasfaColors.ink,
  },
  recipeMenu: {
    position: "absolute",
    top: 10,
    end: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  recipeTitle: {
    marginHorizontal: 14,
    marginBottom: 14,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  emptyCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: wasfaColors.checkBorder,
    backgroundColor: wasfaColors.soft,
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  emptyImage: {
    width: 110,
    height: 110,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    color: wasfaColors.muted,
    textAlign: "center",
  },
});
