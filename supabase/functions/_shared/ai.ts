import { generateObject } from "npm:ai@4.1.56";
import { createOpenAI } from "npm:@ai-sdk/openai@1.3.23";
import { z } from "npm:zod@3.24.2";

import type {
  IngredientItem,
  LocalizedRecipeText,
  NutritionEstimate,
  RecipeDraft,
  SourcePlatform,
} from "./types.ts";
import {
  hasIngredientsNeedingReview,
  isIngredientDetailComplete,
  markIngredientReviewStates,
  MEASURE_UNITS,
  mergeIngredientSources,
  normalizeUnit,
} from "./ingredient-details.ts";
import { linkStepIngredients } from "./step-rewriter.ts";
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

type IngredientResearchResult = {
  ingredients: IngredientItem[];
  citations: string[];
  model: string;
};

const EXTRACTION_MODELS = [
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-haiku-4.5",
  "google/gemini-3-flash-preview",
];
const GEMINI_PARSER_MODEL = "google/gemini-3-flash-preview";
const ENGLISH_CONTENT_MODELS = [
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-sonnet-4.6",
  "google/gemini-3-flash-preview",
];
const ARABIC_CONTENT_MODELS = [
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-haiku-4.5",
  "google/gemini-3-flash-preview",
];
const GEMINI_NUTRITION_MODEL = "google/gemini-3-flash-preview";
const WEB_RESEARCH_MODEL = "google/gemini-2.5-pro";
const OPENROUTER_TIMEOUT_MS = 90_000;

const defaultNutritionDisclaimer =
  "Estimated nutrition values only. Verify with a certified nutrition source before medical use.";

const recipeObjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  cuisine: z.string().nullable().optional(),
  meal_type: z.string().nullable().optional(),
  servings: z.number().nullable().optional(),
  prep_minutes: z.number().nullable().optional(),
  cook_minutes: z.number().nullable().optional(),
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.string().nullable().optional(),
      unit: z.string().nullable().optional(),
      preparation: z.string().nullable().optional(),
      size: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      dietary_flags: z.array(z.string()).nullable().optional(),
      allergen_hints: z.array(z.string()).nullable().optional(),
      is_halal: z.boolean().nullable().optional(),
      halal_concern: z.string().nullable().optional(),
      suggested_alternative: z.string().nullable().optional(),
      source: z.enum(["caption", "transcript", "web_research", "ai_estimate", "user_edit"]).nullable().optional(),
      confidence: z.number().min(0).max(1).nullable().optional(),
      evidence_text: z.string().nullable().optional(),
      citation_url: z.string().nullable().optional(),
      is_estimated: z.boolean().nullable().optional(),
    })
  ),
  steps: z.array(
    z.object({
      order: z.number().int().positive().optional(),
      title: z.string().nullable().optional(),
      text: z.string().min(1),
      duration_minutes: z.number().nullable().optional(),
      temperature: z
        .object({
          value: z.number(),
          unit: z.enum(["C", "F"]),
        })
        .nullable()
        .optional(),
      equipment: z.array(z.string()).nullable().optional(),
      ingredients_used: z.array(z.string()).nullable().optional(),
      tips: z.array(z.string()).nullable().optional(),
    })
  ),
  source: z.object({
    platform: z.enum(["instagram", "tiktok", "youtube", "unknown"]).optional(),
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
  cuisine: z.string().nullable().optional(),
  meal_type: z.string().nullable().optional(),
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      notes: z.string().nullable().optional(),
    })
  ),
  steps: z.array(
    z.object({
      order: z.number().int().positive(),
      title: z.string().nullable().optional(),
      text: z.string().min(1),
      duration_minutes: z.number().nullable().optional(),
      temperature: z
        .object({
          value: z.number(),
          unit: z.enum(["C", "F"]),
        })
        .nullable()
        .optional(),
      equipment: z.array(z.string()).nullable().optional(),
      ingredients_used: z.array(z.string()).nullable().optional(),
      tips: z.array(z.string()).nullable().optional(),
    })
  ),
});

const missingDetailsSchema = z.object({
  description: z.string().nullable().optional(),
  prep_minutes: z.number().nullable().optional(),
  cook_minutes: z.number().nullable().optional(),
});

const servingRecalculationSchema = z.object({
  servings: z.number().int().positive(),
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.string().nullable().optional(),
      unit: z.string().nullable().optional(),
      preparation: z.string().nullable().optional(),
      size: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      dietary_flags: z.array(z.string()).nullable().optional(),
      allergen_hints: z.array(z.string()).nullable().optional(),
      is_halal: z.boolean().nullable().optional(),
      halal_concern: z.string().nullable().optional(),
      suggested_alternative: z.string().nullable().optional(),
      source: z.enum(["caption", "transcript", "web_research", "ai_estimate", "user_edit"]).nullable().optional(),
      confidence: z.number().min(0).max(1).nullable().optional(),
      evidence_text: z.string().nullable().optional(),
      citation_url: z.string().nullable().optional(),
      needs_review: z.boolean().nullable().optional(),
      is_estimated: z.boolean().nullable().optional(),
    })
  ),
  steps: z.array(
    z.object({
      order: z.number().int().positive().optional(),
      title: z.string().nullable().optional(),
      text: z.string().min(1),
      duration_minutes: z.number().nullable().optional(),
      temperature: z
        .object({
          value: z.number(),
          unit: z.enum(["C", "F"]),
        })
        .nullable()
        .optional(),
      equipment: z.array(z.string()).nullable().optional(),
      ingredients_used: z.array(z.string()).nullable().optional(),
      tips: z.array(z.string()).nullable().optional(),
    })
  ),
});

