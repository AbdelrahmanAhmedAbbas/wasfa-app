import { generateObject } from "npm:ai@4.1.56";
import { createOpenAI } from "npm:@ai-sdk/openai@1.3.23";
import { z } from "npm:zod@3.24.2";

import type { NutritionEstimate, RecipeDraft, SourcePlatform } from "./types.ts";
import { validateRecipeDraft } from "./validation.ts";

type ExtractResult = {
  draft: RecipeDraft;
  confidence: Record<string, unknown>;
  provider: "openrouter";
  model: string;
};

type RecipeInput = {
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  sourceText: string;
};

const GEMINI_PARSER_MODEL = "google/gemini-2.0-flash-001";
const GEMINI_TRANSLATE_MODEL = "google/gemini-2.0-flash-001";
const GEMINI_NUTRITION_MODEL = "google/gemini-2.0-flash-001";

const defaultNutritionDisclaimer =
  "Estimated nutrition values only. Verify with a certified nutrition source before medical use.";

const recipeObjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  servings: z.number().nullable().optional(),
  prep_minutes: z.number().nullable().optional(),
  cook_minutes: z.number().nullable().optional(),
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.string().nullable().optional(),
      unit: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    })
  ),
  steps: z.array(
    z.object({
      order: z.number().int().positive().optional(),
      text: z.string().min(1),
      duration_minutes: z.number().nullable().optional(),
    })
  ),
  source: z.object({
    platform: z.enum(["instagram", "tiktok", "unknown"]).optional(),
    url: z.string().min(1).optional(),
    language: z.string().nullable().optional(),
  }),
});

const nutritionObjectSchema = z.object({
  calories: z.number().nullable().optional(),
  protein_g: z.number().nullable().optional(),
  carbs_g: z.number().nullable().optional(),
  fat_g: z.number().nullable().optional(),
  confidence: z.number().min(0).max(1),
  disclaimer: z.string().min(1),
});

const localizedTextSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      notes: z.string().nullable().optional(),
    })
  ),
  steps: z.array(
    z.object({
      order: z.number().int().positive(),
      text: z.string().min(1),
    })
  ),
});

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env variable: ${name}`);
  return value;
}

function buildExtractionPrompt(input: RecipeInput): string {
  return `Extract a cooking recipe from the provided video source context.
Rules:
- Return only recipe information in the requested schema.
- Infer servings, ingredient quantities, and ordered steps from transcript + caption + metadata context.
- Preserve original language wording where possible.
- If unknown, use null.
Source URL: ${input.sourceUrl}
Source platform: ${input.sourcePlatform}
Combined context:
${input.sourceText}`;
}

function buildNutritionPrompt(draft: RecipeDraft): string {
  return `Estimate nutrition for this recipe.
Rules:
- Use conservative estimates.
- Confidence must be between 0 and 1.
- Include a short disclaimer.
Recipe title: ${draft.title}
Servings: ${draft.servings ?? "unknown"}
Ingredients:
${draft.ingredients
  .map((ingredient) => `${ingredient.quantity ?? ""} ${ingredient.unit ?? ""} ${ingredient.name}`.trim())
  .join("\n")}
`;
}

function buildLocalizationPrompt(draft: RecipeDraft, targetLanguage: "en" | "ar"): string {
  const targetLabel = targetLanguage === "ar" ? "Arabic" : "English";
  return `Translate this recipe into ${targetLabel}.
Rules:
- Preserve culinary meaning and order.
- Keep ingredient quantities and units semantically consistent.
- Keep the same ingredient and step count.
Recipe:
Title: ${draft.title}
Description: ${draft.description ?? ""}
Ingredients:
${draft.ingredients
  .map((ingredient, index) =>
    `${index + 1}. ${ingredient.quantity ?? ""} ${ingredient.unit ?? ""} ${ingredient.name} ${ingredient.notes ?? ""}`.trim()
  )
  .join("\n")}
