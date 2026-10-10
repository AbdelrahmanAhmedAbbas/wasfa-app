// Pure shopping-line text. Kept free of React Native imports so it runs under
// `node --test`. A line is saved as plain text in the recipe's own language;
// to show it in the app's language it is matched back to the recipe's
// ingredient and written again from that ingredient's translation.

import { detectNonHalal } from "../recipes/ingredient-matching.ts";
import { cleanLocalizedIngredientName, getLocalizedUnitLabel } from "../recipes/units.ts";
import { parseShoppingText } from "./merge.ts";

type Language = "en" | "ar";

type LineIngredient = {
  name: string;
  quantity?: string;
  unit?: string;
  notes?: string;
  suggested_alternative?: string;
};

/** What a line's recipe has to offer for the line to be written in another language. */
export type ShoppingLineRecipe = {
  ingredients_json: LineIngredient[];
  localized: Partial<
    Record<Language, { ingredients: Array<{ name: string; notes?: string; suggested_alternative?: string }> }>
  >;
};

const ARABIC_SCRIPT = /[؀-ۿ]/;

function isInLanguage(text: string | undefined, language: Language): text is string {
  if (!text?.trim()) return false;
  return language === "ar" ? ARABIC_SCRIPT.test(text) : !ARABIC_SCRIPT.test(text);
}

/**
 * What to buy for one ingredient: amount, unit and name. An ingredient's notes
 * and preparation are for cooking, so they stay on the recipe.
 */
export function formatShoppingLine(item: { name: string; quantity?: string; unit?: string }): string {
  return [item.quantity, item.unit, item.name].filter(Boolean).join(" ").trim();
}

/**
 * The line written in `language`, or the line as it is when it already is in
 * that language, no longer matches an ingredient of the recipe, or the recipe
 * has no translation for it.
 */
export function localizeShoppingLine(
  text: string,
  recipe: ShoppingLineRecipe | null | undefined,
  language: Language
): string {
  const line = parseShoppingText(text);
  if (!recipe || isInLanguage(line.name, language)) return text;

  // Translated ingredients are matched by position, so a list that no longer
  // lines up with the recipe is ignored.
  const aligned = (candidate: Language) => {
    const ingredients = recipe.localized[candidate]?.ingredients;
    return ingredients?.length === recipe.ingredients_json.length ? ingredients : undefined;
  };
  const translated = aligned(language);
  if (!translated) return text;
  const english = aligned("en");
  const arabic = aligned("ar");

  const ingredients = recipe.ingredients_json;
  const sameName = (ingredient: LineIngredient, name: string) =>
    parseShoppingText(formatShoppingLine({ ...ingredient, name })).key === line.key;

  // The exact line first: a recipe can list one ingredient twice with different amounts.
  // Lines saved before notes were left out carry them in brackets at the end.
  // A changed amount (new servings) still matches by name.
  const withNotes = (ingredient: LineIngredient) =>
    ingredient.notes ? `${formatShoppingLine(ingredient)} (${ingredient.notes})` : formatShoppingLine(ingredient);
  let index = ingredients.findIndex(
    (ingredient) => formatShoppingLine(ingredient) === text || withNotes(ingredient) === text
  );
  if (index < 0) index = ingredients.findIndex((ingredient) => sameName(ingredient, ingredient.name));

  let name: string | undefined;
  if (index >= 0) {
    name = translated[index].name;
  } else {
    // Otherwise the line may be an ingredient's halal swap, in any way that swap is written.
    const swaps = (at: number) => {
      const guess = detectNonHalal(
        [ingredients[at].name, english?.[at]?.name, arabic?.[at]?.name].filter((entry): entry is string => !!entry)
      );
      return [
        translated[at].suggested_alternative,
        ingredients[at].suggested_alternative,
        guess?.alternative[language],
        english?.[at]?.suggested_alternative,
        arabic?.[at]?.suggested_alternative,
        guess?.alternative.en,
        guess?.alternative.ar,
      ].filter((entry): entry is string => !!entry?.trim());
    };
    index = ingredients.findIndex((ingredient, at) => swaps(at).some((swap) => sameName(ingredient, swap)));
    if (index < 0) return text;
    name = swaps(index).find((swap) => isInLanguage(swap, language));
  }
  if (!isInLanguage(name, language)) return text;

  const ingredient = ingredients[index];
  return formatShoppingLine({
    quantity: ingredient.quantity,
    unit: getLocalizedUnitLabel(ingredient.unit, language),
    name: cleanLocalizedIngredientName(name, ingredient.quantity),
  });
}