const localizedStepRewriteSchema = z.object({
  en: z.object({ steps: localizedTextSchema.shape.steps }),
  ar: z.object({ steps: localizedTextSchema.shape.steps }),
});

const ingredientResearchSchema = z.object({
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.string().nullable().optional(),
      unit: z.string().nullable().optional(),
      preparation: z.string().nullable().optional(),
      size: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      confidence: z.number().min(0).max(1).nullable().optional(),
      evidence_text: z.string().nullable().optional(),
      citation_url: z.string().nullable().optional(),
    })
  ),
  citations: z.array(z.string()).optional(),
});

const forcedIngredientMeasurementSchema = z.object({
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.string().min(1),
      unit: z.string().min(1),
      preparation: z.string().nullable().optional(),
      size: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      confidence: z.number().min(0).max(1).nullable().optional(),
    })
  ),
});

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env variable: ${name}`);
  return value;
}

function truncateForPrompt(value: string, max = 6000): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

function truncateForLog(value: string, max = 800): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

async function withAbortTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs = OPENROUTER_TIMEOUT_MS,
  upstreamSignal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const onAbort = () => controller.abort(upstreamSignal?.reason ?? new Error("OPENROUTER_ABORTED"));

  if (upstreamSignal) {
    if (upstreamSignal.aborted) onAbort();
    else upstreamSignal.addEventListener("abort", onAbort, { once: true });
  }

  const timeoutId = setTimeout(() => {
    controller.abort(new Error("OPENROUTER_TIMEOUT"));
  }, timeoutMs);

  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timeoutId);
    if (upstreamSignal) upstreamSignal.removeEventListener("abort", onAbort);
  }
}

function parseJsonLenient(raw: string): unknown {
  const normalized = raw.trim().replace(/^\uFEFF/, "").replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(normalized);
  } catch {
    const firstObject = normalized.indexOf("{");
    const firstArray = normalized.indexOf("[");
    const firstIndex =
      firstObject === -1
        ? firstArray
        : firstArray === -1
          ? firstObject
          : Math.min(firstObject, firstArray);
    if (firstIndex === -1) throw new Error("OPENROUTER_JSON_NOT_FOUND");
    const lastObject = normalized.lastIndexOf("}");
    const lastArray = normalized.lastIndexOf("]");
    const lastIndex = Math.max(lastObject, lastArray);
    if (lastIndex <= firstIndex) throw new Error("OPENROUTER_JSON_NOT_FOUND");
    return JSON.parse(normalized.slice(firstIndex, lastIndex + 1));
  }
}

async function openRouterChatCompletion(
  body: Record<string, unknown>,
  options: { abortSignal?: AbortSignal; timeoutMs?: number } = {}
): Promise<string> {
  const apiKey = requiredEnv("OPENROUTER_API_KEY");
  const response = await withAbortTimeout(
    (abortSignal) =>
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://meal-planner.app",
          "X-Title": "Meal Planner Import",
        },
        body: JSON.stringify(body),
        signal: abortSignal,
      }),
    options.timeoutMs,
    options.abortSignal
  );

  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(`OPENROUTER_CHAT_FAILED ${response.status} ${truncateForLog(rawBody)}`);
  }

  let data: { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }> };
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error(`OPENROUTER_CHAT_INVALID_JSON ${truncateForLog(rawBody)}`);
  }

  const messageContent = data.choices?.[0]?.message?.content;
  const content =
    typeof messageContent === "string"
      ? messageContent.trim()
      : Array.isArray(messageContent)
        ? messageContent.map((entry) => entry.text).filter(Boolean).join("\n").trim()
        : "";
  if (!content) throw new Error("OPENROUTER_CHAT_EMPTY");
  return content;
}

function buildExtractionPrompt(input: RecipeInput): string {
  return `Extract a cooking recipe from the provided video source context.
Rules:
- Return only recipe information in the requested schema.
- Include cuisine and meal_type. Use cuisine="General" and meal_type="Meal" only when the source is unclear.
- Infer servings, ingredient quantities, and ordered steps from transcript + caption + metadata + video OCR context.
- Ingredient names alone are incomplete. For each ingredient, preserve exact quantity/unit/size details such as 150 g, 2 tbsp, 3 slices, 1 piece, 1 whole, 500 ml, 1 can, 2 cloves, etc.
- Put preparation details like cooked, diced, chopped, or sliced in preparation, not in the ingredient name when possible.
- For each ingredient, include allergen_hints when obvious (dairy, egg, gluten, wheat, peanut, tree_nut, seafood, shellfish).
- For each ingredient, include dietary_flags when obvious (pork, alcohol, meat, dairy, egg, gluten).
- Set is_halal=false for clearly non-halal ingredients such as pork or alcohol, include halal_concern, and suggest a practical halal alternative.
- Use source="caption" for caption text, source="transcript" for speech, source="web_research" for cited web fallback text, and source="ai_estimate" only when nothing in the source text supports the amount.
- Include evidence_text when the source text explicitly contains the amount or visible overlay line.
- Each step must include a short imperative title (3-6 words, e.g. "Sear the chicken") plus a procedural text body. Optionally include duration_minutes, temperature, equipment, ingredients_used (names from the ingredient list), and tips.
- Use exactly one language per field. Never mix scripts inside a single string.
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
  .map((ingredient) =>
    `${ingredient.quantity ?? ""} ${ingredient.unit ?? ""} ${ingredient.size ?? ""} ${ingredient.name} ${ingredient.preparation ?? ""}`.trim()
  )
  .join("\n")}
