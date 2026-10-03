import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { DEFAULT_FOOD_GLYPH, GLYPH_NAMES, getFoodGlyph } from "./glyphs.ts";

test("matches ingredient names in English and Arabic", () => {
  assert.equal(getFoodGlyph("Basmati rice"), "cooked-rice");
  assert.equal(getFoodGlyph("أرز بسمتي"), "cooked-rice");
  assert.equal(getFoodGlyph("boneless chicken breasts"), "poultry-leg");
  assert.equal(getFoodGlyph("فصوص ثوم"), "garlic");
});

test("prefers the specific match over a broader keyword", () => {
  assert.equal(getFoodGlyph("eggplant"), "eggplant");
  assert.equal(getFoodGlyph("eggs"), "egg");
  assert.equal(getFoodGlyph("coconut milk"), "coconut");
  assert.equal(getFoodGlyph("bell pepper"), "bell-pepper");
  assert.equal(getFoodGlyph("black pepper"), "salt");
});

test("falls back to a neutral glyph for unknown or empty names", () => {
  assert.equal(getFoodGlyph("sumac-ish thing"), DEFAULT_FOOD_GLYPH);
  assert.equal(getFoodGlyph(null), DEFAULT_FOOD_GLYPH);
});

test("every glyph has a rendered image", () => {
  for (const name of GLYPH_NAMES) {
    assert.ok(
      existsSync(new URL(`../../assets/images/glyphs/${name}.png`, import.meta.url)),
      `${name}.png is missing; run scripts/generate-glyphs.mjs`
    );
  }
});
