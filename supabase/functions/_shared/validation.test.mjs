import assert from "node:assert/strict";
import { test } from "node:test";

import * as validation from "./validation.ts";

function loadValidationModule() {
  return validation;
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

test("treats only YouTube Short links as a supported YouTube source", () => {
  const { detectSourcePlatform, isSupportedSource } = loadValidationModule();

  for (const url of [
    "https://youtube.com/shorts/abcDEF12345?si=XyZ",
    "https://www.youtube.com/shorts/abcDEF12345",
    "https://m.youtube.com/shorts/abcDEF12345/",
  ]) {
    assert.equal(isSupportedSource(url), true, `${url} should be supported`);
    assert.equal(detectSourcePlatform(url), "youtube");
  }

  for (const url of [
    "https://www.youtube.com/watch?v=abcDEF12345",
    "https://youtu.be/abcDEF12345",
    "https://music.youtube.com/shorts/abcDEF12345",
    "https://www.youtube-nocookie.com/embed/abcDEF12345",
    "https://www.youtube.com/shorts/abcDEF12345/extra",
  ]) {
    assert.equal(isSupportedSource(url), false, `${url} should not be supported`);
  }

  assert.equal(detectSourcePlatform("https://music.youtube.com/shorts/abcDEF12345"), "unknown");
  assert.equal(detectSourcePlatform("https://www.instagram.com/reel/ABC123/"), "instagram");
  assert.equal(detectSourcePlatform("https://vm.tiktok.com/ZSMabc123/"), "tiktok");
});

test("finds the link in shared text that has a title before it or punctuation after it", () => {
  const { extractFirstUrl } = loadValidationModule();

  assert.equal(
    extractFirstUrl("Chicken kabsa in 60 seconds https://youtube.com/shorts/abcDEF12345?si=XyZ"),
    "https://youtube.com/shorts/abcDEF12345?si=XyZ"
  );
  assert.equal(
    extractFirstUrl("Watch this (https://www.youtube.com/shorts/abcDEF12345)."),
    "https://www.youtube.com/shorts/abcDEF12345"
  );
  assert.equal(
    extractFirstUrl("https://www.instagram.com/reel/ABC123/"),
    "https://www.instagram.com/reel/ABC123/"
  );
  assert.equal(extractFirstUrl("no link here"), null);
});