`;
}

function buildServingRecalculationPrompt(draft: RecipeDraft, servings: number): string {
  return `Scale this recipe from ${draft.servings ?? "unknown"} servings to ${servings} servings.
Rules:
- Return only servings, ingredients, and steps in the requested schema.
- Update ingredient quantities for the whole recipe.
- Preserve ingredient names, units, preparation, dietary flags, allergen hints, halal fields, suggested alternatives, evidence, and citations unless scaling requires a quantity/unit wording change.
- Update steps only when the serving change makes instructions misleading, such as pan size, batch count, or cooking time notes.
- Nutrition is per serving and must not be returned or changed here.

Recipe title: ${draft.title}
Cuisine: ${draft.cuisine}
Meal type: ${draft.meal_type}
Current servings: ${draft.servings ?? "unknown"}
Target servings: ${servings}
Ingredients:
${draft.ingredients
  .map((ingredient) =>
    `${ingredient.quantity ?? ""} ${ingredient.unit ?? ""} ${ingredient.size ?? ""} ${ingredient.name} ${ingredient.preparation ?? ""}`.trim()
  )
  .join("\n")}
Steps:
${draft.steps.map((step) => `${step.order}. ${step.text}`).join("\n")}`;
}

function buildRecipeContentPrompt(params: {
  draft: RecipeDraft;
  targetLanguage: "en" | "ar";
  sourceText: string;
}): string {
  const targetLabel = params.targetLanguage === "ar" ? "Arabic" : "English";
  const sourceLanguage = getSourceRecipeLanguage(params.draft);
  const preserveOriginal = sourceLanguage === params.targetLanguage;
  const languageRules =
    params.targetLanguage === "ar"
      ? [
          'Write in simple, natural Modern Standard Arabic ("white" Arabic) for a home cook across the Gulf/MENA.',
          "Use common Gulf-friendly cooking terminology. Avoid stiff formal fusha and avoid heavy dialect.",
          "Never output English in Arabic fields.",
          "Never mix Arabic and Latin scripts inside a single field.",
          preserveOriginal
            ? "The source recipe is already Arabic. Preserve the creator's wording and phrasing wherever possible, and only clean it up for clarity. Do not re-translate into different Arabic."
            : "Write original Arabic copy from the source context, not a literal translation of English phrasing.",
        ]
      : [
          "Write natural, concise home-cook English.",
          preserveOriginal
            ? "The source recipe is already English. Preserve the creator's wording where it is clear, and only clean it up for readability."
            : "Write native English that reads naturally for a home cook, not word-for-word translated text.",
        ];

  return `Generate fully localized ${targetLabel} recipe content.
Rules:
- Return JSON only in the requested schema.
- Keep the same ingredient count and same step count.
- Preserve the recipe's culinary meaning, sequence, and timing.
- For each ingredient, the "name" field must be a pure noun phrase only. Do not include quantities, units, or parenthetical conversions in the name.
- Notes, step tips, and equipment may be descriptive but must stay faithful to the recipe.
- Keep halal concerns and suggested alternatives culturally accurate.
- Use ingredient names in ingredients_used that match the localized ingredient list when possible.
- Each step needs a short imperative title plus natural procedural text suitable for a home cook.
${languageRules.map((rule) => `- ${rule}`).join("\n")}

Current draft:
Title: ${params.draft.title}
Description: ${params.draft.description ?? ""}
Cuisine: ${params.draft.cuisine}
Meal type: ${params.draft.meal_type}
Ingredients:
${params.draft.ingredients
  .map((ingredient, index) =>
    `${index + 1}. ${ingredient.quantity ?? ""} ${ingredient.unit ?? ""} ${ingredient.size ?? ""} ${ingredient.name}${ingredient.preparation ? ` | preparation: ${ingredient.preparation}` : ""}${ingredient.notes ? ` | notes: ${ingredient.notes}` : ""}`.trim()
  )
  .join("\n")}
Steps:
${params.draft.steps.map((step) => `${step.order}. ${step.title}: ${step.text}`).join("\n")}

Source context:
${truncateForPrompt(params.sourceText, 12000)}`;
}

function buildMissingDetailsPrompt(params: {
  draft: RecipeDraft;
  sourceText: string;
}): string {
  return `Fill missing recipe metadata using the provided recipe draft plus source context.
Rules:
- Keep recipe meaning accurate. No new ingredients or steps.
- If a value is already present in the draft, keep it unchanged.
- For missing prep_minutes/cook_minutes, estimate realistic positive minutes from step complexity and durations.
- For missing description, write 1-2 concise sentences.
- If a field is impossible to estimate confidently, return null.
Current draft:
Title: ${params.draft.title}
Description: ${params.draft.description ?? "null"}
Prep minutes: ${params.draft.prep_minutes ?? "null"}
Cook minutes: ${params.draft.cook_minutes ?? "null"}
Ingredients count: ${params.draft.ingredients.length}
Steps:
${params.draft.steps.map((step) => `${step.order}. ${step.text}`).join("\n")}

Source context:
${params.sourceText}`;
}

function buildIngredientResearchPrompt(params: {
  draft: RecipeDraft;
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  sourceText: string;
}): string {
  const missing = params.draft.ingredients
    .filter((ingredient) => ingredient.needs_review)
    .map((ingredient) => `- ${ingredient.name}`)
    .join("\n");

  return `Fill missing recipe ingredient quantities for the same social recipe.
