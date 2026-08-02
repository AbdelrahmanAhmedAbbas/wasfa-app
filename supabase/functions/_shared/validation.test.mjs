import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function loadValidationModule() {
  const source = readFileSync(new URL("./validation.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });

  const module = { exports: {} };
  const fn = new Function("exports", "module", outputText);
  fn(module.exports, module);
  return module.exports;
}

test("validateRecipeDraft preserves rich procedural step fields", () => {
  const { validateRecipeDraft } = loadValidationModule();

  const draft = validateRecipeDraft({
    title: "Test pasta",
    cuisine: "Italian",
    meal_type: "Dinner",
    ingredients: [
      { name: "pasta", quantity: "200", unit: "g", source: "caption" },
      { name: "water", quantity: "1", unit: "l", source: "ai_estimate", is_estimated: true },
    ],
    steps: [
      {
        order: 1,
        title: "Boil pasta",
        text: "Boil pasta until al dente.",
        duration_minutes: 10,
        temperature: { value: 100, unit: "C" },
        equipment: ["large pot"],
        ingredients_used: ["pasta", "water"],
        tips: ["Salt the water generously."],
      },
      {
        order: 2,
        title: "Drain",
        text: "Drain and serve.",
      },
    ],
    source: { platform: "instagram", url: "https://instagram.com/p/example" },
  });

  assert.ok(draft);
  assert.equal(draft.ingredients[1].source, "ai_estimate");
  assert.equal(draft.ingredients[1].is_estimated, true);
  assert.deepEqual(draft.steps[0], {
    order: 1,
    title: "Boil pasta",
    text: "Boil pasta until al dente.",
    duration_minutes: 10,
    temperature: { value: 100, unit: "C" },
    equipment: ["large pot"],
    ingredients_used: ["pasta", "water"],
    tips: ["Salt the water generously."],
  });
});

test("validateRecipeDraft rejects incomplete ingredient measurements", () => {
  const { validateRecipeDraft } = loadValidationModule();

  const draft = validateRecipeDraft({
    title: "Test pasta",
    cuisine: "Italian",
    meal_type: "Dinner",
    ingredients: [
      { name: "pasta", quantity: "200", unit: "g", source: "caption" },
      { name: "water", source: "caption" },
    ],
    steps: [
      { order: 1, title: "Boil", text: "Boil pasta." },
      { order: 2, title: "Serve", text: "Serve pasta." },
    ],
    source: { platform: "instagram", url: "https://instagram.com/p/example" },
  });

  assert.equal(draft, null);
});

test("resolves TikTok share links to canonical video URLs", async () => {
  const { isSupportedSource, resolveTikTokSourceUrl } = loadValidationModule();

  assert.equal(isSupportedSource("https://vt.tiktok.com/ZSMabc123/"), true);

  const result = await resolveTikTokSourceUrl(
    "https://vt.tiktok.com/ZSMabc123/",
    async () => ({
      url: "https://www.tiktok.com/@chef/video/1234567890123456789?is_from_webapp=1&sender_device=pc",
    })
  );

  assert.deepEqual(result, {
    url: "https://www.tiktok.com/@chef/video/1234567890123456789",
    resolved: true,
  });
});
