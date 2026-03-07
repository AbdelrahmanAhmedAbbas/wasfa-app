import type {
  IngredientItem,
  RecipeDraft,
  SourcePlatform,
  StepItem,
} from "./types.ts";

const SUPPORTED_HOSTS = [
  "instagram.com",
  "www.instagram.com",
  "instagr.am",
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
];

export function detectSourcePlatform(url: string): SourcePlatform {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("instagram")) return "instagram";
    if (host.includes("tiktok")) return "tiktok";
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

export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  return normalizeSourceUrl(match[0]);
}

export function isSupportedSource(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SUPPORTED_HOSTS.some((supported) => host === supported || host.endsWith(`.${supported}`));
  } catch {
    return false;
  }
}

export function validateRecipeDraft(input: unknown): RecipeDraft | null {
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

  return {
    title: candidate.title.trim(),
    description: optionalString(candidate.description),
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

function sanitizeIngredient(input: unknown): IngredientItem | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Partial<IngredientItem>;
  if (!item.name || typeof item.name !== "string") return null;
  return {
    name: item.name.trim(),
    quantity: optionalString(item.quantity),
    unit: optionalString(item.unit),
    notes: optionalString(item.notes),
  };
}

function sanitizeStep(input: unknown, index: number): StepItem | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Partial<StepItem>;
  if (!item.text || typeof item.text !== "string") return null;
  const order =
    typeof item.order === "number" && Number.isFinite(item.order) && item.order > 0
      ? Math.trunc(item.order)
      : index + 1;
  return {
    order,
    text: item.text.trim(),
    duration_minutes: optionalPositiveInt(item.duration_minutes),
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
        return { order, text };
      })
      .filter((entry): entry is { order: number; text: string } => !!entry);

    if (ingredients.length < 2 || steps.length < 2) continue;

    result[language] = {
      title,
      description: optionalString(item.description),
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

function optionalPositiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const intValue = Math.trunc(value);
  return intValue > 0 ? intValue : undefined;
}

function optionalPositiveNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value >= 0 ? value : undefined;
}