Rules:
- Search by recipe title and source context. Prefer the same creator page, the same recipe, or a repost containing the same recipe.
- Return JSON only using this shape: {"ingredients":[],"citations":[]}.
- Fill quantity/unit/size only when a matching source explicitly shows the amount.
- When cited evidence exists, include evidence_text and citation_url.
- If no cited evidence is found, fall back to standard cooking proportions, include evidence_text="AI estimated from standard recipe proportions", and leave citation_url null.
- Do not invent new ingredients. Return only ingredients listed under Missing ingredient details.

Source URL: ${params.sourceUrl}
Source platform: ${params.sourcePlatform}
Recipe title: ${params.draft.title}
Missing ingredient details:
${missing || "(none)"}

Known source context:
${truncateForPrompt(params.sourceText)}`;
}

const ALLOWED_UNITS_FOR_PROMPT = [
  "g",
  "kg",
  "ml",
  "l",
  "tsp",
  "tbsp",
  "cup",
  "oz",
  "lb",
  "slice",
  "piece",
  "whole",
  "can",
  "pack",
  "clove",
  "bunch",
  "pinch",
  "dash",
  "splash",
  "drop",
  "handful",
  "stick",
  "head",
  "sprig",
  "leaf",
];

function buildForcedMeasurementPrompt(draft: RecipeDraft): string {
  const missing = draft.ingredients
    .filter((ingredient) => !isIngredientDetailComplete(ingredient))
    .map((ingredient) => `- ${ingredient.name}${ingredient.preparation ? `, ${ingredient.preparation}` : ""}`)
    .join("\n");

  return `Estimate practical cooking measurements for the incomplete ingredients.
Rules:
- Return ONLY ingredients listed under Incomplete ingredients.
- Every returned ingredient MUST include a non-empty numeric quantity (digits only, e.g. "2", "1.5", "0.25") and a unit chosen STRICTLY from this allowlist: ${ALLOWED_UNITS_FOR_PROMPT.join(", ")}.
- Do NOT use units outside the allowlist. Do NOT use phrases like "to taste", "as needed", or descriptive words. If you would say "to taste", convert to "1 pinch".
- Use lowercase singular form for the unit (e.g. "tbsp" not "Tbsp." or "tablespoons").
- Prefer common recipe proportions for the dish and serving count.
- Do not change ingredient names.

Recipe title: ${draft.title}
Cuisine: ${draft.cuisine}
Meal type: ${draft.meal_type}
Servings: ${draft.servings ?? "unknown"}
Complete context:
${draft.ingredients
  .map((ingredient) => `${ingredient.quantity ?? ""} ${ingredient.unit ?? ""} ${ingredient.size ?? ""} ${ingredient.name}`.trim())
  .join("\n")}

