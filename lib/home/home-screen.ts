import type { TranslationKey } from "../i18n/translations";

type Translate = (key: TranslationKey) => string;

type HomeScreenCopyInput = {
  displayName: string;
  folderCount: number;
  importedRecipeCount: number;
  recipeCount: number;
  selectedFolderName: string | null;
  translate: Translate;
};

type RecentRecipeInput = {
  id: string;
  title: string;
  description?: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  source_thumbnail_url: string | null;
  localized?: Partial<Record<"en" | "ar", { title: string; description?: string; ingredients: unknown[]; steps: unknown[] }>>;
};

export type HomeRecipeListParams = {
  folderId: string;
};

export type HomeRecipeCard<TImage> = {
  id: string;
  title: string;
  minutes: string;
  image: TImage | { uri: string };
  recipeId: string;
  interactive: true;
};

export function getLocalizedRecipeSummary(recipe: RecentRecipeInput, language: "en" | "ar") {
  const localized = recipe.localized?.[language];
  return {
    title: localized?.title?.trim() || recipe.title,
    description: localized?.description?.trim() || recipe.description || null,
  };
}

export function matchesRecipeSearch(recipe: RecentRecipeInput, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [recipe.title, recipe.localized?.en?.title, recipe.localized?.ar?.title]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .some((value) => value.toLowerCase().includes(normalized));
}

export type HomeMood = "quick" | "chicken" | "veggie" | "rice";

export const HOME_MOODS: HomeMood[] = ["quick", "chicken", "veggie", "rice"];

const QUICK_MOOD_MAX_MINUTES = 30;

const MOOD_KEYWORDS = {
  chicken: ["chicken", "دجاج", "فراخ"],
  rice: ["rice", "kabsa", "biryani", "mandi", "machboos", "أرز", "الرز", "كبسة", "برياني", "مندي", "مجبوس"],
  vegetarian: ["vegetarian", "vegan", "veggie", "نباتي"],
  meat: [
    "chicken", "beef", "lamb", "meat", "mutton", "veal", "turkey", "fish", "salmon", "tuna", "shrimp", "prawn",
    "دجاج", "فراخ", "لحم", "ضأن", "خروف", "سمك", "سلمون", "تونة", "روبيان", "جمبري",
  ],
};

function getRecipeIngredientNames(recipe: RecentRecipeInput): string[] {
  return (["en", "ar"] as const).flatMap((language) =>
    (recipe.localized?.[language]?.ingredients ?? [])
      .map((ingredient) =>
        ingredient && typeof ingredient === "object" ? (ingredient as { name?: unknown }).name : null
      )
      .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
      .map((name) => name.toLowerCase())
  );
}

function includesAny(haystack: string[], keywords: string[]) {
  return haystack.some((value) => keywords.some((keyword) => value.includes(keyword)));
}

/** Quick filters behind the home mood tiles. */
export function matchesHomeMood(recipe: RecentRecipeInput, mood: HomeMood): boolean {
  if (mood === "quick") {
    const totalMinutes = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0);
    return totalMinutes > 0 && totalMinutes <= QUICK_MOOD_MAX_MINUTES;
  }

  const ingredientNames = getRecipeIngredientNames(recipe);
  const titles = [
    recipe.title,
    recipe.description,
    recipe.localized?.en?.title,
    recipe.localized?.ar?.title,
    recipe.localized?.en?.description,
    recipe.localized?.ar?.description,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.toLowerCase());

  if (mood === "veggie") {
    if (includesAny(titles, MOOD_KEYWORDS.vegetarian)) return true;
    // Without an ingredient list there is nothing to rule meat out with.
    return ingredientNames.length > 0 && !includesAny([...ingredientNames, ...titles], MOOD_KEYWORDS.meat);
  }

  return includesAny([...titles, ...ingredientNames], MOOD_KEYWORDS[mood]);
}

