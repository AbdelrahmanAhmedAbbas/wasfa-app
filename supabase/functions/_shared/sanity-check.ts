import type { RecipeDraft } from "./types.ts";

export const SANITY_CHECK_MODEL = "anthropic/claude-haiku-4.5";

export type SanityCheckResult = {
  passed: boolean;
  issues: string[];
};

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

export async function runSanityCheck(draft: RecipeDraft): Promise<SanityCheckResult> {
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
      temperature: 0,
      system:
        "You are a recipe extraction QA checker. You only produce telemetry for operators.",
      prompt: buildSanityCheckPrompt(draft),
    });

    return {
      passed: object.passed,
      issues: object.issues.map((issue) => issue.trim()).filter(Boolean),
    };
  } catch {
    return {
      passed: false,
      issues: ["sanity_check_unavailable"],
    };
  }
}
