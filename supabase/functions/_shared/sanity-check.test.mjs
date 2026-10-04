import assert from "node:assert/strict";
import { test } from "node:test";

import { getArabicLocalizationIssues, getArabicTextIssues, runSanityCheck } from "./sanity-check.ts";

const draft = {
  title: "Tomato Pasta",
  cuisine: "Italian",
  meal_type: "Dinner",
  ingredients: [
    {
      name: "tomato",
      quantity: "2",
      unit: "cups",
      source: "caption",
      is_estimated: false,
    },
  ],
  steps: [
    {
      order: 1,
      title: "Cook sauce",
      text: "Cook the tomatoes until saucy.",
      ingredients_used: ["tomato"],
    },
  ],
  source: {
    platform: "instagram",
    url: "https://www.instagram.com/reel/example",
  },
};

test("sanity check returns structured issues instead of throwing on provider failure", async () => {
  const result = await runSanityCheck(draft);

  assert.equal(typeof result.passed, "boolean");
  assert.ok(Array.isArray(result.issues));
  assert.equal(result.passed, false);
  assert.deepEqual(result.issues, ["localized_ar_missing", "sanity_check_unavailable"]);
  assert.equal(result.shouldRetryArabic, true);
  assert.deepEqual(result.arabicIssues, ["localized_ar_missing"]);
});

test("sanity check flags Arabic localization leakage before confirmation", async () => {
  const arabicDraft = {
    ...draft,
    localized: {
      en: {
        title: "Tomato Pasta",
        description: "A simple pasta.",
        cuisine: "Italian",
        meal_type: "Dinner",
        ingredients: [{ name: "tomato" }],
        steps: [{ order: 1, title: "Cook sauce", text: "Cook the tomatoes until saucy." }],
      },
      ar: {
        title: "Tomato Pasta",
        description: "Quick dinner",
        cuisine: "Italian",
        meal_type: "Dinner",
        ingredients: [{ name: "tomato" }],
        steps: [{ order: 1, title: "Cook sauce", text: "Cook the tomatoes until saucy." }],
      },
    },
  };

  assert.ok(getArabicLocalizationIssues(arabicDraft).includes("localized_ar_title_contains_latin"));

  const result = await runSanityCheck(arabicDraft);
  assert.equal(result.shouldRetryArabic, true);
  assert.ok(result.arabicIssues.includes("localized_ar_title_contains_latin"));
  assert.ok(result.issues.includes("sanity_check_unavailable"));
});

test("a Latin word inside Arabic text is accepted, text that is mostly Latin is not", () => {
  assert.deepEqual(getArabicTextIssues("سخني الفرن على 180 درجة"), []);
  assert.deepEqual(getArabicTextIssues("ضعي الدجاج في القلاية الهوائية Air Fryer لمدة 15 دقيقة"), []);
  assert.deepEqual(getArabicTextIssues("صوص BBQ"), []);
  assert.deepEqual(getArabicTextIssues("Cook the tomatoes مع ملح"), ["contains_latin"]);
  assert.deepEqual(getArabicTextIssues("Tomato Pasta"), ["contains_latin", "missing_arabic"]);
  assert.deepEqual(getArabicTextIssues("180"), ["missing_arabic"]);
});
