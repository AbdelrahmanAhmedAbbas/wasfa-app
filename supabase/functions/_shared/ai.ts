import { generateObject } from "npm:ai@4.1.56";
import { createOpenAI } from "npm:@ai-sdk/openai@1.3.23";
import { z } from "npm:zod@3.24.2";

import type { IngredientItem, NutritionEstimate, RecipeDraft, SourcePlatform } from "./types.ts";
import {
  hasIngredientsNeedingReview,
  markIngredientReviewStates,
  mergeIngredientSources,
} from "./ingredient-details.ts";
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

export type VisualRecipeTextResult = {
  text: string;
  ingredients: IngredientItem[];
  visibleTextCount: number;
  model: string;
};

type IngredientResearchResult = {
  ingredients: IngredientItem[];
  citations: string[];
  model: string;
};

const GEMINI_PARSER_MODEL = "google/gemini-2.5-flash";
const GEMINI_TRANSLATE_MODEL = "google/gemini-2.5-flash";
const GEMINI_NUTRITION_MODEL = "google/gemini-2.5-flash";
const GEMINI_VISUAL_MODEL = "google/gemini-2.5-flash";
const GEMINI_RESEARCH_MODEL = "google/gemini-2.5-flash";

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
      preparation: z.string().nullable().optional(),
      size: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      source: z.enum(["caption", "transcript", "video_ocr", "web_research", "user_edit"]).nullable().optional(),
      confidence: z.number().min(0).max(1).nullable().optional(),
      evidence_text: z.string().nullable().optional(),
      citation_url: z.string().nullable().optional(),
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

const missingDetailsSchema = z.object({
  description: z.string().nullable().optional(),
  prep_minutes: z.number().nullable().optional(),
  cook_minutes: z.number().nullable().optional(),
});

const visualRecipeTextSchema = z.object({
  visible_text: z.array(
    z.object({
      timestamp_seconds: z.number().nullable().optional(),
      text: z.string().min(1),
    })
  ),
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.string().nullable().optional(),
      unit: z.string().nullable().optional(),
      preparation: z.string().nullable().optional(),
      size: z.string().nullable().optional(),
      alternatives: z.array(z.string()).optional(),
      confidence: z.number().min(0).max(1).nullable().optional(),
      evidence_text: z.string().nullable().optional(),
    })
  ),
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

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function openRouterChatCompletion(body: Record<string, unknown>): Promise<string> {
  const apiKey = requiredEnv("OPENROUTER_API_KEY");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://meal-planner.app",
      "X-Title": "Meal Planner Import",
    },
    body: JSON.stringify(body),
  });

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
- Infer servings, ingredient quantities, and ordered steps from transcript + caption + metadata + video OCR context.
- Ingredient names alone are incomplete. For each ingredient, preserve exact quantity/unit/size details such as 150 g, 2 tbsp, 3 slices, 1 piece, 1 whole, 500 ml, 1 can, 2 cloves, etc.
- Put preparation details like cooked, diced, chopped, or sliced in preparation, not in the ingredient name when possible.
- Use source="video_ocr" for ingredient details found in visible on-screen text, source="caption" for caption text, source="transcript" for speech, and source="web_research" for cited web fallback text.
- Include evidence_text when the source text explicitly contains the amount or visible overlay line.
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
  .map((ingredient) =>
    `${ingredient.quantity ?? ""} ${ingredient.unit ?? ""} ${ingredient.size ?? ""} ${ingredient.name} ${ingredient.preparation ?? ""}`.trim()
  )
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
    `${index + 1}. ${ingredient.quantity ?? ""} ${ingredient.unit ?? ""} ${ingredient.size ?? ""} ${ingredient.name} ${ingredient.preparation ?? ""} ${ingredient.notes ?? ""}`.trim()
  )
  .join("\n")}
Steps:
${draft.steps.map((step) => `${step.order}. ${step.text}`).join("\n")}
`;
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

  return `Research missing recipe ingredient quantities for the same social recipe.
Rules:
- Use web search only to find the same recipe, same creator page, or a repost containing the same recipe.
- Return JSON only using this shape: {"ingredients":[],"citations":[]}.
- Fill quantity/unit/size only when a matching source explicitly shows the amount.
- Every filled ingredient must include evidence_text and citation_url.
- Do not infer from general cooking knowledge.
- If no cited evidence is found, return the ingredient without quantity/unit/size.

Source URL: ${params.sourceUrl}
Source platform: ${params.sourcePlatform}
Recipe title: ${params.draft.title}
Missing ingredient details:
${missing || "(none)"}

