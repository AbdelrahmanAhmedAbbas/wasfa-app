import type { AllergyOption, DietOption } from "../onboarding/answers";
import {
  detectAllergens,
  detectDislikes,
  detectNonHalal,
  type HalalConcernKind,
} from "./ingredient-matching.ts";

export type IngredientWarningInput = {
  name: string;
  dietary_flags?: string[];
  allergen_hints?: string[];
  is_halal?: boolean | null;
  halal_concern?: string;
  suggested_alternative?: string;
  /** Set when the user chose to keep a non-halal ingredient instead of its swap. */
  use_original?: boolean;
};

export type RecipePreferenceInput = {
  diet: DietOption[];
  allergies: AllergyOption[];
  dislikes: string[];
};

export type HalalAssessment = {
  /** The halal ingredient to use instead, when one is known. */
  alternative?: string;
  /** True when the alternative is shown in place of the original. */
  swapped: boolean;
  /** The AI's reason, when it is written in the display language. */
  concern?: string;
  concernKind?: HalalConcernKind;
};

export type IngredientAssessment = {
  /** The user's allergies this ingredient triggers. */
  allergies: AllergyOption[];
  /** The user's dislikes this ingredient matches (option ids or their own text). */
  dislikes: string[];
  /** Present when the user eats halal and the ingredient is not halal. */
  halal: HalalAssessment | null;
};

type Language = "en" | "ar";

function hasArabic(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

function isInLanguage(text: string | undefined, language: Language): text is string {
  if (!text?.trim()) return false;
  return language === "ar" ? hasArabic(text) : !hasArabic(text);
}

/**
 * Checks one ingredient against the user's allergies, dislikes and diet.
 * `names` is the ingredient name in every language we have it in, and
 * `localizedAlternative` the halal alternative already written in `language`.
 */
export function assessIngredient(
  ingredient: IngredientWarningInput,
  preferences: RecipePreferenceInput,
  options: { names?: string[]; language?: Language; localizedAlternative?: string } = {}
): IngredientAssessment {
  const language = options.language ?? "en";
  const names = [ingredient.name, ...(options.names ?? [])].filter((name) => name?.trim());

  const allergens = detectAllergens(names, ingredient.allergen_hints);
  const allergies = preferences.allergies.filter((allergy) => allergens.has(allergy));
  const dislikes = detectDislikes(names, preferences.dislikes);

  return {
    allergies,
    dislikes,
    halal: preferences.diet.includes("halal")
      ? assessHalal(ingredient, names, language, options.localizedAlternative)
      : null,
  };
}

function assessHalal(
  ingredient: IngredientWarningInput,
  names: string[],
  language: Language,
  localizedAlternative: string | undefined
): HalalAssessment | null {
  if (ingredient.is_halal === true) return null;

  const flags = (ingredient.dietary_flags ?? []).map((flag) => flag.toLowerCase());
  const flaggedKind: HalalConcernKind | undefined = flags.includes("pork")
    ? "pork"
    : flags.includes("alcohol")
      ? "alcohol"
      : undefined;
  const guess = detectNonHalal(names);

  // The AI's verdict wins; the keyword guess only fills in when it gave none.
  if (ingredient.is_halal !== false && !flaggedKind && !guess) return null;

  const alternative =
    [localizedAlternative, ingredient.suggested_alternative, guess?.alternative[language]].find((text) =>
      isInLanguage(text, language)
    ) ??
    ingredient.suggested_alternative?.trim() ??
    guess?.alternative[language];

  return {
    alternative: alternative || undefined,
    swapped: !!alternative && ingredient.use_original !== true,
    concern: isInLanguage(ingredient.halal_concern, language) ? ingredient.halal_concern.trim() : undefined,
    concernKind: flaggedKind ?? guess?.kind,
  };
}

type AssessableRecipe = {
  ingredients_json: IngredientWarningInput[];
  localized: Partial<
    Record<Language, { ingredients: Array<{ name: string; suggested_alternative?: string }> }>
  >;
};

/** Assesses every ingredient of a recipe, using its English and Arabic names. */
export function assessRecipeIngredients(
  recipe: AssessableRecipe,
  preferences: RecipePreferenceInput,
  language: Language
): IngredientAssessment[] {
  // Translated ingredients are matched by position, so a list that no longer
  // lines up with the recipe is ignored.
  const aligned = (candidate: Language) => {
    const ingredients = recipe.localized[candidate]?.ingredients;
    return ingredients?.length === recipe.ingredients_json.length ? ingredients : undefined;
  };
  const english = aligned("en");
  const arabic = aligned("ar");

  return recipe.ingredients_json.map((ingredient, index) =>
    assessIngredient(ingredient, preferences, {
      names: [english?.[index]?.name, arabic?.[index]?.name].filter((name): name is string => !!name),
      language,
      localizedAlternative: aligned(language)?.[index]?.suggested_alternative,
    })
  );
}

export type IngredientSwap = { from: string; to: string };

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rewrites mentions of swapped ingredients in a step. Only whole-word mentions
 * are replaced, so "ham" never touches "hamburger".
 */
export function applyIngredientSwaps(text: string, swaps: IngredientSwap[]): string {
  return swaps.reduce((result, swap) => {
    const from = swap.from.trim();
    if (from.length < 2) return result;

    const pattern = hasArabic(from)
      ? new RegExp(`(^|[^\\u0621-\\u064A])(?:ال)?${escapeRegExp(from)}(?![\\u0621-\\u064A])`, "g")
      : new RegExp(`(^|[^A-Za-z])${escapeRegExp(from)}(?![A-Za-z])`, "gi");

    return result.replace(pattern, (_match, before: string) => `${before}${swap.to}`);
  }, text);
}
