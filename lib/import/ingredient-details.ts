import type { IngredientItem } from "./types";

const MEASURE_UNITS = new Set([
  "g",
  "gram",
  "grams",
  "kg",
  "oz",
  "ounce",
  "ounces",
  "lb",
  "lbs",
  "pound",
  "pounds",
  "ml",
  "l",
  "liter",
  "liters",
  "litre",
  "litres",
  "tsp",
  "teaspoon",
  "teaspoons",
  "tbsp",
  "tablespoon",
  "tablespoons",
  "cup",
  "cups",
  "slice",
  "slices",
  "piece",
  "pieces",
  "whole",
  "can",
  "cans",
  "pack",
  "packs",
  "clove",
  "cloves",
  "bunch",
  "bunches",
]);

const QUANTITY_WITH_UNIT_PATTERN =
  /\b\d+(?:[./]\d+)?\s*(?:g|grams?|kg|oz|ounces?|lb|lbs|pounds?|ml|l|liters?|litres?|tsp|teaspoons?|tbsp|tablespoons?|cups?|slices?|pieces?|whole|cans?|packs?|cloves?|bunches?)\b/i;

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isIngredientDetailComplete(ingredient: Pick<IngredientItem, "quantity" | "unit" | "size">): boolean {
  const quantity = hasText(ingredient.quantity) ? ingredient.quantity.trim() : "";
  const unit = hasText(ingredient.unit) ? ingredient.unit.trim().toLowerCase() : "";
  const size = hasText(ingredient.size) ? ingredient.size.trim() : "";

  if (quantity && unit && MEASURE_UNITS.has(unit)) return true;
  if (quantity && size) return true;
  if (quantity && QUANTITY_WITH_UNIT_PATTERN.test(quantity)) return true;
  if (size && QUANTITY_WITH_UNIT_PATTERN.test(size)) return true;
  return false;
}

export function markIngredientReviewState<T extends IngredientItem>(ingredient: T): T {
  return {
    ...ingredient,
    needs_review: !isIngredientDetailComplete(ingredient),
  };
}

export function hasIngredientsNeedingReview(ingredients: IngredientItem[]): boolean {
  return ingredients.some((ingredient) => !isIngredientDetailComplete(ingredient));
}