Steps:
${draft.steps.map((step) => `${step.order}. ${step.text}`).join("\n")}
`;
}

function createOpenRouterClient() {
  const apiKey = requiredEnv("OPENROUTER_API_KEY");
  return createOpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      "HTTP-Referer": "https://meal-planner.app",
      "X-Title": "Meal Planner Import",
    },
  });
}

function optionalString(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalPositiveInt(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const intValue = Math.trunc(value);
  return intValue > 0 ? intValue : undefined;
}

function optionalPositiveNumber(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value >= 0 ? value : undefined;
}

function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function getSourceRecipeLanguage(draft: RecipeDraft): "en" | "ar" {
  if (draft.source.language) {
    return draft.source.language.toLowerCase().startsWith("ar") ? "ar" : "en";
  }
  const sample = `${draft.title} ${draft.steps.map((step) => step.text).join(" ")}`;
  return containsArabic(sample) ? "ar" : "en";
}

function toLocalizedTextFromDraft(draft: RecipeDraft): NonNullable<RecipeDraft["localized"]>["en"] {
  return {
    title: draft.title,
    description: draft.description,
    ingredients: draft.ingredients.map((item) => ({
      name: item.name,
      notes: item.notes,
    })),
    steps: draft.steps.map((step) => ({
      order: step.order,
      text: step.text,
    })),
  };
}

function cloneLocalizedText(
  value: NonNullable<RecipeDraft["localized"]>["en"]
): NonNullable<RecipeDraft["localized"]>["en"] {
  return {
    title: value.title,
    description: value.description,
    ingredients: value.ingredients.map((item) => ({
      name: item.name,
      notes: item.notes,
    })),
    steps: value.steps.map((step) => ({
      order: step.order,
      text: step.text,
    })),
  };
}

function normalizeRecipeCandidate(
  candidate: z.infer<typeof recipeObjectSchema>,
  input: RecipeInput
): RecipeDraft | null {
  const normalized = {
    title: candidate.title,
    description: optionalString(candidate.description),
    servings: optionalPositiveInt(candidate.servings),
    prep_minutes: optionalPositiveInt(candidate.prep_minutes),
    cook_minutes: optionalPositiveInt(candidate.cook_minutes),
    ingredients: candidate.ingredients.map((item) => ({
      name: item.name.trim(),
      quantity: optionalString(item.quantity),
      unit: optionalString(item.unit),
      notes: optionalString(item.notes),
    })),
    steps: candidate.steps.map((item, index) => ({
      order: item.order ?? index + 1,
      text: item.text.trim(),
      duration_minutes: optionalPositiveInt(item.duration_minutes),
    })),
    source: {
      platform: input.sourcePlatform,
      url: input.sourceUrl,
      language: optionalString(candidate.source.language),
    },
  };

  return validateRecipeDraft(normalized);
}

async function translateRecipeText(
  modelName: string,
  draft: RecipeDraft,
  targetLanguage: "en" | "ar"
) {
  const providerClient = createOpenRouterClient();
  const model = providerClient(modelName);

  const { object } = await generateObject({
    model,
    schema: localizedTextSchema,
    temperature: 0.2,
    system:
      "You are a culinary translator. Keep recipe accuracy and preserve list lengths/order.",
    prompt: buildLocalizationPrompt(draft, targetLanguage),
  });

  if (
    object.ingredients.length !== draft.ingredients.length ||
    object.steps.length !== draft.steps.length
  ) {
    throw new Error("LOCALIZATION_SHAPE_MISMATCH");
  }

  return {
    title: object.title.trim(),
    description: optionalString(object.description),
    ingredients: object.ingredients.map((ingredient) => ({
      name: ingredient.name.trim(),
      notes: optionalString(ingredient.notes),
    })),
    steps: object.steps.map((step, index) => ({
      order: step.order || index + 1,
      text: step.text.trim(),
    })),
  };
}

async function buildBilingualLocalization(
  draft: RecipeDraft
): Promise<NonNullable<RecipeDraft["localized"]>> {
  const sourceLanguage = getSourceRecipeLanguage(draft);
  const sourceText = toLocalizedTextFromDraft(draft);
  const targetLanguage: "en" | "ar" = sourceLanguage === "en" ? "ar" : "en";
  const localized: NonNullable<RecipeDraft["localized"]> = {
    en: cloneLocalizedText(sourceText),
    ar: cloneLocalizedText(sourceText),
  };

  try {
    localized[targetLanguage] = await translateRecipeText(
      GEMINI_TRANSLATE_MODEL,
      draft,
      targetLanguage
    );
  } catch {
    // If translation fails, both localized blocks are still present by design.
  }

  return localized;
}

export async function extractRecipe(input: RecipeInput): Promise<ExtractResult> {
  const providerClient = createOpenRouterClient();
  const model = providerClient(GEMINI_PARSER_MODEL);

  const { object } = await generateObject({
    model,
    schema: recipeObjectSchema,
    temperature: 0.2,
    system:
      "You are a recipe extraction engine. Return accurate recipe objects and avoid hallucinations.",
    prompt: buildExtractionPrompt(input),
  });

  const draft = normalizeRecipeCandidate(object, input);
  if (!draft) throw new Error("Generated recipe did not pass validation constraints.");

  draft.localized = await buildBilingualLocalization(draft);

  return {
    draft,
    confidence: {
      provider: "openrouter",
      model: GEMINI_PARSER_MODEL,
      extraction_mode: "schema",
    },
    provider: "openrouter",
    model: GEMINI_PARSER_MODEL,
  };
}

export async function estimateNutrition(
  draft: RecipeDraft
): Promise<NutritionEstimate> {
  const providerClient = createOpenRouterClient();
  const model = providerClient(GEMINI_NUTRITION_MODEL);

  try {
    const { object } = await generateObject({
      model,
      schema: nutritionObjectSchema,
      temperature: 0.2,
      system:
        "You estimate recipe nutrition conservatively. Never claim medical precision and always include a disclaimer.",
      prompt: buildNutritionPrompt(draft),
    });

    return {
      calories: optionalPositiveNumber(object.calories),
      protein_g: optionalPositiveNumber(object.protein_g),
      carbs_g: optionalPositiveNumber(object.carbs_g),
      fat_g: optionalPositiveNumber(object.fat_g),
      confidence: Math.min(1, Math.max(0, object.confidence)),
      disclaimer: optionalString(object.disclaimer) ?? defaultNutritionDisclaimer,
      estimated: true,
    };
  } catch {
    return {
      confidence: 0.2,
      disclaimer: defaultNutritionDisclaimer,
      estimated: true,
    };
  }
}
