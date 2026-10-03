// Search and filter logic for the recipe library. Kept free of React Native
// imports so it runs under `node --test`.
import type { GlyphName } from "../theme/glyphs";

type LocalizedText = {
  title?: string;
  cuisine?: string;
  meal_type?: string;
  ingredients?: unknown[];
};

export type FilterableRecipe = {
  title: string;
  cuisine?: string | null;
  meal_type?: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  /** Ingredient names as imported, before translation. */
  ingredient_names?: string[];
  localized?: Partial<Record<"en" | "ar", LocalizedText>>;
};

export type MainIngredient = "chicken" | "meat" | "seafood" | "rice" | "pasta" | "eggs" | "vegetarian";

export type RecipeFilters = {
  /** Longest total (prep + cook) time, in minutes. */
  maxMinutes: number | null;
  /** Keys from `getRecipeFilterOptions`; a recipe matches any one of them. */
  mealTypes: string[];
  cuisines: string[];
  /** A recipe must match every selected ingredient. */
  ingredients: MainIngredient[];
};

export const EMPTY_RECIPE_FILTERS: RecipeFilters = {
  maxMinutes: null,
  mealTypes: [],
  cuisines: [],
  ingredients: [],
};

export const TIME_FILTER_OPTIONS = [30, 60] as const;

export const MAIN_INGREDIENTS: { id: MainIngredient; glyph: GlyphName }[] = [
  { id: "chicken", glyph: "poultry-leg" },
  { id: "meat", glyph: "cut-of-meat" },
  { id: "seafood", glyph: "fish" },
  { id: "rice", glyph: "cooked-rice" },
  { id: "pasta", glyph: "spaghetti" },
  { id: "eggs", glyph: "egg" },
  { id: "vegetarian", glyph: "leafy-green" },
];

const INGREDIENT_KEYWORDS: Record<Exclude<MainIngredient, "vegetarian">, string[]> = {
  chicken: ["chicken", "دجاج", "فراخ"],
  meat: ["beef", "lamb", "meat", "mutton", "veal", "steak", "لحم", "ضأن", "خروف", "غنم"],
  seafood: [
    "fish", "salmon", "tuna", "shrimp", "prawn", "hammour", "seafood",
    "سمك", "سلمون", "تونة", "روبيان", "جمبري", "هامور",
  ],
  rice: ["rice", "kabsa", "biryani", "mandi", "machboos", "أرز", "الرز", "كبسة", "برياني", "مندي", "مجبوس"],
  pasta: ["pasta", "spaghetti", "noodle", "macaroni", "معكرونة", "باستا", "سباغيتي", "شعيرية"],
  eggs: ["egg", "بيض"],
};

const VEGETARIAN_KEYWORDS = ["vegetarian", "vegan", "veggie", "نباتي"];
const ANIMAL_KEYWORDS = [
  ...INGREDIENT_KEYWORDS.chicken,
  ...INGREDIENT_KEYWORDS.meat,
  ...INGREDIENT_KEYWORDS.seafood,
  "turkey",
  "ديك",
];

// What the importer stores when it could not tell; not worth a filter chip.
const UNCLASSIFIED = new Set(["general", "meal"]);

/**
 * Lower-cases and folds the Arabic spellings people type interchangeably
 * (hamza forms of alef, taa marbuta, alef maqsura, diacritics), so "ارز"
 * finds "أرز".
 */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

function present(values: Array<string | null | undefined>): string[] {
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(normalizeSearchText);
}

function getTitles(recipe: FilterableRecipe): string[] {
  return present([recipe.title, recipe.localized?.en?.title, recipe.localized?.ar?.title]);
}

function getIngredientNames(recipe: FilterableRecipe): string[] {
  const localized = (["en", "ar"] as const).flatMap((language) =>
    (recipe.localized?.[language]?.ingredients ?? []).map((ingredient) =>
      ingredient && typeof ingredient === "object" ? (ingredient as { name?: unknown }).name : null
    )
  );
  return present([
    ...(recipe.ingredient_names ?? []),
    ...localized.map((name) => (typeof name === "string" ? name : null)),
  ]);
}

function getTypeLabels(recipe: FilterableRecipe): string[] {
  return present([
    recipe.cuisine,
    recipe.meal_type,
    recipe.localized?.en?.cuisine,
    recipe.localized?.ar?.cuisine,
    recipe.localized?.en?.meal_type,
    recipe.localized?.ar?.meal_type,
  ]);
}

function includesAny(haystack: string[], keywords: string[]) {
  const normalized = keywords.map(normalizeSearchText);
  return haystack.some((value) => normalized.some((keyword) => value.includes(keyword)));
}

/**
 * Free-text search over a recipe's name, ingredients and type (cuisine and
 * meal type), in either language. Every word of the query must be found.
 */