Known source context:
${truncateForPrompt(params.sourceText)}`;
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
      preparation: optionalString(item.preparation),
      size: optionalString(item.size),
      notes: optionalString(item.notes),
      source: item.source ?? undefined,
      confidence: optionalPositiveNumber(item.confidence),
      evidence_text: optionalString(item.evidence_text),
      citation_url: optionalString(item.citation_url),
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

function normalizeResearchIngredients(
  ingredients: z.infer<typeof ingredientResearchSchema>["ingredients"]
): IngredientItem[] {
  return ingredients.map((ingredient) => ({
    name: ingredient.name.trim(),
    quantity: optionalString(ingredient.quantity),
    unit: optionalString(ingredient.unit),
    preparation: optionalString(ingredient.preparation),
    size: optionalString(ingredient.size),
    notes: optionalString(ingredient.notes),
    source: "web_research",
    confidence: optionalPositiveNumber(ingredient.confidence),
    evidence_text: optionalString(ingredient.evidence_text),
    citation_url: optionalString(ingredient.citation_url),
  }));
}

export async function extractVisualRecipeText(media: {
  buffer: Uint8Array;
  mimeType: string;
  filename: string;
}): Promise<VisualRecipeTextResult> {
  const videoDataUrl = `data:${media.mimeType || "video/mp4"};base64,${uint8ToBase64(media.buffer)}`;
  const content = await openRouterChatCompletion({
    model: GEMINI_VISUAL_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Read visible on-screen recipe text from this short cooking video. Focus on ingredient overlays and exact measurements. Return JSON only with visible_text and ingredients. Do not infer missing amounts.",
          },
          {
            type: "video_url",
            video_url: {
              url: videoDataUrl,
            },
          },
        ],
      },
    ],
  });

  const parsed = visualRecipeTextSchema.parse(parseJsonLenient(content));
  const visibleLines = parsed.visible_text.map((entry) => {
    const prefix =
      typeof entry.timestamp_seconds === "number" ? `[${entry.timestamp_seconds}s] ` : "";
    return `${prefix}${entry.text.trim()}`;
  });
  const ingredients = parsed.ingredients.map((ingredient) => {
    const alternatives = ingredient.alternatives?.filter((value) => value.trim()).join(", ");
    const notes = alternatives ? `Alternatives: ${alternatives}` : undefined;
    return {
      name: ingredient.name.trim(),
      quantity: optionalString(ingredient.quantity),
      unit: optionalString(ingredient.unit),
      preparation: optionalString(ingredient.preparation),
      size: optionalString(ingredient.size),
      notes,
      source: "video_ocr" as const,
      confidence: optionalPositiveNumber(ingredient.confidence),
      evidence_text: optionalString(ingredient.evidence_text),
    };
  });

  return {
    text: [...visibleLines, ...ingredients.map((ingredient) => ingredient.evidence_text).filter(Boolean)].join("\n"),
    ingredients: markIngredientReviewStates(ingredients),
    visibleTextCount: visibleLines.length,
    model: GEMINI_VISUAL_MODEL,
  };
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

async function fillMissingRecipeDetails(
  draft: RecipeDraft,
  input: RecipeInput
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

    const { object } = await generateObject({
      model,
      schema: missingDetailsSchema,
      temperature: 0.2,
      system:
        "You complete missing recipe metadata conservatively and never modify ingredients or steps.",
      prompt: buildMissingDetailsPrompt({
        draft,
        sourceText: input.sourceText,
      }),
    });

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

async function researchMissingIngredientDetails(params: {
  draft: RecipeDraft;
  input: RecipeInput;
}): Promise<IngredientResearchResult> {
  const content = await openRouterChatCompletion({
    model: GEMINI_RESEARCH_MODEL,
    tools: [{ type: "openrouter:web_search" }],
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
    model: GEMINI_RESEARCH_MODEL,
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
    const research = await researchMissingIngredientDetails({
      draft: reviewedDraft,
      input,
    });
    const mergedIngredients = mergeIngredientSources([
      ...reviewedDraft.ingredients,
      ...research.ingredients,
    ]);
    return {
      draft: {
        ...reviewedDraft,
        ingredients: mergedIngredients,
      },
      researchAttempted: true,
      researchIngredients: research.ingredients.length,
      researchCitations: research.citations,
      researchFailed: false,
    };
  } catch {
    return {
      draft: reviewedDraft,
      researchAttempted: true,
      researchIngredients: 0,
      researchCitations: [],
      researchFailed: true,
    };
  }
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

  const detailCompletion = await enrichMissingIngredientDetails(draft, input);
  const completion = await fillMissingRecipeDetails(detailCompletion.draft, input);
  const finalDraft = completion.draft;
  finalDraft.localized = await buildBilingualLocalization(finalDraft);

  return {
    draft: finalDraft,
    confidence: {
      provider: "openrouter",
      model: GEMINI_PARSER_MODEL,
      extraction_mode: "schema",
      missing_fields_completed: {
        description: completion.filledDescription,
        prep_minutes: completion.filledPrepMinutes,
        cook_minutes: completion.filledCookMinutes,
      },
      ingredient_review: {
        needs_review: hasIngredientsNeedingReview(finalDraft.ingredients),
        web_research_attempted: detailCompletion.researchAttempted,
        web_research_failed: detailCompletion.researchFailed,
        web_research_ingredients: detailCompletion.researchIngredients,
        web_research_citations: detailCompletion.researchCitations,
        web_research_model: detailCompletion.researchAttempted ? GEMINI_RESEARCH_MODEL : null,
      },
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
