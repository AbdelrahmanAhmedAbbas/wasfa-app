import type {
  IngredientItem,
  RecipeDraft,
  SourcePlatform,
  StepItem,
} from "./types.ts";
import { isYouTubeShortHost, parseYouTubeShortId } from "./youtube.ts";

const SUPPORTED_HOSTS = [
  "instagram.com",
  "www.instagram.com",
  "instagr.am",
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
];

type FetchLike = (input: string, init?: RequestInit) => Promise<{ url?: string }>;

export function detectSourcePlatform(url: string): SourcePlatform {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("instagram")) return "instagram";
    if (host.includes("tiktok")) return "tiktok";
    if (isYouTubeShortHost(host)) return "youtube";
  } catch {
    return "unknown";
  }
  return "unknown";
}

export function normalizeSourceUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeTikTokVideoUrl(input: string): string | null {
  const normalized = normalizeSourceUrl(input);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    if (!host.includes("tiktok")) return normalized;
    if (/^\/@[^/]+\/video\/\d+\/?$/.test(url.pathname)) {
      url.search = "";
      url.hash = "";
    }
    return url.toString();
  } catch {
    return normalized;
  }
}

function isTikTokShareUrl(input: string): boolean {
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    return host === "vm.tiktok.com" || host === "vt.tiktok.com" || url.pathname.startsWith("/t/");
  } catch {
    return false;
  }
}

export async function resolveTikTokSourceUrl(
  sourceUrl: string,
  fetcher: FetchLike = fetch
): Promise<{ url: string; resolved: boolean }> {
  const originalUrl = normalizeTikTokVideoUrl(sourceUrl) ?? sourceUrl;
  if (!isTikTokShareUrl(originalUrl)) return { url: originalUrl, resolved: false };

  try {
    const response = await fetcher(originalUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (MealPlannerBot/1.0)",
      },
      redirect: "follow",
    });
    const resolvedUrl = response.url ? normalizeTikTokVideoUrl(response.url) : null;
    if (!resolvedUrl || !isSupportedSource(resolvedUrl) || detectSourcePlatform(resolvedUrl) !== "tiktok") {
      return { url: originalUrl, resolved: false };
    }
    return { url: resolvedUrl, resolved: resolvedUrl !== originalUrl };
  } catch {
    return { url: originalUrl, resolved: false };
  }
}

export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  // Shared text often wraps the link in a sentence; drop punctuation that trails it.
  return normalizeSourceUrl(match[0].replace(/[.,;:!?)\]}'"]+$/, ""));
}

export function isSupportedSource(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    // YouTube is supported for Shorts only, so the path decides, not the host.
    if (isYouTubeShortHost(host)) return parseYouTubeShortId(url) !== null;
    return SUPPORTED_HOSTS.some((supported) => host === supported || host.endsWith(`.${supported}`));
  } catch {
    return false;
  }
}

export function validateRecipeDraft(
  input: unknown,
  options: { requireMeasurements?: boolean } = {}
): RecipeDraft | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<RecipeDraft>;

  if (!candidate.title || typeof candidate.title !== "string") return null;
  if (!Array.isArray(candidate.ingredients) || !Array.isArray(candidate.steps)) return null;

  const ingredients: IngredientItem[] = candidate.ingredients
    .map((item) => sanitizeIngredient(item))
    .filter((item): item is IngredientItem => !!item);

  const steps: StepItem[] = candidate.steps
    .map((item, index) => sanitizeStep(item, index))
    .filter((item): item is StepItem => !!item);

  if (ingredients.length < 2 || steps.length < 2) return null;
  if (options.requireMeasurements !== false && ingredients.some((ingredient) => !isIngredientDetailComplete(ingredient))) {
    return null;
  }

  return {
    title: candidate.title.trim(),
    description: optionalString(candidate.description),
    cuisine: optionalString(candidate.cuisine) ?? "General",
    meal_type: optionalString(candidate.meal_type) ?? "Meal",
    servings: optionalPositiveInt(candidate.servings),
    prep_minutes: optionalPositiveInt(candidate.prep_minutes),
    cook_minutes: optionalPositiveInt(candidate.cook_minutes),
    ingredients,
    steps,
    nutrition_estimate: sanitizeNutrition(candidate.nutrition_estimate),
    source: {
      platform: candidate.source?.platform ?? "unknown",
      url: candidate.source?.url ?? "",
      language: optionalString(candidate.source?.language),
    },
    localized: sanitizeLocalized(candidate.localized),
  };
}

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

