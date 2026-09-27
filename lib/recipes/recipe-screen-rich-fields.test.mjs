import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("recipe detail screen renders rich step fields and estimated ingredient badges", () => {
  const screen = readFileSync(new URL("../../app/recipe/[id].tsx", import.meta.url), "utf8");

  assert.match(screen, /getEstimatedIngredientLabel/);
  assert.match(screen, /estimatedIngredientBadge/);
  assert.match(screen, /Estimated/);

  assert.match(screen, /getSafeStepTitle/);
  assert.match(screen, /formatStepMetaItems/);
  assert.match(screen, /stepMetaPill/);
  assert.match(screen, /item\.tips/);
  assert.match(screen, /expandedTipSteps/);
  assert.match(screen, /Tip/);
  assert.match(screen, /writingDirection/);
});

test("recipe detail screen reads localized recipe content and translated labels", () => {
  const screen = readFileSync(new URL("../../app/recipe/[id].tsx", import.meta.url), "utf8");

  assert.match(screen, /language/);
  assert.match(screen, /getLocalizedRecipeText/);
  assert.match(screen, /getLocalizedFieldValue/);
  assert.match(screen, /toArabicIndicDigits/);
  assert.match(screen, /recipeText\.title/);
  assert.match(screen, /localizedIngredients/);
  assert.match(screen, /convertIngredientAmount/);
  assert.match(screen, /t\("nutrition"/);
  assert.match(screen, /t\("instructions"/);
  assert.match(screen, /t\("chefTipTitle"/);
  assert.match(screen, /t\("durationMinutes"/);
  assert.doesNotMatch(screen, /<SectionTitle title="Nutrition"/);
  assert.doesNotMatch(screen, />Chef's Tip</);
});