export function matchesRecipeSearch(recipe: FilterableRecipe, query: string): boolean {
  const words = normalizeSearchText(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;

  const haystack = [...getTitles(recipe), ...getIngredientNames(recipe), ...getTypeLabels(recipe)];
  return words.every((word) => haystack.some((value) => value.includes(word)));
}

export function matchesMainIngredient(recipe: FilterableRecipe, ingredient: MainIngredient): boolean {
  const titles = getTitles(recipe);
  const ingredientNames = getIngredientNames(recipe);

  if (ingredient === "eggs") {
    // "eggplant" is not an egg.
    const withoutEggplant = [...titles, ...ingredientNames].map((value) => value.replaceAll("eggplant", ""));
    return includesAny(withoutEggplant, INGREDIENT_KEYWORDS.eggs);
  }

  if (ingredient === "vegetarian") {
    if (includesAny(titles, VEGETARIAN_KEYWORDS)) return true;
    // Without an ingredient list there is nothing to rule meat out with.
    return ingredientNames.length > 0 && !includesAny([...ingredientNames, ...titles], ANIMAL_KEYWORDS);
  }

  return includesAny([...titles, ...ingredientNames], INGREDIENT_KEYWORDS[ingredient]);
}

function getTotalMinutes(recipe: FilterableRecipe): number {
  return (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0);
}

function typeKey(value: string | null | undefined): string | null {
  const key = normalizeSearchText(value ?? "");
  return key && !UNCLASSIFIED.has(key) ? key : null;
}

export function matchesRecipeFilters(recipe: FilterableRecipe, filters: RecipeFilters): boolean {
  if (filters.maxMinutes !== null) {
    const totalMinutes = getTotalMinutes(recipe);
    // A recipe with no known time cannot be promised to be quick.
    if (totalMinutes === 0 || totalMinutes > filters.maxMinutes) return false;
  }

  if (filters.mealTypes.length > 0) {
    const key = typeKey(recipe.meal_type);
    if (!key || !filters.mealTypes.includes(key)) return false;
  }

  if (filters.cuisines.length > 0) {
    const key = typeKey(recipe.cuisine);
    if (!key || !filters.cuisines.includes(key)) return false;
  }

  return filters.ingredients.every((ingredient) => matchesMainIngredient(recipe, ingredient));
}

export function countActiveFilters(filters: RecipeFilters): number {
  return (
    (filters.maxMinutes !== null ? 1 : 0) +
    filters.mealTypes.length +
    filters.cuisines.length +
    filters.ingredients.length
  );
}

export type TypeFilterOption = { key: string; label: string; count: number };

export type RecipeFilterOptions = {
  mealTypes: TypeFilterOption[];
  cuisines: TypeFilterOption[];
  ingredients: MainIngredient[];
  /** Whether any recipe has a known time to filter on. */
  hasTimes: boolean;
};

function collectTypeOptions(
  recipes: FilterableRecipe[],
  field: "meal_type" | "cuisine",
  language: "en" | "ar"
): TypeFilterOption[] {
  const options = new Map<string, TypeFilterOption>();

  for (const recipe of recipes) {
    const key = typeKey(recipe[field]);
    if (!key) continue;
    const label = recipe.localized?.[language]?.[field]?.trim() || recipe[field]!.trim();
    const existing = options.get(key);
    if (existing) existing.count += 1;
    else options.set(key, { key, label, count: 1 });
  }

  return [...options.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** The choices worth offering for this library: only values some recipe has. */
export function getRecipeFilterOptions(
  recipes: FilterableRecipe[],
  language: "en" | "ar"
): RecipeFilterOptions {
  return {
    mealTypes: collectTypeOptions(recipes, "meal_type", language),
    cuisines: collectTypeOptions(recipes, "cuisine", language),
    ingredients: MAIN_INGREDIENTS.map((entry) => entry.id).filter((ingredient) =>
      recipes.some((recipe) => matchesMainIngredient(recipe, ingredient))
    ),
    hasTimes: recipes.some((recipe) => getTotalMinutes(recipe) > 0),
  };
}

/** Drops selections that no longer exist in the library (e.g. after a folder switch). */
export function pruneRecipeFilters(filters: RecipeFilters, options: RecipeFilterOptions): RecipeFilters {
  const mealTypes = filters.mealTypes.filter((key) => options.mealTypes.some((option) => option.key === key));
  const cuisines = filters.cuisines.filter((key) => options.cuisines.some((option) => option.key === key));
  const ingredients = filters.ingredients.filter((ingredient) => options.ingredients.includes(ingredient));
  const unchanged =
    mealTypes.length === filters.mealTypes.length &&
    cuisines.length === filters.cuisines.length &&
    ingredients.length === filters.ingredients.length;
  return unchanged ? filters : { ...filters, mealTypes, cuisines, ingredients };
}
