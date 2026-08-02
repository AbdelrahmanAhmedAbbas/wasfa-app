import type { IngredientItem, RecipeDraft, StepItem } from "./types.ts";

export const STEP_REWRITER_MODEL = "anthropic/claude-haiku-4.5";

type RewriteLanguage = "en" | "ar";

type RewriteResult = {
  steps: StepItem[];
  model: string;
};

export function normalizeIngredientNameForLinking(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  return normalized
    .split(" ")
    .map((word) => {
      if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
      if (word.endsWith("oes") && word.length > 4) return word.slice(0, -2);
      if (word.endsWith("ses") && word.length > 4) return word.slice(0, -2);
      if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
      return word;
    })
    .join(" ");
}

export function linkStepIngredients(
  steps: StepItem[],
  ingredients: Array<Pick<IngredientItem, "name">>
): StepItem[] {
  const canonicalByKey = new Map(
    ingredients.map((ingredient) => [normalizeIngredientNameForLinking(ingredient.name), ingredient.name])
  );

  return steps.map((step) => ({
    ...step,
    ingredients_used: step.ingredients_used
      ?.map((name) => canonicalByKey.get(normalizeIngredientNameForLinking(name)))
      .filter((name): name is string => !!name),
  }));
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env variable: ${name}`);
  return value;
}

function buildPrompt(draft: RecipeDraft, language: RewriteLanguage): string {
  const languageLabel = language === "ar" ? "Arabic" : "English";
  return `Rewrite these recipe steps as clear procedural cooking instructions in ${languageLabel}.
Rules:
- Return JSON only with {"steps":[]}.
- Preserve step order and culinary meaning.
- Each step needs title, text, and optional duration_minutes, temperature, equipment, ingredients_used, tips.
- ingredients_used must use names from the ingredient list when possible.
- Write naturally for a home cook; do not use transcript fragments.

Recipe: ${draft.title}
Ingredients:
${draft.ingredients.map((ingredient) => `- ${ingredient.quantity ?? ""} ${ingredient.unit ?? ""} ${ingredient.name}`.trim()).join("\n")}
Current steps:
${draft.steps.map((step) => `${step.order}. ${step.title}: ${step.text}`).join("\n")}`;
}

export async function rewriteStepsForLanguage(
  draft: RecipeDraft,
  language: RewriteLanguage
): Promise<RewriteResult> {
  const { generateObject } = await import("npm:ai@4.1.56");
  const { createOpenAI } = await import("npm:@ai-sdk/openai@1.3.23");
  const { z } = await import("npm:zod@3.24.2");

  const openrouter = createOpenAI({
    apiKey: requiredEnv("OPENROUTER_API_KEY"),
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      "HTTP-Referer": "https://meal-planner.app",
      "X-Title": "Meal Planner Import",
    },
  });

  const schema = z.object({
    steps: z.array(
      z.object({
        order: z.number().int().positive(),
        title: z.string().nullable().optional(),
        text: z.string().min(1),
        duration_minutes: z.number().nullable().optional(),
        temperature: z
          .object({ value: z.number(), unit: z.enum(["C", "F"]) })
          .nullable()
          .optional(),
        equipment: z.array(z.string()).nullable().optional(),
        ingredients_used: z.array(z.string()).nullable().optional(),
        tips: z.array(z.string()).nullable().optional(),
      })
    ),
  });

  const { object } = await generateObject({
    model: openrouter(STEP_REWRITER_MODEL),
    schema,
    temperature: 0.2,
    system: "You rewrite recipe instructions into concise procedural cooking steps.",
    prompt: buildPrompt(draft, language),
  });

  const normalizedSteps = object.steps.map((step, index) => {
    const order = step.order || index + 1;
    const title = (typeof step.title === "string" ? step.title.trim() : "") || `Step ${order}`;
    return {
      order,
      title,
      text: step.text.trim(),
      duration_minutes:
        typeof step.duration_minutes === "number" && Number.isFinite(step.duration_minutes)
          ? step.duration_minutes
          : undefined,
      temperature: step.temperature ?? undefined,
      equipment: Array.isArray(step.equipment) ? step.equipment.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : undefined,
      ingredients_used: Array.isArray(step.ingredients_used) ? step.ingredients_used.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : undefined,
      tips: Array.isArray(step.tips) ? step.tips.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : undefined,
    };
  });

  return {
    steps: linkStepIngredients(normalizedSteps, draft.ingredients),
    model: STEP_REWRITER_MODEL,
  };
}
