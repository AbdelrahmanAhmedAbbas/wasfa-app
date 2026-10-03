type LocalizedContent = {
  title: string;
  ingredients: unknown[];
  steps: unknown[];
};

type LocalizableRecipe = {
  ingredients_json: unknown[];
  steps_json: unknown[];
  localized: Partial<Record<"en" | "ar", LocalizedContent>>;
};

/**
 * True when the recipe has full content written in `language`. A recipe can
 * lack one: its translation failed at import, or it was saved before both
 * languages were generated.
 */
export function hasLocalizedContent(recipe: LocalizableRecipe, language: "en" | "ar"): boolean {
  const localized = recipe.localized[language];
  if (!localized) return false;
  if (
    localized.ingredients.length !== recipe.ingredients_json.length ||
    localized.steps.length !== recipe.steps_json.length
  ) {
    return false;
  }

  const arabicLetters = (localized.title.match(/[؀-ۿ]/g) ?? []).length;
  const latinLetters = (localized.title.match(/[A-Za-z]/g) ?? []).length;
  return language === "ar" ? arabicLetters > 0 && arabicLetters >= latinLetters : latinLetters > arabicLetters;
}
