import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_FOOD_EMOJI, getFoodEmoji } from "./food-emoji.ts";

test("matches ingredient names in English and Arabic", () => {
  assert.equal(getFoodEmoji("Basmati rice"), "🍚");
  assert.equal(getFoodEmoji("أرز بسمتي"), "🍚");
  assert.equal(getFoodEmoji("boneless chicken breasts"), "🍗");
  assert.equal(getFoodEmoji("فصوص ثوم"), "🧄");
});

test("prefers the specific match over a broader keyword", () => {
  assert.equal(getFoodEmoji("eggplant"), "🍆");
  assert.equal(getFoodEmoji("eggs"), "🥚");
  assert.equal(getFoodEmoji("coconut milk"), "🥥");
  assert.equal(getFoodEmoji("bell pepper"), "🫑");
  assert.equal(getFoodEmoji("black pepper"), "🧂");
});

test("falls back to a neutral icon for unknown or empty names", () => {
  assert.equal(getFoodEmoji("sumac-ish thing"), DEFAULT_FOOD_EMOJI);
  assert.equal(getFoodEmoji(null), DEFAULT_FOOD_EMOJI);
});
