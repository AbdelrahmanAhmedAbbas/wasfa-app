import type { RecipeDraft } from "./types.ts";

export const SANITY_CHECK_MODEL = "anthropic/claude-haiku-4.5";

export type SanityCheckResult = {
  passed: boolean;
  issues: string[];
  shouldRetryArabic: boolean;
  arabicIssues: string[];
};

function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env variable: ${name}`);
  return value;
}

function buildSanityCheckPrompt(draft: RecipeDraft): string {
  return `Check this extracted recipe for obvious extraction mistakes. Return JSON only with {"passed":boolean,"issues":string[]}.

Flag issues such as missing core ingredients, impossible quantities, steps that do not use listed ingredients, contradictory timing, non-recipe content, or unsafe cooking instructions. Keep issues concise and operator-readable. Do not suggest user-facing corrections.

Recipe JSON:
${JSON.stringify(draft)}`;
}

/**
 * What is wrong with a piece of text that should be Arabic. A Latin word inside Arabic
 * text is normal in recipes (a brand, "BBQ", "Air Fryer"), so Latin letters only count
 * against the text when they outnumber the Arabic ones.
 */
export function getArabicTextIssues(value: string): string[] {
  const arabicLetters = (value.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latinLetters = (value.match(/[A-Za-z]/g) ?? []).length;
  const issues: string[] = [];
  if (latinLetters > arabicLetters) issues.push("contains_latin");
  if (arabicLetters === 0) issues.push("missing_arabic");
  return issues;
}

function collectArabicFieldIssues(value: string | undefined, prefix: string): string[] {
  if (!value?.trim()) return [];
  return getArabicTextIssues(value).map((issue) => `${prefix}_${issue}`);
}

export function getArabicLocalizationIssues(draft: RecipeDraft): string[] {
  const localizedArabic = draft.localized?.ar;
  if (!localizedArabic) return ["localized_ar_missing"];

  const issues = [
    ...collectArabicFieldIssues(localizedArabic.title, "localized_ar_title"),
    ...collectArabicFieldIssues(localizedArabic.description, "localized_ar_description"),
    ...collectArabicFieldIssues(localizedArabic.cuisine, "localized_ar_cuisine"),
    ...collectArabicFieldIssues(localizedArabic.meal_type, "localized_ar_meal_type"),
  ];

  const expectedIngredientCount = draft.localized?.en?.ingredients.length ?? draft.ingredients.length;
  const expectedStepCount = draft.localized?.en?.steps.length ?? draft.steps.length;

  if (localizedArabic.ingredients.length !== expectedIngredientCount) {
    issues.push("localized_ar_ingredient_count_mismatch");
  }
  if (localizedArabic.steps.length !== expectedStepCount) {
    issues.push("localized_ar_step_count_mismatch");
  }

  localizedArabic.ingredients.forEach((ingredient, index) => {
    issues.push(...collectArabicFieldIssues(ingredient.name, `localized_ar_ingredient_${index + 1}_name`));
    issues.push(...collectArabicFieldIssues(ingredient.notes, `localized_ar_ingredient_${index + 1}_notes`));
  });

  localizedArabic.steps.forEach((step, index) => {
    issues.push(...collectArabicFieldIssues(step.title, `localized_ar_step_${index + 1}_title`));
    issues.push(...collectArabicFieldIssues(step.text, `localized_ar_step_${index + 1}_text`));
    step.equipment?.forEach((item, itemIndex) => {
      issues.push(
        ...collectArabicFieldIssues(item, `localized_ar_step_${index + 1}_equipment_${itemIndex + 1}`)
      );
    });
    step.ingredients_used?.forEach((item, itemIndex) => {
      issues.push(
        ...collectArabicFieldIssues(item, `localized_ar_step_${index + 1}_ingredients_used_${itemIndex + 1}`)
      );
    });
    step.tips?.forEach((tip, itemIndex) => {
      issues.push(
        ...collectArabicFieldIssues(tip, `localized_ar_step_${index + 1}_tip_${itemIndex + 1}`)
      );
    });
  });

  return issues;
}

export async function runSanityCheck(draft: RecipeDraft): Promise<SanityCheckResult> {
  const arabicIssues = getArabicLocalizationIssues(draft);

  try {
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
      passed: z.boolean(),
      issues: z.array(z.string()),
    });

    const { object } = await generateObject({
      model: openrouter(SANITY_CHECK_MODEL),
      schema,
      maxTokens: 2000,
      temperature: 0,
      system:
        "You are a recipe extraction QA checker. You only produce telemetry for operators.",
      prompt: buildSanityCheckPrompt(draft),
    });

    return {
      passed: object.passed && arabicIssues.length === 0,
      issues: [...arabicIssues, ...object.issues.map((issue) => issue.trim()).filter(Boolean)],
      shouldRetryArabic: arabicIssues.length > 0,
      arabicIssues,
    };
  } catch {
    return {
      passed: false,
      issues: [...arabicIssues, "sanity_check_unavailable"],
      shouldRetryArabic: arabicIssues.length > 0,
      arabicIssues,
    };
  }
}
