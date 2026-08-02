# PRD: Recipe Localization, Measurement Estimation & Import Navigation Fix

## Overview
The recipe detail screen currently shows mixed-language content in English mode (Arabic glued onto English titles, descriptions, and ingredient names), fails to apply Arabic translations in Arabic mode, ignores the user's measurement-system preference, and ships ingredients without measurements when the web-research model returns nothing. There is also a navigation bug where importing a second recipe after the first lands the user on the wrong tab. This work makes recipe text fully bilingual (clean per locale), guarantees every ingredient has a measurement before display, applies the user's metric/imperial preference at render time, and fixes the share-intent dedupe latch in the root layout.

## Goals
- Render every recipe screen strictly in the user's active locale (no script mixing, no duplicates).
- Guarantee every imported ingredient has a quantity + unit before the recipe is shown — fully AI-driven, zero manual review.
- Reflect the user's measurement-system setting (metric vs imperial) on ingredient quantities and step temperatures.
- Translate every hardcoded UI label on the recipe detail screen.
- Allow back-to-back recipe imports without navigation regressions.

## Non-Goals
- Backfilling existing recipes that contain dual-language artifacts. The user will delete those rows manually.
- Adding any user-facing manual review / fill-in UI for ingredient measurements.
- Re-translating ingredient names on serving recalculation.
- Per-ingredient density tables (count-based units stay as authored).

## User Stories
- As an English-speaking user, I want recipe titles, descriptions, ingredients, and steps to appear only in English so that the screen is readable and not duplicated.
- As an Arabic-speaking user, I want recipe titles, descriptions, ingredients, and steps to be translated to Arabic so that I can read the recipe in my language.
- As a user with imperial preference, I want quantities in cups/oz/lb/°F so that I don't have to convert in my head; metric users want the inverse.
- As a user, I want every ingredient to have a measurement when I open the recipe so that I know how much to buy/use without guessing.
- As a user, I want to import a second recipe right after the first one and land on the import progress screen, not on a random tab.

## Technical Design

### Modules Affected

#### Backend (Supabase Edge Functions)
- **`supabase/functions/_shared/ai.ts`**
  - Replace `WEB_RESEARCH_MODEL = "google/gemini-3-flash-preview:online"` with `google/gemini-2.5-pro` and pass `plugins: [{ id: "web" }]` in the chat-completion body.
  - Add a forced-fill stage after web search: any ingredient still missing measurement after `mergeIngredientSources` runs through a deterministic LLM call with a Zod schema where `quantity` and `unit` are non-nullable. Output marked `source: "ai_estimate"`.
  - Update extraction prompt: drop "Preserve original language wording where possible"; replace with "Use exactly one language per field. Never mix scripts inside a single string."
  - Extend `localizedTextSchema` to include `cuisine` and `meal_type` fields. `translateRecipeText` returns these.
  - `recalculateRecipeServings`: split into two paths — proportional numeric scaling for ingredient quantities (no LLM call), and a step-text-only LLM rewrite call that updates both `localized.en.steps` and `localized.ar.steps`. Top-level `steps_json` updated with the source-language version.

- **`supabase/functions/_shared/ingredient-details.ts`**
  - Add a `forceFillIngredientMeasurements` helper invoked after `enrichMissingIngredientDetails`; loops until `isIngredientDetailComplete` returns true for every ingredient.
  - Tighten the post-pipeline invariant: `validateRecipeDraft` should reject a draft where any ingredient lacks measurement.

- **`supabase/functions/_shared/types.ts`**
  - Extend `RecipeDraft["localized"]["en"|"ar"]` to include `cuisine?: string` and `meal_type?: string`.

- **`supabase/functions/_shared/validation.ts`**
  - Add an assertion that every ingredient passes `isIngredientDetailComplete` before persistence.

- **`supabase/functions/recipe-recalculate/index.ts`**
  - Adopt the split scaling logic. Ingredient scaling local; step rewrite via AI; both localized blocks updated.

#### Frontend
- **`app/recipe/[id].tsx`**
  - Read all recipe text from `recipe.localized[currentLanguage]`: title, description, cuisine, meal_type, ingredient names, step titles, step text, tips, equipment, ingredients_used.
  - Quantity / unit / size / preparation continue to come from `ingredients_json`.
  - Apply opposite-script strip-fallback: if the localized string for the active locale still contains opposite-script characters, render the cleaned version.
  - Replace hardcoded English literals with `t()` keys: Nutrition, Ingredients, Instructions, Servings, Chef's Tip + body, Tip toggle, Protein, Carbs, Fats, Calories, "X mins" (plural-aware), `Step N` fallback.
  - In `getIngredientAmount`, convert the quantity according to `preferences.measurementSystem` via the new units helper. Count-based units bypassed.
  - Convert step temperatures (`step.temperature.unit`) to user's preference at render.