const QUANTITY_WITH_UNIT_PATTERN =
  /\b\d+(?:[./]\d+)?\s*(?:g|grams?|kg|oz|ounces?|lb|lbs|pounds?|ml|l|liters?|litres?|tsp|teaspoons?|tbsp|tablespoons?|cups?|slices?|pieces?|whole|cans?|packs?|cloves?|bunches?|pinches?|dashes?|splashes?|drops?|handfuls?|sticks?|heads?|sprigs?|leaves|leaf)\b/i;

function isIngredientDetailComplete(ingredient: Pick<IngredientItem, "quantity" | "unit" | "size">): boolean {
  const quantity = optionalString(ingredient.quantity) ?? "";
  const unit = optionalString(ingredient.unit)?.toLowerCase().replace(/\.$/, "") ?? "";
  const size = optionalString(ingredient.size) ?? "";

  if (quantity && unit && MEASURE_UNITS.has(unit)) return true;
  if (quantity && unit) return true;
  if (quantity && size) return true;
  if (quantity && QUANTITY_WITH_UNIT_PATTERN.test(quantity)) return true;
  if (size && QUANTITY_WITH_UNIT_PATTERN.test(size)) return true;
  return false;
}

function sanitizeIngredient(input: unknown): IngredientItem | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Partial<IngredientItem>;
  if (!item.name || typeof item.name !== "string") return null;
  const source = isIngredientSource(item.source) ? item.source : undefined;
  const confidence =
    typeof item.confidence === "number" && Number.isFinite(item.confidence)
      ? Math.min(1, Math.max(0, item.confidence))
      : undefined;
  const result: IngredientItem = {
    name: item.name.trim(),
    is_estimated: item.is_estimated === true,
  };
  const quantity = optionalString(item.quantity);
  const unit = optionalString(item.unit);
  const notes = optionalString(item.notes);
  const preparation = optionalString(item.preparation);
  const size = optionalString(item.size);
  const evidenceText = optionalString(item.evidence_text);
  const citationUrl = optionalString(item.citation_url);
  const dietaryFlags = optionalStringArray(item.dietary_flags);
  const allergenHints = optionalStringArray(item.allergen_hints);
  const halalConcern = optionalString(item.halal_concern);
  const suggestedAlternative = optionalString(item.suggested_alternative);
  if (quantity) result.quantity = quantity;
  if (unit) result.unit = unit;
  if (notes) result.notes = notes;
  if (preparation) result.preparation = preparation;
  if (size) result.size = size;
  if (dietaryFlags.length) result.dietary_flags = dietaryFlags;
  if (allergenHints.length) result.allergen_hints = allergenHints;
  if (typeof item.is_halal === "boolean") result.is_halal = item.is_halal;
  if (halalConcern) result.halal_concern = halalConcern;
  if (suggestedAlternative) result.suggested_alternative = suggestedAlternative;
  if (source) result.source = source;
  if (typeof confidence === "number") result.confidence = confidence;
  if (evidenceText) result.evidence_text = evidenceText;
  if (citationUrl) result.citation_url = citationUrl;
  if (typeof item.needs_review === "boolean") result.needs_review = item.needs_review;
  return result;
}

function isIngredientSource(value: unknown): value is NonNullable<IngredientItem["source"]> {
  return (
    value === "caption" ||
    value === "transcript" ||
    value === "web_research" ||
    value === "ai_estimate" ||
    value === "user_edit"
  );
}

function sanitizeStep(input: unknown, index: number): StepItem | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Partial<StepItem>;
  if (!item.text || typeof item.text !== "string") return null;
  const order =
    typeof item.order === "number" && Number.isFinite(item.order) && item.order > 0
      ? Math.trunc(item.order)
      : index + 1;
  const title = optionalString(item.title) ?? `Step ${order}`;
  const result: StepItem = {
    order,
    title,
    text: item.text.trim(),
    duration_minutes: optionalPositiveInt(item.duration_minutes),
  };
  const temperature = sanitizeTemperature(item.temperature);
  const equipment = optionalStringArray(item.equipment);
  const ingredientsUsed = optionalStringArray(item.ingredients_used);
  const tips = optionalStringArray(item.tips);
  if (temperature) result.temperature = temperature;
  if (equipment.length) result.equipment = equipment;
  if (ingredientsUsed.length) result.ingredients_used = ingredientsUsed;
  if (tips.length) result.tips = tips;
  return result;
}