Incomplete ingredients:
${missing || "(none)"}`;
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

function optionalStringArray(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => optionalString(entry))
    .filter((entry): entry is string => !!entry);
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

export function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function getSourceRecipeLanguage(draft: RecipeDraft): "en" | "ar" {
  if (draft.source.language) {
    return draft.source.language.toLowerCase().startsWith("ar") ? "ar" : "en";
  }
  const sample = `${draft.title} ${draft.steps.map((step) => step.text).join(" ")}`;
  return containsArabic(sample) ? "ar" : "en";
}

function normalizeRecipeCandidate(
  candidate: z.infer<typeof recipeObjectSchema>,
  input: RecipeInput
): RecipeDraft | null {
  const normalized = {
    title: candidate.title,
    description: optionalString(candidate.description),
    cuisine: optionalString(candidate.cuisine) ?? "General",
    meal_type: optionalString(candidate.meal_type) ?? "Meal",
    servings: optionalPositiveInt(candidate.servings),
    prep_minutes: optionalPositiveInt(candidate.prep_minutes),
    cook_minutes: optionalPositiveInt(candidate.cook_minutes),
    ingredients: candidate.ingredients.map((item) => ({
      name: item.name.trim(),
      quantity: optionalString(item.quantity),
      unit: optionalString(item.unit),
      preparation: optionalString(item.preparation),
      size: optionalString(item.size),
      notes: optionalString(item.notes),
      dietary_flags: optionalStringArray(item.dietary_flags),
      allergen_hints: optionalStringArray(item.allergen_hints),
      is_halal: typeof item.is_halal === "boolean" ? item.is_halal : undefined,
      halal_concern: optionalString(item.halal_concern),
      suggested_alternative: optionalString(item.suggested_alternative),
      source: item.source ?? undefined,
      confidence: optionalPositiveNumber(item.confidence),
      evidence_text: optionalString(item.evidence_text),
      citation_url: optionalString(item.citation_url),
      is_estimated: item.is_estimated === true,
    })),
    steps: candidate.steps.map((item, index) => {
      const order = item.order ?? index + 1;
      return {
        order,
        title: optionalString(item.title) ?? `Step ${order}`,
        text: item.text.trim(),
        duration_minutes: optionalPositiveInt(item.duration_minutes),
        temperature: item.temperature ?? undefined,
        equipment: optionalStringArray(item.equipment),
        ingredients_used: optionalStringArray(item.ingredients_used),
        tips: optionalStringArray(item.tips),
      };
    }),
    source: {
      platform: input.sourcePlatform,
      url: input.sourceUrl,
      language: optionalString(candidate.source.language),
    },
  };

  return validateRecipeDraft(normalized, { requireMeasurements: false });
}

function normalizeResearchIngredients(
  ingredients: z.infer<typeof ingredientResearchSchema>["ingredients"]
): IngredientItem[] {
  return ingredients.map((ingredient) => {
    const citationUrl = optionalString(ingredient.citation_url);
    const base = {
      name: ingredient.name.trim(),
      quantity: optionalString(ingredient.quantity),
      unit: optionalString(ingredient.unit),
      preparation: optionalString(ingredient.preparation),
      size: optionalString(ingredient.size),
      notes: optionalString(ingredient.notes),
      confidence: optionalPositiveNumber(ingredient.confidence),
      evidence_text: optionalString(ingredient.evidence_text),
      citation_url: citationUrl,
      is_estimated: true,
    };
    if (!citationUrl) {
      return {
        ...base,
        source: "ai_estimate",
      };
    }
    return {
      ...base,
      source: "web_research",
    };
  });
}

function fallbackStepTitle(order: number, language: "en" | "ar") {
  return language === "ar" ? `الخطوة ${order}` : `Step ${order}`;
}

function fallbackLocalizedText(
  draft: RecipeDraft,
  language: "en" | "ar"
): LocalizedRecipeText {
  const localized = draft.localized?.[language];
  return {
    title: localized?.title ?? draft.title,
    description: localized?.description ?? draft.description,
    cuisine: localized?.cuisine ?? draft.cuisine,
    meal_type: localized?.meal_type ?? draft.meal_type,
    ingredients:
      localized?.ingredients ??
      draft.ingredients.map((ingredient) => ({
        name: ingredient.name,
        notes: ingredient.notes,
      })),
    steps:
      localized?.steps ??
      draft.steps.map((step) => ({
        order: step.order,
        title: step.title,
        text: step.text,
        duration_minutes: step.duration_minutes,
        temperature: step.temperature,
        equipment: step.equipment,
        ingredients_used: step.ingredients_used,
        tips: step.tips,
      })),
  };
}

function assertArabicContentQuality(localized: LocalizedRecipeText) {
  const issues: string[] = [];
  const latinPattern = /[A-Za-z]/;

  const requireArabic = (value: string | undefined, issuePrefix: string) => {
    const trimmed = optionalString(value);
    if (!trimmed) return;
    if (latinPattern.test(trimmed)) issues.push(`${issuePrefix}_contains_latin`);
    if (!containsArabic(trimmed)) issues.push(`${issuePrefix}_missing_arabic`);
  };

  requireArabic(localized.title, "title");
  requireArabic(localized.description, "description");
  requireArabic(localized.cuisine, "cuisine");
  requireArabic(localized.meal_type, "meal_type");

  localized.ingredients.forEach((ingredient, index) => {
    requireArabic(ingredient.name, `ingredient_${index + 1}_name`);
    requireArabic(ingredient.notes, `ingredient_${index + 1}_notes`);
  });

  localized.steps.forEach((step, index) => {
    requireArabic(step.title, `step_${index + 1}_title`);
    requireArabic(step.text, `step_${index + 1}_text`);
    step.equipment?.forEach((item, itemIndex) => {
      requireArabic(item, `step_${index + 1}_equipment_${itemIndex + 1}`);
    });
    step.ingredients_used?.forEach((item, itemIndex) => {
      requireArabic(item, `step_${index + 1}_ingredients_used_${itemIndex + 1}`);
    });
    step.tips?.forEach((item, itemIndex) => {
      requireArabic(item, `step_${index + 1}_tip_${itemIndex + 1}`);
    });
  });

  if (issues.length > 0) {
    throw new Error(`ARABIC_CONTENT_QUALITY_FAILED ${issues.join(",")}`);
  }
}

function normalizeGeneratedLocalizedText(
  localized: z.infer<typeof localizedTextSchema>,
  draft: RecipeDraft,
  language: "en" | "ar"
): LocalizedRecipeText {
  const fallback = fallbackLocalizedText(draft, language);

  if (localized.ingredients.length !== draft.ingredients.length || localized.steps.length !== draft.steps.length) {
    throw new Error("LOCALIZATION_SHAPE_MISMATCH");
  }

  const normalizedSteps = localized.steps.map((step, index) => {
    const order = step.order || fallback.steps[index]?.order || index + 1;
    const equipment = optionalStringArray(step.equipment);
    const ingredientsUsed = optionalStringArray(step.ingredients_used);
    const tips = optionalStringArray(step.tips);
    return {
      order,
      title: optionalString(step.title) ?? fallback.steps[index]?.title ?? fallbackStepTitle(order, language),
      text: step.text.trim() || fallback.steps[index]?.text || "",
      duration_minutes: optionalPositiveInt(step.duration_minutes) ?? fallback.steps[index]?.duration_minutes,
      temperature: step.temperature ?? fallback.steps[index]?.temperature,
      equipment: equipment.length > 0 ? equipment : fallback.steps[index]?.equipment,
      ingredients_used:
        ingredientsUsed.length > 0 ? ingredientsUsed : fallback.steps[index]?.ingredients_used,
      tips: tips.length > 0 ? tips : fallback.steps[index]?.tips,
    };
  });

  const normalized = {
    title: localized.title.trim() || fallback.title,
    description: optionalString(localized.description) ?? fallback.description,
    cuisine: optionalString(localized.cuisine) ?? fallback.cuisine,
    meal_type: optionalString(localized.meal_type) ?? fallback.meal_type,
    ingredients: localized.ingredients.map((ingredient, index) => ({
      name: ingredient.name.trim() || fallback.ingredients[index]?.name || draft.ingredients[index]?.name,
      notes: optionalString(ingredient.notes) ?? fallback.ingredients[index]?.notes,
    })),
    steps: linkStepIngredients(normalizedSteps, draft.ingredients),
  } satisfies LocalizedRecipeText;

  if (language === "ar") {
    assertArabicContentQuality(normalized);
  }

  return normalized;
}

export function getRecipeContentModelCandidates(language: "en" | "ar") {
  return language === "ar" ? [...ARABIC_CONTENT_MODELS] : [...ENGLISH_CONTENT_MODELS];
}

export async function generateRecipeContent(
  draft: RecipeDraft,
  targetLanguage: "en" | "ar",
  sourceText: string,
  options: {
    modelNames?: string[];
    abortSignal?: AbortSignal;
  } = {}
): Promise<{ content: LocalizedRecipeText; model: string }> {
  const providerClient = createOpenRouterClient();
  let lastError: unknown;

  for (const modelName of options.modelNames ?? getRecipeContentModelCandidates(targetLanguage)) {
    try {
      const { object } = await withAbortTimeout(
        (abortSignal) =>
          generateObject({
            model: providerClient(modelName),
            schema: localizedTextSchema,
            temperature: 0.2,
            system:
              "You generate natural localized recipe content while preserving exact ingredient and step counts.",
            prompt: buildRecipeContentPrompt({
              draft,
              targetLanguage,
              sourceText,
            }),
            abortSignal,
          }),
        OPENROUTER_TIMEOUT_MS,
        options.abortSignal
      );

      return {
        content: normalizeGeneratedLocalizedText(object, draft, targetLanguage),
        model: modelName,
      };
    } catch (error) {
      lastError = error;
      console.warn("[import][content-gen] model failed", {
        language: targetLanguage,
        model: modelName,
        error: truncateForLog(String(error)),
      });
    }
  }

  throw new Error(
    `RECIPE_CONTENT_GENERATION_FAILED ${targetLanguage} ${truncateForLog(String(lastError))}`
  );
}

export async function fillMissingRecipeDetails(
  draft: RecipeDraft,
  sourceText: string,
  options: { abortSignal?: AbortSignal } = {}
): Promise<{
  draft: RecipeDraft;
  filledDescription: boolean;
  filledPrepMinutes: boolean;
  filledCookMinutes: boolean;
}> {
  const needsDescription = !optionalString(draft.description);
  const needsPrep = typeof draft.prep_minutes !== "number";
  const needsCook = typeof draft.cook_minutes !== "number";

  if (!needsDescription && !needsPrep && !needsCook) {
    return {
      draft,
      filledDescription: false,
      filledPrepMinutes: false,
      filledCookMinutes: false,
    };
  }

  try {
    const providerClient = createOpenRouterClient();
    const model = providerClient(GEMINI_PARSER_MODEL);

    const { object } = await withAbortTimeout(
      (abortSignal) =>
        generateObject({
          model,
          schema: missingDetailsSchema,
          temperature: 0.2,
          system:
            "You complete missing recipe metadata conservatively and never modify ingredients or steps.",
          prompt: buildMissingDetailsPrompt({
            draft,
            sourceText,
          }),
          abortSignal,
        }),
      OPENROUTER_TIMEOUT_MS,
      options.abortSignal
    );

    const description = optionalString(object.description);
    const prepMinutes = optionalPositiveInt(object.prep_minutes);
    const cookMinutes = optionalPositiveInt(object.cook_minutes);

    return {
      draft: {
        ...draft,
        description: needsDescription ? description ?? draft.description : draft.description,
        prep_minutes: needsPrep ? prepMinutes ?? draft.prep_minutes : draft.prep_minutes,
        cook_minutes: needsCook ? cookMinutes ?? draft.cook_minutes : draft.cook_minutes,
      },
      filledDescription: needsDescription && !!description,
      filledPrepMinutes: needsPrep && typeof prepMinutes === "number",
      filledCookMinutes: needsCook && typeof cookMinutes === "number",
    };
  } catch {
    return {
      draft,
      filledDescription: false,
      filledPrepMinutes: false,
      filledCookMinutes: false,
    };
  }
}

async function fillMissingMeasurements(params: {
  draft: RecipeDraft;
  input: RecipeInput;
}): Promise<IngredientResearchResult> {
  const content = await openRouterChatCompletion({
    model: WEB_RESEARCH_MODEL,
    plugins: [{ id: "web" }],
    messages: [
      {
        role: "user",
        content: buildIngredientResearchPrompt({
          draft: params.draft,
          sourceUrl: params.input.sourceUrl,
          sourcePlatform: params.input.sourcePlatform,
          sourceText: params.input.sourceText,
        }),
      },
    ],
  });

  const parsed = ingredientResearchSchema.parse(parseJsonLenient(content));
  return {
    ingredients: normalizeResearchIngredients(parsed.ingredients),
    citations: parsed.citations ?? [],
    model: WEB_RESEARCH_MODEL,
  };
}

const FORCE_FILL_MAX_ATTEMPTS = 2;

async function forceFillIngredientMeasurements(draft: RecipeDraft): Promise<RecipeDraft> {
  let nextDraft = {
    ...draft,
    ingredients: mergeIngredientSources(draft.ingredients),
  };

  for (let attempt = 0; attempt < FORCE_FILL_MAX_ATTEMPTS; attempt++) {
    if (!hasIngredientsNeedingReview(nextDraft.ingredients)) return nextDraft;

    const providerClient = createOpenRouterClient();
    const { object } = await withAbortTimeout((abortSignal) =>
      generateObject({
        model: providerClient(GEMINI_PARSER_MODEL),
        schema: forcedIngredientMeasurementSchema,
        temperature: 0.2,
        system: "You estimate missing recipe measurements conservatively and return complete JSON only.",
        prompt: buildForcedMeasurementPrompt(nextDraft),
        abortSignal,
      })
    );

    const estimates = object.ingredients.map((ingredient) => ({
      name: ingredient.name.trim(),
      quantity: ingredient.quantity.trim(),
      unit: normalizeUnit(ingredient.unit) || ingredient.unit.trim(),
      preparation: optionalString(ingredient.preparation),
      size: optionalString(ingredient.size),
      notes: optionalString(ingredient.notes),
      confidence: optionalPositiveNumber(ingredient.confidence) ?? 0.35,
      evidence_text: "AI estimated from standard recipe proportions",
      source: "ai_estimate" as const,
      is_estimated: true,
    }));

    if (estimates.length === 0) break;

    nextDraft = {
      ...nextDraft,
      ingredients: mergeIngredientSources([...nextDraft.ingredients, ...estimates]),
    };
  }

  if (!hasIngredientsNeedingReview(nextDraft.ingredients)) return nextDraft;

  // Final fallback: accept whatever measurement is on the ingredient (even with
  // a non-whitelisted unit) by force-clearing needs_review. The user prefers
  // showing an estimate over hanging the import.
  const fallbackIngredients = nextDraft.ingredients.map((ingredient) => {
    if (isIngredientDetailComplete(ingredient)) return ingredient;
    const quantity = ingredient.quantity?.trim() || "1";
    const unit = ingredient.unit?.trim() || ingredient.size?.trim() || "piece";
    return {
      ...ingredient,
      quantity,
      unit,
      source: ingredient.source ?? ("ai_estimate" as const),
      is_estimated: true,
      evidence_text: ingredient.evidence_text ?? "AI estimated from standard recipe proportions",
      needs_review: false,
    };
  });

  return {
    ...nextDraft,
    ingredients: markIngredientReviewStates(fallbackIngredients).map((ingredient) => ({
      ...ingredient,
      needs_review: false,
    })),
  };
}

async function enrichMissingIngredientDetails(
  draft: RecipeDraft,
  input: RecipeInput
): Promise<{
  draft: RecipeDraft;
  researchAttempted: boolean;
  researchIngredients: number;
  researchCitations: string[];
  researchFailed: boolean;
}> {
  const reviewedDraft = {
    ...draft,
    ingredients: mergeIngredientSources(draft.ingredients),
  };

  if (!hasIngredientsNeedingReview(reviewedDraft.ingredients)) {
    return {
      draft: reviewedDraft,
      researchAttempted: false,
      researchIngredients: 0,
      researchCitations: [],
      researchFailed: false,
    };
  }

  try {
    const research = await fillMissingMeasurements({
      draft: reviewedDraft,
      input,
    });
    const mergedIngredients = mergeIngredientSources([
      ...reviewedDraft.ingredients,
      ...research.ingredients,
    ]);
    const filledDraft = await forceFillIngredientMeasurements({
      ...reviewedDraft,
      ingredients: mergedIngredients,
    });
    return {
      draft: filledDraft,
      researchAttempted: true,
      researchIngredients: research.ingredients.length,
      researchCitations: research.citations,
      researchFailed: false,
    };
  } catch {
    return {
      draft: await forceFillIngredientMeasurements(reviewedDraft),
      researchAttempted: true,
      researchIngredients: 0,
      researchCitations: [],
      researchFailed: true,
    };
  }
}

export async function extractRecipe(input: RecipeInput): Promise<ExtractResult> {
  const providerClient = createOpenRouterClient();
  let lastError: unknown;
  let object: z.infer<typeof recipeObjectSchema> | null = null;
  let modelUsed: string | null = null;

  for (const candidateModel of EXTRACTION_MODELS) {
    try {
      const result = await withAbortTimeout((abortSignal) =>
        generateObject({
          model: providerClient(candidateModel),
          schema: recipeObjectSchema,
          temperature: 0.2,
          system:
            "You are a recipe extraction engine. Return accurate recipe objects as JSON and avoid hallucinations.",
          prompt: buildExtractionPrompt(input),
          abortSignal,
        })
      );
      object = result.object;
      modelUsed = candidateModel;
      break;
    } catch (error) {
      lastError = error;
      console.warn("[import][extract] model failed", { model: candidateModel, error: truncateForLog(String(error)) });
    }
  }

  if (!object || !modelUsed) {
    throw new Error(`OPENROUTER_EXTRACTION_FAILED ${truncateForLog(String(lastError))}`);
  }

  const draft = normalizeRecipeCandidate(object, input);
  if (!draft) throw new Error("Generated recipe did not pass validation constraints.");

  const detailCompletion = await enrichMissingIngredientDetails(draft, input);
  const finalDraft = validateRecipeDraft(detailCompletion.draft);
  if (!finalDraft) throw new Error("Generated recipe did not pass final validation constraints.");

  return {
    draft: finalDraft,
    confidence: {
      provider: "openrouter",
      model: modelUsed,
      extraction_mode: "schema",
      ingredient_review: {
        needs_review: hasIngredientsNeedingReview(finalDraft.ingredients),
        web_research_attempted: detailCompletion.researchAttempted,
        web_research_failed: detailCompletion.researchFailed,
        web_research_ingredients: detailCompletion.researchIngredients,
        web_research_citations: detailCompletion.researchCitations,
        web_research_model: detailCompletion.researchAttempted ? WEB_RESEARCH_MODEL : null,
      },
    },
    provider: "openrouter",
    model: modelUsed,
  };
}

export async function estimateNutrition(
  draft: RecipeDraft
): Promise<NutritionEstimate> {
  const providerClient = createOpenRouterClient();
  const model = providerClient(GEMINI_NUTRITION_MODEL);

  try {
    const { object } = await withAbortTimeout((abortSignal) =>
      generateObject({
        model,
        schema: nutritionObjectSchema,
        temperature: 0.2,
        system:
          "You estimate recipe nutrition conservatively. Never claim medical precision and always include a disclaimer.",
        prompt: buildNutritionPrompt(draft),
        abortSignal,
      })
    );

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

function scaleQuantityString(quantity: string | undefined, factor: number): string | undefined {
  if (!quantity || !Number.isFinite(factor) || factor <= 0) return quantity;
  const trimmed = quantity.trim();
  const match = trimmed.match(/^\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?$/);
  if (!match) return quantity;
  let numeric: number;
  if (trimmed.includes("/")) {
    const [numerator, denominator] = trimmed.split("/").map(Number);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return quantity;
    numeric = numerator / denominator;
  } else {
    numeric = Number(trimmed);
  }
  const scaled = numeric * factor;
  const rounded = scaled >= 10 ? Math.round(scaled) : Math.round(scaled * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
}

function scaleIngredientQuantities(draft: RecipeDraft, servings: number): IngredientItem[] {
  const factor = draft.servings && draft.servings > 0 ? servings / draft.servings : 1;
  return draft.ingredients.map((ingredient) => ({
    ...ingredient,
    quantity: scaleQuantityString(ingredient.quantity, factor),
  }));
}

function buildStepRewritePrompt(draft: RecipeDraft, servings: number): string {
  return `Rewrite only step wording that needs serving-count changes.
