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
  "جم",
  "غ",
  "جرام",
  "جرامات",
  "kg",
  "كجم",
  "كيلو",
  "كيلوغرام",
  "oz",
  "ounce",
  "ounces",
  "lb",
  "lbs",
  "pound",
  "pounds",
  "ml",
  "مل",
  "مليلتر",
  "l",
  "liter",
  "liters",
  "litre",
  "litres",
  "لتر",
  "tsp",
  "teaspoon",
  "teaspoons",
  "ملعقة صغيرة",
  "tbsp",
  "tablespoon",
  "tablespoons",
  "ملعقة كبيرة",
  "cup",
  "cups",
  "كوب",
  "أكواب",
  "slice",
  "slices",
  "شريحة",
  "شرائح",
  "piece",
  "pieces",
  "قطعة",
  "قطع",
  "whole",
  "حبة",
  "حبات",
  "can",
  "cans",
  "علبة",
  "علب",
  "pack",
  "packs",
  "عبوة",
  "عبوات",
  "clove",
  "cloves",
  "فص",
  "فصوص",
  "bunch",
  "bunches",
  "حزمة",
  "حزم",
  "pinch",
  "pinches",
  "رشة",
  "رشات",
  "dash",
  "dashes",
  "قليل",
  "splash",
  "splashes",
  "drop",
  "drops",
  "قطرة",
  "قطرات",
  "handful",
  "handfuls",
  "حفنة",
  "حفنات",
  "stick",
  "sticks",
  "عود",
  "أعواد",
  "head",
  "heads",
  "رأس",
  "رؤوس",
  "sprig",
  "sprigs",
  "غصن",
  "أغصان",
  "leaf",
  "leaves",
  "ورقة",
  "أوراق",
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

// Arabic units as creators write and say them, mapped to the English unit the app
// stores. The app shows the stored unit in the reader's language, and converts and
// scales amounts by it, so an Arabic unit left as typed would do neither.
const ARABIC_UNITS: Record<string, string> = {
  "جم": "g",
  "غ": "g",
  "غم": "g",
  "جرام": "g",
  "جرامات": "g",
  "غرام": "g",
  "غرامات": "g",
  "كجم": "kg",
  "كغ": "kg",
  "كغم": "kg",
  "كيلو": "kg",
  "كيلوجرام": "kg",
  "كيلوغرام": "kg",
  "مل": "ml",
  "ملل": "ml",
  "مليلتر": "ml",
  "ملليلتر": "ml",
  "لتر": "l",
  "ليتر": "l",
  "ملعقة صغيرة": "tsp",
  "معلقة صغيرة": "tsp",
  "ملاعق صغيرة": "tsp",
  "معالق صغيرة": "tsp",
  "ملعقة شاي": "tsp",
  "معلقة شاي": "tsp",
  "ملعقة كبيرة": "tbsp",
  "معلقة كبيرة": "tbsp",
  "ملاعق كبيرة": "tbsp",
  "معالق كبيرة": "tbsp",
  "ملعقة طعام": "tbsp",
  "ملعقة أكل": "tbsp",
  "معلقة أكل": "tbsp",
  "كوب": "cup",
  "كوباية": "cup",
  "أكواب": "cup",
  "كاسة": "cup",
  "كأس": "cup",
  "شريحة": "slice",
  "شرائح": "slice",
  "قطعة": "piece",
  "قطع": "piece",
  "حبة": "whole",
  "حبات": "whole",
  "علبة": "can",
  "علب": "can",
  "عبوة": "pack",
  "عبوات": "pack",
  "كيس": "pack",
  "باكيت": "pack",
  "فص": "clove",
  "فصوص": "clove",
  "حزمة": "bunch",
  "حزم": "bunch",
  "ربطة": "bunch",
  "رشة": "pinch",
  "رشات": "pinch",
  "قطرة": "drop",
  "قطرات": "drop",
  "حفنة": "handful",
  "حفنات": "handful",
  "عود": "stick",
  "أعواد": "stick",
  "رأس": "head",
  "رؤوس": "head",
  "غصن": "sprig",
  "أغصان": "sprig",
  "ورقة": "leaf",
  "أوراق": "leaf",
};