function sanitizeTemperature(input: unknown): StepItem["temperature"] | undefined {
  if (!input || typeof input !== "object") return undefined;
  const item = input as Record<string, unknown>;
  if (typeof item.value !== "number" || !Number.isFinite(item.value)) return undefined;
  if (item.unit !== "C" && item.unit !== "F") return undefined;
  return {
    value: item.value,
    unit: item.unit,
  };
}

function sanitizeNutrition(input: unknown): RecipeDraft["nutrition_estimate"] | undefined {
  if (!input || typeof input !== "object") return undefined;
  const item = input as Record<string, unknown>;
  const confidence = typeof item.confidence === "number" ? item.confidence : 0.35;
  return {
    calories: optionalPositiveNumber(item.calories),
    protein_g: optionalPositiveNumber(item.protein_g),
    carbs_g: optionalPositiveNumber(item.carbs_g),
    fat_g: optionalPositiveNumber(item.fat_g),
    confidence: Math.min(1, Math.max(0, confidence)),
    disclaimer:
      typeof item.disclaimer === "string" && item.disclaimer.trim().length > 0
        ? item.disclaimer.trim()
        : "Estimated nutrition values only. Verify for medical or dietary use.",
    estimated: true,
  };
}

function sanitizeLocalized(input: unknown): RecipeDraft["localized"] | undefined {
  if (!input || typeof input !== "object") return undefined;
  const source = input as Record<string, unknown>;
  const result: NonNullable<RecipeDraft["localized"]> = {};

  for (const language of ["en", "ar"] as const) {
    const value = source[language];
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;

    const title = optionalString(item.title);
    const ingredientsRaw = Array.isArray(item.ingredients) ? item.ingredients : [];
    const stepsRaw = Array.isArray(item.steps) ? item.steps : [];
    if (!title || ingredientsRaw.length < 2 || stepsRaw.length < 2) continue;

    const ingredients = ingredientsRaw
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const ingredient = entry as Record<string, unknown>;
        const name = optionalString(ingredient.name);
        if (!name) return null;
        return {
          name,
          notes: optionalString(ingredient.notes),
        };
      })
      .filter((entry): entry is { name: string; notes?: string } => !!entry);

    const steps = stepsRaw
      .map((entry, index) => {
        if (!entry || typeof entry !== "object") return null;
        const step = entry as Record<string, unknown>;
        const text = optionalString(step.text);
        if (!text) return null;
        const order =
          typeof step.order === "number" && Number.isFinite(step.order)
            ? Math.max(1, Math.trunc(step.order))
            : index + 1;
        return {
          order,
          title: optionalString(step.title) ?? `Step ${order}`,
          text,
          duration_minutes: optionalPositiveInt(step.duration_minutes),
          temperature: sanitizeTemperature(step.temperature),
          equipment: optionalStringArray(step.equipment),
          ingredients_used: optionalStringArray(step.ingredients_used),
          tips: optionalStringArray(step.tips),
        };
      })
      .filter((entry): entry is StepItem => !!entry)
      .map((step) => ({
        ...step,
        equipment: step.equipment?.length ? step.equipment : undefined,
        ingredients_used: step.ingredients_used?.length ? step.ingredients_used : undefined,
        tips: step.tips?.length ? step.tips : undefined,
      }));

    if (ingredients.length < 2 || steps.length < 2) continue;

    result[language] = {
      title,
      description: optionalString(item.description),
      cuisine: optionalString(item.cuisine),
      meal_type: optionalString(item.meal_type),
      ingredients,
      steps,
    };
  }

  if (!result.en && !result.ar) return undefined;
  return result;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => optionalString(entry))
    .filter((entry): entry is string => !!entry);
}

function optionalPositiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const intValue = Math.trunc(value);
  return intValue > 0 ? intValue : undefined;
}

function optionalPositiveNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value >= 0 ? value : undefined;
}
