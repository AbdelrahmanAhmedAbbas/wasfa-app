import type { IngredientItem } from "./types.ts";

const SOURCE_PRIORITY: Record<NonNullable<IngredientItem["source"]>, number> = {
  web_research: 1,
  ai_estimate: 1,
  transcript: 2,
  caption: 3,
  user_edit: 5,
};

export const MEASURE_UNITS = new Set([
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
  "pinch",
  "pinches",
  "dash",
  "dashes",
  "splash",
  "splashes",
  "drop",
  "drops",
  "handful",
  "handfuls",
  "stick",
  "sticks",
  "head",
  "heads",
  "sprig",
  "sprigs",
  "leaf",
  "leaves",
]);

const UNIT_NORMALIZATION: Record<string, string> = {
  "tbsp.": "tbsp",
  "tbs": "tbsp",
  "tbs.": "tbsp",
  "tsp.": "tsp",
  "ts": "tsp",
  "ts.": "tsp",
  "fl oz": "oz",
  "fl. oz": "oz",
  "fl. oz.": "oz",
  "fl-oz": "oz",
  "gr": "g",
  "gr.": "g",
  "gm": "g",
  "gms": "g",
  "kgs": "kg",
  "lb.": "lb",
  "lbs.": "lbs",
  "ml.": "ml",
  "mls": "ml",
  "l.": "l",
};

export function normalizeUnit(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (UNIT_NORMALIZATION[trimmed]) return UNIT_NORMALIZATION[trimmed];
  const stripped = trimmed.replace(/\.$/, "");
  if (UNIT_NORMALIZATION[stripped]) return UNIT_NORMALIZATION[stripped];
  if (MEASURE_UNITS.has(stripped)) return stripped;
  return trimmed;
}

const QUANTITY_WITH_UNIT_PATTERN =
  /\b\d+(?:[./]\d+)?\s*(?:g|grams?|kg|oz|ounces?|lb|lbs|pounds?|ml|l|liters?|litres?|tsp|teaspoons?|tbsp|tablespoons?|cups?|slices?|pieces?|whole|cans?|packs?|cloves?|bunches?|pinches?|dashes?|splashes?|drops?|handfuls?|sticks?|heads?|sprigs?|leaves|leaf)\b/i;

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalString(value: unknown): string | undefined {
  return hasText(value) ? value.trim() : undefined;
}

function normalizeIngredientKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(cooked|diced|chopped|minced|sliced|fresh|frozen|raw)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function sourcePriority(source: IngredientItem["source"]): number {
  return source ? SOURCE_PRIORITY[source] : 0;
}

function hasWebEvidence(ingredient: IngredientItem): boolean {
  if (ingredient.source !== "web_research") return true;
  return hasText(ingredient.evidence_text) && hasText(ingredient.citation_url);
}

export function isIngredientDetailComplete(
  ingredient: Pick<IngredientItem, "quantity" | "unit" | "size">
): boolean {
  const quantity = optionalString(ingredient.quantity) ?? "";
  const unit = normalizeUnit(ingredient.unit);
  const size = optionalString(ingredient.size) ?? "";

  if (quantity && unit && MEASURE_UNITS.has(unit)) return true;
  if (quantity && unit) return true;
  if (quantity && size) return true;
  if (quantity && QUANTITY_WITH_UNIT_PATTERN.test(quantity)) return true;
  if (size && QUANTITY_WITH_UNIT_PATTERN.test(size)) return true;
  return false;
}

export function markIngredientReviewState<T extends IngredientItem>(ingredient: T): T {
  return compactIngredient({
    ...ingredient,
    needs_review: !isIngredientDetailComplete(ingredient),
    is_estimated: ingredient.is_estimated === true || ingredient.source === "web_research" || ingredient.source === "ai_estimate",
  }) as T;
}

export function markIngredientReviewStates<T extends IngredientItem>(ingredients: T[]): T[] {
  return ingredients.map((ingredient) => markIngredientReviewState(ingredient));
}

function mergeIngredient(existing: IngredientItem, incoming: IngredientItem): IngredientItem {
  const incomingHasDetails = isIngredientDetailComplete(incoming);
  const existingHasDetails = isIngredientDetailComplete(existing);
  const shouldPreferIncoming =
    incomingHasDetails && (!existingHasDetails || sourcePriority(incoming.source) > sourcePriority(existing.source));

  if (!shouldPreferIncoming) {
    return markIngredientReviewState(existing);
  }

  return markIngredientReviewState({
    ...existing,
    name: optionalString(incoming.name) ?? existing.name,
    quantity: optionalString(incoming.quantity) ?? existing.quantity,
    unit: optionalString(incoming.unit) ?? existing.unit,
    size: optionalString(incoming.size) ?? existing.size,
    preparation: optionalString(incoming.preparation) ?? existing.preparation,
    notes: optionalString(incoming.notes) ?? existing.notes,
    source: incoming.source ?? existing.source,
    confidence: incoming.confidence ?? existing.confidence,
    evidence_text: optionalString(incoming.evidence_text) ?? existing.evidence_text,
    citation_url: optionalString(incoming.citation_url) ?? existing.citation_url,
  });
}

function compactIngredient(ingredient: IngredientItem): IngredientItem {
  const result: IngredientItem = {
    name: ingredient.name,
  };
  if (optionalString(ingredient.quantity)) result.quantity = optionalString(ingredient.quantity);
  if (optionalString(ingredient.unit)) result.unit = optionalString(ingredient.unit);
  if (optionalString(ingredient.notes)) result.notes = optionalString(ingredient.notes);
  if (optionalString(ingredient.preparation)) result.preparation = optionalString(ingredient.preparation);
  if (optionalString(ingredient.size)) result.size = optionalString(ingredient.size);
  if (ingredient.source) result.source = ingredient.source;
  if (typeof ingredient.confidence === "number") result.confidence = ingredient.confidence;
  if (optionalString(ingredient.evidence_text)) result.evidence_text = optionalString(ingredient.evidence_text);
  if (optionalString(ingredient.citation_url)) result.citation_url = optionalString(ingredient.citation_url);
  if (typeof ingredient.needs_review === "boolean") result.needs_review = ingredient.needs_review;
  if (ingredient.is_estimated === true) result.is_estimated = true;
  return result;
}

export function mergeIngredientSources(ingredients: IngredientItem[]): IngredientItem[] {
  const merged: IngredientItem[] = [];

  for (const ingredient of ingredients) {
    if (!hasWebEvidence(ingredient)) continue;
    const key = normalizeIngredientKey(ingredient.name);
    const index = merged.findIndex((entry) => normalizeIngredientKey(entry.name) === key);
    if (index === -1) {
      merged.push(markIngredientReviewState(ingredient));
      continue;
    }
    merged[index] = mergeIngredient(merged[index], ingredient);
  }

  return markIngredientReviewStates(merged);
}

export function hasIngredientsNeedingReview(ingredients: IngredientItem[]): boolean {
  return ingredients.some((ingredient) => !isIngredientDetailComplete(ingredient));
}