/** Folds the spelling differences Arabic text has for one word: hamza forms, ta marbuta, diacritics. */
function foldArabic(value: string): string {
  return value
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

const ARABIC_UNIT_LOOKUP = new Map(
  Object.entries(ARABIC_UNITS).map(([arabic, unit]) => [foldArabic(arabic), unit])
);

export function normalizeUnit(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (UNIT_NORMALIZATION[trimmed]) return UNIT_NORMALIZATION[trimmed];
  const stripped = trimmed.replace(/\.$/, "");
  if (UNIT_NORMALIZATION[stripped]) return UNIT_NORMALIZATION[stripped];
  const arabicUnit = ARABIC_UNIT_LOOKUP.get(foldArabic(stripped));
  if (arabicUnit) return arabicUnit;
  if (MEASURE_UNITS.has(stripped)) return stripped;
  return trimmed;
}

const UNICODE_FRACTIONS: Record<string, string> = {
  "½": "1/2",
  "⅓": "1/3",
  "⅔": "2/3",
  "¼": "1/4",
  "¾": "3/4",
  "⅛": "1/8",
};

/**
 * Rewrites an amount with Western digits, which is what the app can scale and convert:
 * Arabic-Indic and Persian digits, the Arabic decimal mark and one-character fractions.
 */
export function normalizeQuantity(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/٬/g, "")
    .replace(/(\d)?([½⅓⅔¼¾⅛])/g, (_match, whole, fraction) =>
      whole ? `${whole} ${UNICODE_FRACTIONS[fraction]}` : UNICODE_FRACTIONS[fraction]
    )
    .trim()
    .replace(/\s+/g, " ");
}

const QUANTITY_WITH_UNIT_PATTERN =
  /(?<![\p{L}\p{N}])[\d٠-٩]+(?:[./][\d٠-٩]+)?\s*(?:g|grams?|جم|غ|جرام(?:ات)?|kg|كجم|كيلو(?:غرام)?|oz|ounces?|lb|lbs|pounds?|ml|مل|مليلتر|l|liters?|litres?|لتر|tsp|teaspoons?|ملعقة صغيرة|tbsp|tablespoons?|ملعقة كبيرة|cups?|كوب|أكواب|slices?|شرائح?|pieces?|قطع(?:ة)?|whole|حبات?|cans?|علب(?:ة)?|packs?|عبوات?|cloves?|فصوص?|bunches?|حزم(?:ة)?|pinches?|رشات?|dashes?|قليل|splashes?|drops?|قطرات?|handfuls?|حفنات?|sticks?|أعواد|heads?|رؤوس|sprigs?|أغصان|leaves|leaf|أوراق|ورقة)(?![\p{L}\p{N}])/iu;

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalString(value: unknown): string | undefined {
  return hasText(value) ? value.trim() : undefined;
}

export function normalizeIngredientKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(cooked|diced|chopped|minced|sliced|fresh|frozen|raw)\b/g, "")
    .replace(/(?:^|\s)(مطبوخ|مفروم|مقطع|مشرّح|مشرح|طازج|مجمد|نيء|مسلوق)(?=\s|$)/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
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
  // The diet and halal findings ride along with the ingredient; the app's allergy
  // warnings and halal swaps read them.
  if (ingredient.dietary_flags?.length) result.dietary_flags = ingredient.dietary_flags;
  if (ingredient.allergen_hints?.length) result.allergen_hints = ingredient.allergen_hints;
  if (typeof ingredient.is_halal === "boolean") result.is_halal = ingredient.is_halal;
  if (optionalString(ingredient.halal_concern)) result.halal_concern = optionalString(ingredient.halal_concern);
  if (optionalString(ingredient.suggested_alternative)) {
    result.suggested_alternative = optionalString(ingredient.suggested_alternative);
  }
  if (ingredient.use_original === true) result.use_original = true;
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