- **`app/(tabs)/index.tsx`**
  - Recipe cards (line ~534, ~547) read from `recipe.localized[currentLanguage]`.
  - Search filter (line ~143) matches against `localized.en.title`, `localized.ar.title`, and top-level `title` (cross-language searchability).

- **`app/(tabs)/grocery.tsx`**
  - Grocery grouping label uses `recipe.localized[currentLanguage].title`. Group key remains `recipe.id` for stability.

- **`app/_layout.tsx`**
  - Drop the `hasRedirected = useRef(false)` boolean latch. Replace with a key-based dedupe: `lastShareKey = useRef<string | null>(null)` storing the most recent share signature (`url ?? text ?? mediaUri`). The effect runs only when `currentKey !== lastShareKey.current`. Updates `lastShareKey.current = currentKey` before redirecting.

- **`lib/i18n/translations.ts`**
  - Add missing keys (en + ar): `nutrition`, `instructions`, `protein`, `carbs`, `fats`, `chefTipTitle`, `chefTipBody`, `tipLabel`, `durationMinutes` (with Arabic dual/plural form), `stepN` (with `{order}` placeholder), recipe meal-type/cuisine fallbacks.

- **`lib/recipes/client.ts`**
  - Extend `RecipeDetail.localized.en|ar` type to surface `cuisine` and `meal_type`.

- **`lib/recipes/rich-step-display.ts`**
  - `formatStepMetaItems` and `getSafeStepTitle` accept a localized step object instead of the raw step. Temperature unit conversion happens here for step meta pills.

### New Modules Needed

- **`lib/recipes/units.ts`** (new)
  - `convertIngredientAmount(item, system: "metric" | "imperial"): { quantity, unit }` — applies a static conversion table (cup ↔ ml, oz ↔ g, lb ↔ kg, fl-oz ↔ ml). Count-based units short-circuit.
  - `convertTemperature(value, fromUnit, toSystem)` — C ↔ F.
  - `isCountBasedUnit(unit)` — predicate to short-circuit conversion.
  - Unit table is a single source of truth used by both ingredient and step meta rendering.

### Interface Changes

- `RecipeDraft.localized.en` and `RecipeDraft.localized.ar` gain `cuisine?: string` and `meal_type?: string`.
- `localizedTextSchema` (Zod) gains `cuisine` and `meal_type` optional string fields.
- `recalculateRecipeServings` return type gains `localized` block (or returns a richer object that the function persists into the row).
- New ingredient research / forced-fill schema requires non-nullable `quantity` and `unit`.
- `WEB_RESEARCH_MODEL` constant changes value; web-search transport switches from `:online` suffix to `plugins: [{id: "web"}]` body parameter.

## Open Questions

None outstanding — every branch resolved during the design interview. If implementation surfaces ambiguity (e.g. specific Arabic translation phrasing, edge cases in unit conversion for unusual units like "punnet" or "carton"), those will be decided in code review.

## Success Criteria

- Importing a recipe in any source language produces a row whose `localized.en` is exclusively English (no Arabic characters) and `localized.ar` is exclusively Arabic (no Latin characters).
- Recipe detail screen in English locale renders zero Arabic characters across title, description, ingredient names, step text, tips, cuisine pill, and meal-type pill. Same screen in Arabic locale renders the Arabic versions of all those fields.
- Every imported recipe has `quantity` and `unit` (or count-based size) populated for every ingredient. No `-` placeholder in the right-side amount column on the recipe detail.
- Toggling measurement system in profile changes ingredient quantities and step temperatures on the recipe detail screen on next navigation/render. Count-based units are unchanged across modes.
- All static UI labels on the recipe detail screen (Nutrition, Ingredients, Instructions, Servings, Chef's Tip, Tip toggle, macro labels, "X mins") render in the active locale.
- Sharing two recipes back-to-back from Instagram/TikTok routes the user through `/import → /import/[jobId]` for each share, with no flash to a tab and no skipped redirect.
- `npm test && npm run lint` passes.