function interpolate(template: string, replacements: Record<string, string | number>) {
  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function getRecipeMinutes(recipe: RecentRecipeInput, minuteLabel: string) {
  const totalMinutes = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0);
  return totalMinutes > 0 ? `${totalMinutes} ${minuteLabel}` : `25 ${minuteLabel}`;
}

export function getHomeRecipeListParams(selectedFolderId: string | null): HomeRecipeListParams | undefined {
  return selectedFolderId === null ? undefined : { folderId: selectedFolderId };
}

export function getHomeScrollProps() {
  return {
    alwaysBounceVertical: true,
    bounces: true,
  };
}

export function getHomeScrollContentStyle(bottomContentPadding: number) {
  return {
    flexGrow: 1,
    paddingBottom: bottomContentPadding,
  };
}

export function getHomeScreenLayout(isRTL: boolean) {
  // The root layout (app/_layout.tsx) sets `direction: "rtl"` for Arabic, so
  // Yoga interprets `textAlign` and flex edges logically. Use `"left"` (logical
  // start) in both modes — the parent direction flips it to the physical right
  // edge in Arabic. See RTL_LAYOUT.md for the full reasoning.
  if (isRTL) {
    return {
      headerArrow: "arrow-left" as const,
      textAlign: "left" as const,
      writingDirection: "rtl" as const,
      recipeMenuPosition: {
        left: 10,
        right: "auto" as const,
      },
    };
  }

  return {
    headerArrow: "arrow-right" as const,
    textAlign: "left" as const,
    writingDirection: "ltr" as const,
    recipeMenuPosition: {
      left: "auto" as const,
      right: 10,
    },
  };
}

export function getHomeRecipeCards<TImage>({
  recipes,
  language = "en",
  minuteLabel,
  fallbackImage,
}: {
  recipes: RecentRecipeInput[];
  language?: "en" | "ar";
  minuteLabel: string;
  fallbackImage: TImage;
}): HomeRecipeCard<TImage>[] {
  return recipes.map((recipe) => {
    const localized = getLocalizedRecipeSummary(recipe, language);
    return {
      id: recipe.id,
      recipeId: recipe.id,
      interactive: true as const,
      title: localized.title,
      minutes: getRecipeMinutes(recipe, minuteLabel),
      image: recipe.source_thumbnail_url ? { uri: recipe.source_thumbnail_url } : fallbackImage,
    };
  });
}

export function getHomeScreenCopy({
  displayName,
  folderCount,
  importedRecipeCount,
  recipeCount,
  selectedFolderName,
  translate,
}: HomeScreenCopyInput) {
  const importedRecipesTitle = translate("homeImportedRecipes");

  return {
    heroTitle: `${translate("homeGreeting")}\n${displayName}!\n${translate("homeCookingLine")}`,
    primaryCta: translate("homeNewRecipe"),
    menuSubtitle: translate("homeMenuSubtitle"),
    searchPlaceholder: translate("homeSearchPlaceholder"),
    filterTime: translate("homeFilterTime"),
    filterMainIngredient: translate("homeFilterMainIngredient"),
    errorTitle: translate("homeSomethingWentWrong"),
    errorHint: translate("homeTapToTryAgain"),
    sectionTitle: translate("foldersTitle"),
    sectionAction: translate("homeViewAll"),
    importedFolderTitle: importedRecipesTitle,
    importedFolderMeta: interpolate(translate("homeRecipeCount"), { count: importedRecipeCount }),
    newFolderText: translate("homeNewFolder"),
    recipeSectionTitle: selectedFolderName ?? importedRecipesTitle,
    recipeSectionMeta: `(${interpolate(translate("homeRecipeCount"), { count: recipeCount })})`,
  };
}

export function getTabBarVisualRouteNames<T>(routeNames: T[], isRTL: boolean) {
  return isRTL ? [...routeNames].reverse() : routeNames;
}

export function getTabBarVisualIndex<T>(activeRouteName: T, routeNames: T[], isRTL: boolean) {
  return getTabBarVisualRouteNames(routeNames, isRTL).findIndex((routeName) => routeName === activeRouteName);
}