Rules:
- Return both English and Arabic localized step arrays.
- Keep step order and count unchanged.
- Preserve duration, temperature, equipment, ingredients_used, and tips unless the serving change makes them misleading.
- Do not return ingredients or nutrition.

Recipe title: ${draft.title}
Current servings: ${draft.servings ?? "unknown"}
Target servings: ${servings}
English steps:
${(draft.localized?.en?.steps ?? draft.steps).map((step) => `${step.order}. ${step.text}`).join("\n")}
Arabic steps:
${(draft.localized?.ar?.steps ?? draft.steps).map((step) => `${step.order}. ${step.text}`).join("\n")}`;
}

async function rewriteLocalizedStepsForServings(
  draft: RecipeDraft,
  servings: number
): Promise<NonNullable<RecipeDraft["localized"]>> {
  const fallback = {
    en: localizedTextWithFallback(draft, "en"),
    ar: localizedTextWithFallback(draft, "ar"),
  };

  try {
    const providerClient = createOpenRouterClient();
    const { object } = await withAbortTimeout((abortSignal) =>
      generateObject({
        model: providerClient(GEMINI_PARSER_MODEL),
        schema: localizedStepRewriteSchema,
        temperature: 0.2,
        system: "You rewrite recipe steps for serving changes without changing ingredients.",
        prompt: buildStepRewritePrompt(draft, servings),
        abortSignal,
      })
    );

    return {
      en: { ...fallback.en, steps: normalizeLocalizedSteps(object.en.steps, fallback.en.steps) },
      ar: { ...fallback.ar, steps: normalizeLocalizedSteps(object.ar.steps, fallback.ar.steps) },
    };
  } catch {
    return fallback;
  }
}

function localizedTextWithFallback(draft: RecipeDraft, language: "en" | "ar") {
  const localized = draft.localized?.[language];
  return {
    title: localized?.title ?? draft.title,
    description: localized?.description ?? draft.description,
    cuisine: localized?.cuisine ?? draft.cuisine,
    meal_type: localized?.meal_type ?? draft.meal_type,
    ingredients:
      localized?.ingredients ??
      draft.ingredients.map((ingredient) => ({
        name: ingredient.name,
        notes: ingredient.notes,
      })),
    steps: localized?.steps ?? draft.steps,
  };
}

function normalizeLocalizedSteps(
  steps: z.infer<typeof localizedTextSchema>["steps"],
  fallback: NonNullable<RecipeDraft["localized"]>["en"]["steps"]
) {
  if (steps.length !== fallback.length) return fallback;
  return steps.map((step, index) => ({
    ...fallback[index],
    order: step.order || fallback[index].order,
    title: optionalString(step.title) ?? fallback[index].title,
    text: step.text.trim() || fallback[index].text,
    duration_minutes: optionalPositiveInt(step.duration_minutes) ?? fallback[index].duration_minutes,
    temperature: step.temperature ?? fallback[index].temperature,
    equipment: optionalStringArray(step.equipment) ?? fallback[index].equipment,
    ingredients_used: optionalStringArray(step.ingredients_used) ?? fallback[index].ingredients_used,
    tips: optionalStringArray(step.tips) ?? fallback[index].tips,
  }));
}

export async function recalculateRecipeServings(
  draft: RecipeDraft,
  servings: number
): Promise<Pick<RecipeDraft, "servings" | "ingredients" | "steps" | "localized">> {
  const scaledIngredients = scaleIngredientQuantities(draft, servings);
  const draftWithScaledIngredients = {
    ...draft,
    servings,
    ingredients: scaledIngredients,
  };
  const rewrittenLocalized = await rewriteLocalizedStepsForServings(draftWithScaledIngredients, servings);
  const sourceLanguage = getSourceRecipeLanguage(draft);
  const sourceSteps = rewrittenLocalized[sourceLanguage]?.steps ?? draft.steps;

  const candidate = validateRecipeDraft({
    ...draftWithScaledIngredients,
    steps: sourceSteps,
    localized: rewrittenLocalized,
  });
  if (!candidate) throw new Error("Serving recalculation failed validation.");

  return {
    servings: candidate.servings,
    ingredients: candidate.ingredients,
    steps: candidate.steps,
    localized: rewrittenLocalized,
  };
}
