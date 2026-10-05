"use node";

import { generateObject, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

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
  normalizeIngredientKey,
  normalizeQuantity,
  normalizeUnit,
} from "./ingredientDetails.ts";
import { getArabicTextIssues } from "./sanityCheck.ts";
import { linkStepIngredients } from "./stepRewriter.ts";
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
// Long enough for the slowest model to write a long recipe; a shorter limit cut it off
// mid-answer and sent the import down the whole fallback chain.
const OPENROUTER_TIMEOUT_MS = 90_000;
// The web search for amounts is the slowest call and the least likely to help, so it
// gets a short leash; estimated amounts take over when it runs out.
const WEB_RESEARCH_TIMEOUT_MS = 25_000;
// Output caps. Without one a request reserves the model's whole output window, and
// OpenRouter refuses it when the balance cannot cover that reservation.
const RECIPE_MAX_TOKENS = 12_000;
const DETAIL_MAX_TOKENS = 4_000;

const defaultNutritionDisclaimer =
  "Estimated nutrition values only. Verify with a certified nutrition source before medical use.";

const recipeObjectSchema = z.object({
  recipe_in_source: z.boolean().nullable().optional(),
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
      suggested_alternative: z.string().nullable().optional(),
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
      number: z.number().int().nullable().optional(),
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
  const value = process.env[name];
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
- Use only what the source says. Every ingredient must be spoken in the transcript or written in the caption, description, first comment or shared text. Never add an ingredient from general knowledge of the dish, and never build a recipe from a title or hashtags alone.
- Set recipe_in_source=true only when the source itself states at least two ingredients. Otherwise set recipe_in_source=false and return empty ingredients and steps arrays.
- When the source states the ingredients but not the method, write the steps a home cook would follow using only those ingredients.
- Write the title, description, ingredient names, preparation, notes and steps in the language the recipe is told in. An Arabic recipe stays Arabic, keeping the creator's own ingredient words (for example "حبهان", "كزبرة ناشفة"); never translate it to English. Set source.language to "ar" or "en".
- Include cuisine and meal_type in that same language. Use cuisine="General" and meal_type="Meal" only when the source is unclear.
- Infer servings and the order of steps from transcript + caption + metadata.
- Ingredient names alone are incomplete. For each ingredient, preserve the exact quantity/unit/size the source gives, such as 150 g, 2 tbsp, 3 slices, 1 piece, 1 whole, 500 ml, 1 can, 2 cloves.
- quantity uses Western digits only (2, 0.5, 1/4), whatever the language. Convert Arabic digits and spoken amounts: "٢" is 2, "نص" or "نصف" is 0.5, "ربع" is 0.25, "تلت" is 1/3, "ملعقتين" is 2, "كوبين" is 2.
- unit is always one of these English words, whatever the language: ${ALLOWED_UNITS_FOR_PROMPT.join(", ")}. For example "ملعقة كبيرة" or "معلقة أكل" is tbsp, "ملعقة صغيرة" or "معلقة شاي" is tsp, "كوب" or "كوباية" is cup, "جرام" is g, "كيلو" is kg, "فص" is clove, "حبة" is whole, "رشة" is pinch. Leave quantity and unit null when the source gives no amount ("شوية", "حسب الرغبة", "to taste").
- Put preparation details like cooked, diced, chopped, or sliced in preparation, not in the ingredient name when possible.
- For each ingredient, set allergen_hints to every allergen it contains, using only these values: dairy, egg, gluten, wheat, peanut, tree_nut, seafood, shellfish. Include allergens hidden inside prepared foods (soy sauce has wheat and gluten, mayonnaise has egg, pesto has tree_nut and dairy).
- For each ingredient, include dietary_flags when they apply (pork, alcohol, meat, dairy, egg, gluten).
- Set is_halal=false for every non-halal ingredient: pork and anything made from it (bacon, ham, lard, prosciutto, pork gelatin), and alcohol in any form (wine, beer, spirits, mirin, cooking wine, liqueur). Give the reason in halal_concern.
- For every is_halal=false ingredient, set suggested_alternative to the closest halal ingredient that keeps the dish working, as a short ingredient name only (for example "beef bacon" or "grape juice with a splash of vinegar"). Leave suggested_alternative null for halal ingredients.
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
- Ingredients marked "not halal" list a halal alternative. For each of them, return suggested_alternative: that alternative written in ${targetLabel} as a short ingredient name. Return null for every other ingredient.
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
    `${index + 1}. ${ingredient.quantity ?? ""} ${ingredient.unit ?? ""} ${ingredient.size ?? ""} ${ingredient.name}${ingredient.preparation ? ` | preparation: ${ingredient.preparation}` : ""}${ingredient.notes ? ` | notes: ${ingredient.notes}` : ""}${ingredient.is_halal === false ? ` | not halal${ingredient.suggested_alternative ? `, halal alternative: ${ingredient.suggested_alternative}` : ""}` : ""}`.trim()
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
    .map((ingredient, index) =>
      isIngredientDetailComplete(ingredient)
        ? null
        : `${index + 1}. ${ingredient.name}${ingredient.preparation ? `, ${ingredient.preparation}` : ""}`
    )
    .filter(Boolean)
    .join("\n");

  return `Estimate practical cooking measurements for the incomplete ingredients.
Rules:
- Return ONLY ingredients listed under Incomplete ingredients, each with the number it is listed under and its name copied exactly.
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

function createOpenRouterClient(): (modelName: string) => LanguageModel {
  const apiKey = requiredEnv("OPENROUTER_API_KEY");
  const provider = createOpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      "HTTP-Referer": "https://meal-planner.app",
      "X-Title": "Meal Planner Import",
    },
  });
  // The provider package is typed against a newer model interface than `ai` expects.
  return (modelName) => provider(modelName) as unknown as LanguageModel;
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
  // Models label the language loosely ("ar", "Arabic", "عربي", "English"), so only a
  // label that is clearly one of the two is trusted; anything else is read off the text.
  const label = draft.source.language?.trim().toLowerCase() ?? "";
  if (label.startsWith("ar") || containsArabic(label)) return "ar";
  if (label.startsWith("en")) return "en";
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
      quantity: normalizeQuantity(item.quantity) || undefined,
      unit: normalizeUnit(item.unit) || undefined,
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
      quantity: normalizeQuantity(ingredient.quantity) || undefined,
      unit: normalizeUnit(ingredient.unit) || undefined,
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

  const requireArabic = (value: string | undefined, issuePrefix: string) => {
    const trimmed = optionalString(value);
    if (!trimmed) return;
    issues.push(...getArabicTextIssues(trimmed).map((issue) => `${issuePrefix}_${issue}`));
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

// Mirrors the Arabic check for the fields a reader notices first: English
// content that came back in Arabic script is rejected so the next model runs.
function assertEnglishContentQuality(localized: LocalizedRecipeText) {
  const issues: string[] = [];
  const latinPattern = /[A-Za-z]/;

  const requireEnglish = (value: string | undefined, issuePrefix: string) => {
    const trimmed = optionalString(value);
    if (!trimmed) return;
    if (containsArabic(trimmed) && !latinPattern.test(trimmed)) issues.push(`${issuePrefix}_not_english`);
  };

  requireEnglish(localized.title, "title");
  localized.ingredients.forEach((ingredient, index) => {
    requireEnglish(ingredient.name, `ingredient_${index + 1}_name`);
  });
  localized.steps.forEach((step, index) => {
    requireEnglish(step.text, `step_${index + 1}_text`);
  });

  if (issues.length > 0) {
    throw new Error(`ENGLISH_CONTENT_QUALITY_FAILED ${issues.join(",")}`);
  }
}

// A halal alternative only belongs on an ingredient that needs one, and an
// alternative in the wrong script is dropped rather than failing the content.
function normalizeLocalizedAlternative(
  value: string | null | undefined,
  ingredient: IngredientItem | undefined,
  language: "en" | "ar"
): string | undefined {
  const alternative = optionalString(value);
  if (!alternative || ingredient?.is_halal !== false) return undefined;
  if (language === "ar") {
    return containsArabic(alternative) && !/[A-Za-z]/.test(alternative) ? alternative : undefined;
  }
  return containsArabic(alternative) ? undefined : alternative;
}

function isWrittenInLanguage(value: string, language: "en" | "ar"): boolean {
  const hasLatin = /[A-Za-z]/.test(value);
  return language === "ar" ? containsArabic(value) && !hasLatin : hasLatin || !containsArabic(value);
}

function normalizeGeneratedLocalizedText(
  localized: z.infer<typeof localizedTextSchema>,
  draft: RecipeDraft,
  language: "en" | "ar"
): LocalizedRecipeText {
  const fallback = fallbackLocalizedText(draft, language);
  // The fallback comes from the draft, which is in the source language. A gap
  // in translated content must stay empty rather than be filled with text in
  // the other language (which also fails the Arabic quality check below).
  const inLanguage = (value: string | undefined) =>
    value && isWrittenInLanguage(value, language) ? value : undefined;
  const allInLanguage = (values: string[] | undefined) =>
    values?.length && values.every((value) => isWrittenInLanguage(value, language)) ? values : undefined;

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
      title:
        optionalString(step.title) ??
        inLanguage(fallback.steps[index]?.title) ??
        fallbackStepTitle(order, language),
      text: step.text.trim() || fallback.steps[index]?.text || "",
      duration_minutes: optionalPositiveInt(step.duration_minutes) ?? fallback.steps[index]?.duration_minutes,
      temperature: step.temperature ?? fallback.steps[index]?.temperature,
      equipment: equipment.length > 0 ? equipment : allInLanguage(fallback.steps[index]?.equipment),
      ingredients_used:
        ingredientsUsed.length > 0
          ? ingredientsUsed
          : allInLanguage(fallback.steps[index]?.ingredients_used),
      tips: tips.length > 0 ? tips : allInLanguage(fallback.steps[index]?.tips),
    };
  });

  const normalizedIngredients = localized.ingredients.map((ingredient, index) => ({
    name: ingredient.name.trim() || fallback.ingredients[index]?.name || draft.ingredients[index]?.name,
    notes: optionalString(ingredient.notes) ?? inLanguage(fallback.ingredients[index]?.notes),
    suggested_alternative: normalizeLocalizedAlternative(
      ingredient.suggested_alternative,
      draft.ingredients[index],
      language
    ),
  }));

  const normalized = {
    title: localized.title.trim() || fallback.title,
    description: optionalString(localized.description) ?? inLanguage(fallback.description),
    cuisine: optionalString(localized.cuisine) ?? inLanguage(fallback.cuisine),
    meal_type: optionalString(localized.meal_type) ?? inLanguage(fallback.meal_type),
    ingredients: normalizedIngredients,
    // Step ingredients are matched to this language's own ingredient names;
    // matching the source-language names would drop every translated one.
    steps: linkStepIngredients(normalizedSteps, normalizedIngredients),
  } satisfies LocalizedRecipeText;

  if (language === "ar") {
    assertArabicContentQuality(normalized);
  } else {
    assertEnglishContentQuality(normalized);
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
            maxTokens: RECIPE_MAX_TOKENS,
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

type RecipeLanguage = "en" | "ar";

/** True when the draft has complete content in `language`, written in that language. */
export function hasUsableLocalizedContent(draft: RecipeDraft, language: RecipeLanguage): boolean {
  const localized = draft.localized?.[language];
  if (!localized) return false;
  if (
    localized.ingredients.length !== draft.ingredients.length ||
    localized.steps.length !== draft.steps.length
  ) {
    return false;
  }

  const arabicLetters = (localized.title.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latinLetters = (localized.title.match(/[A-Za-z]/g) ?? []).length;
  return language === "ar" ? arabicLetters > 0 && arabicLetters >= latinLetters : latinLetters > arabicLetters;
}

export function getMissingLocalizedLanguages(draft: RecipeDraft): RecipeLanguage[] {
  return (["en", "ar"] as const).filter((language) => !hasUsableLocalizedContent(draft, language));
}

/**
 * Generates whichever of the English and Arabic versions a draft lacks. A
 * language that still fails is reported in `failed` and left out of the draft.
 */
export async function completeLocalizedContent(
  draft: RecipeDraft,
  sourceText = ""
): Promise<{ draft: RecipeDraft; filled: RecipeLanguage[]; failed: RecipeLanguage[] }> {
  const missing = getMissingLocalizedLanguages(draft);
  if (missing.length === 0) return { draft, filled: [], failed: [] };

  // Unusable content must not seed the new attempt or survive a failed one.
  const localized: NonNullable<RecipeDraft["localized"]> = { ...(draft.localized ?? {}) };
  for (const language of missing) delete localized[language];
  const base: RecipeDraft = { ...draft, localized };

  const results = await Promise.all(
    missing.map(async (language) => {
      try {
        const { content } = await generateRecipeContent(base, language, sourceText);
        return { language, content };
      } catch {
        return { language, content: null };
      }
    })
  );

  const filled: RecipeLanguage[] = [];
  const failed: RecipeLanguage[] = [];
  for (const { language, content } of results) {
    if (content) {
      localized[language] = content;
      filled.push(language);
    } else {
      failed.push(language);
    }
  }

  return { draft: { ...draft, localized }, filled, failed };
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
          maxTokens: DETAIL_MAX_TOKENS,
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
  const content = await openRouterChatCompletion(
    {
      model: WEB_RESEARCH_MODEL,
      max_tokens: RECIPE_MAX_TOKENS,
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
    },
    { timeoutMs: WEB_RESEARCH_TIMEOUT_MS }
  );

  const parsed = ingredientResearchSchema.parse(parseJsonLenient(content));
  // The search may only fill in ingredients the recipe already has; a name it made up
  // or reworded would otherwise be added to the recipe as a new ingredient.
  const knownKeys = new Set(params.draft.ingredients.map((ingredient) => normalizeIngredientKey(ingredient.name)));
  return {
    ingredients: normalizeResearchIngredients(parsed.ingredients).filter((ingredient) =>
      knownKeys.has(normalizeIngredientKey(ingredient.name))
    ),
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
        maxTokens: DETAIL_MAX_TOKENS,
        temperature: 0.2,
        system: "You estimate missing recipe measurements conservatively and return complete JSON only.",
        prompt: buildForcedMeasurementPrompt(nextDraft),
        abortSignal,
      })
    );

    // An estimate is matched to its ingredient by list number, so a name the model
    // respelled (common with Arabic) still lands on the right ingredient and is never
    // added as a new one.
    const estimates = object.ingredients.flatMap((ingredient) => {
      const numbered = typeof ingredient.number === "number" ? nextDraft.ingredients[ingredient.number - 1] : undefined;
      const key = normalizeIngredientKey(ingredient.name);
      const target =
        numbered && !isIngredientDetailComplete(numbered)
          ? numbered
          : nextDraft.ingredients.find((entry) => normalizeIngredientKey(entry.name) === key);
      return target ? [{ ...ingredient, name: target.name }] : [];
    }).map((ingredient) => ({
      name: ingredient.name.trim(),
      quantity: normalizeQuantity(ingredient.quantity) || ingredient.quantity.trim(),
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

  const failedModels: Array<{ model: string; error: string; ms: number }> = [];
  const startedAt = Date.now();

  for (const candidateModel of EXTRACTION_MODELS) {
    const attemptStartedAt = Date.now();
    try {
      const result = await withAbortTimeout((abortSignal) =>
        generateObject({
          model: providerClient(candidateModel),
          schema: recipeObjectSchema,
          maxTokens: RECIPE_MAX_TOKENS,
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
      failedModels.push({
        model: candidateModel,
        error: truncateForLog(String(error), 300),
        ms: Date.now() - attemptStartedAt,
      });
      console.warn("[import][extract] model failed", { model: candidateModel, error: truncateForLog(String(error)) });
    }
  }

  if (!object || !modelUsed) {
    throw new Error(`OPENROUTER_EXTRACTION_FAILED ${truncateForLog(String(lastError))}`);
  }

  // The model reports when the source has no recipe instead of inventing one.
  if (object.recipe_in_source === false) throw new Error("RECIPE_NOT_IN_SOURCE");

  const draft = normalizeRecipeCandidate(object, input);
  if (!draft) throw new Error("RECIPE_NOT_IN_SOURCE Generated recipe did not pass validation constraints.");

  const extractedAt = Date.now();
  const detailCompletion = await enrichMissingIngredientDetails(draft, input);
  const finalDraft = validateRecipeDraft(detailCompletion.draft);
  if (!finalDraft) throw new Error("Generated recipe did not pass final validation constraints.");

  return {
    draft: finalDraft,
    confidence: {
      provider: "openrouter",
      model: modelUsed,
      extraction_mode: "schema",
      extraction_failed_models: failedModels,
      // Where the time went, for telling a slow model from a slow amount search.
      extraction_ms: extractedAt - startedAt,
      measurement_fill_ms: Date.now() - extractedAt,
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
        maxTokens: DETAIL_MAX_TOKENS,
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
        maxTokens: RECIPE_MAX_TOKENS,
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
  fallback: LocalizedRecipeText["steps"]
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

  // The rewrite fills a language the recipe lacks with source-language text.
  // Storing that would make the recipe look translated when it is not.
  const localized: NonNullable<RecipeDraft["localized"]> = {};
  for (const language of ["en", "ar"] as const) {
    if (draft.localized?.[language]) localized[language] = rewrittenLocalized[language];
  }

  const candidate = validateRecipeDraft({
    ...draftWithScaledIngredients,
    steps: sourceSteps,
    localized,
  });
  if (!candidate) throw new Error("Serving recalculation failed validation.");

  return {
    servings: candidate.servings,
    ingredients: candidate.ingredients,
    steps: candidate.steps,
    localized,
  };
}
