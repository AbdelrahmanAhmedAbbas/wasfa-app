# PRD: Recipe Import Details and Preferences

## Overview
Improve the imported recipe experience so recipe details feel accurate, personal, and actionable. The recipe details screen should show meaningful recipe classification, editable servings, clearer nutrition, ingredient checklist UI, and user-specific dietary warnings. Import should store enough recipe metadata to support cuisine, meal type, dietary conflicts, and suggested alternatives, while settings should let users edit the preferences that affect imported recipes after onboarding.

## Goals
- Replace source/generic header tags with two useful recipe tags: cuisine and meal type.
- Let users edit servings from the recipe details screen and automatically recalculate ingredients and steps after a short pause.
- Keep nutrition values per serving and remove the duplicate top calories pill.
- Show ingredients in a compact checkbox row style where checked means "already have" and unchecked means "need this."
- Use latest user preferences to flag allergy and dietary conflicts on ingredients.
- Show non-halal warnings with suggested halal alternatives without automatically changing the recipe.
- Remove recipe details bottom navigation and the separate Add to Grocery List button.
- Make top overlay share and delete actions reliable.
- Add Profile settings for recipe preferences that affect import and recipe display.

## Non-Goals
- Do not implement add-to-menu, planner, or grocery-list routing in this phase.
- Do not persist ingredient checkbox state across app sessions.
- Do not automatically replace non-halal ingredients.
- Do not add dislikes, avoided ingredients, or disliked cuisine preferences.
- Do not add real recipe ratings.
- Do not redesign the full recipe import review screen unless required for the metadata model.

## User Stories
- As a user viewing an imported recipe, I want to see its cuisine and meal type so that I understand what kind of recipe it is without seeing implementation/source labels.
- As a user cooking for a different group size, I want to change servings and have ingredients update automatically so that the recipe remains usable.
- As a user tracking nutrition, I want nutrition to be shown per serving so that values stay meaningful when servings change.
- As a user checking what to buy, I want ingredient checkboxes where checked means I already have it so that I can quickly mark what I do not need.
- As a user with allergies, I want unsafe ingredients to be highlighted in red so that I can avoid them.
- As a halal user, I want non-halal ingredients flagged with halal alternatives so that I can adapt recipes safely.
- As a user, I want to update recipe preferences in settings so that old and new recipes reflect my current needs.
- As a user, I want to share or delete a recipe from the details screen so that recipe management works without extra navigation.

## Technical Design

### Modules Affected
- `app/recipe/[id].tsx`
  - Replace header tag column with cuisine and meal type pills.
  - Remove source platform pill, generic Recipe pill, hardcoded rating, and top calories meta pill.
  - Add editable servings control with debounced recalculation state.
  - Remove bottom tab navigation from this screen.
  - Remove Add to Grocery List action.
  - Add native share action using recipe title, description, and source link when available.
  - Keep delete action and ensure it deletes then navigates away.
  - Update ingredient rows to match compact checkbox visual style.
  - Compute ingredient warning display from recipe metadata plus latest user preferences.

- `lib/recipes/client.ts`
  - Extend `RecipeDetail` with recipe metadata fields such as `cuisine`, `meal_type`, and richer ingredient metadata.
  - Add an update/recalculation client helper for servings changes.
  - Ensure recipe fetch includes new columns.

- `supabase/functions/_shared/types.ts`
  - Extend `RecipeDraft` with required `cuisine` and `meal_type`.
  - Extend ingredient item metadata for dietary flags, allergy category hints, halal status, and suggested alternatives.

- `supabase/functions/_shared/ai.ts`
  - Update extraction schema and prompt to return cuisine and meal type with fallbacks.
  - Ask AI to identify ingredient dietary concerns and halal alternatives.
  - Add a servings recalculation operation that takes the existing recipe plus requested serving count and returns updated ingredients and steps when needed.
  - Keep nutrition as per-serving data.

- `supabase/functions/_shared/validation.ts`
  - Sanitize and validate `cuisine`, `meal_type`, and new ingredient metadata.
  - Apply fallback values: `General` for cuisine and `Meal` for meal type.

- `supabase/functions/_shared/db.ts`
  - Persist recipe metadata into `recipes`.
  - Preserve ingredient metadata in `ingredients_json`.

- `supabase/migrations/*`
  - Add `cuisine text` and `meal_type text` to `recipes`.
  - Consider optional `recipe_preferences` columns only if existing `onboarding_profiles` cannot support settings editing cleanly.

- `app/(tabs)/profile.tsx`
  - Replace the placeholder area with a Recipe Preferences settings section.
  - Let users edit diet, allergies, measurement system, and nutrition display.

- `lib/onboarding/answers.ts`, `lib/onboarding/supabase.ts`, `lib/onboarding/supabase-compat.ts`
  - Reuse existing diet, allergies, measurement system, and nutrition display fields.
  - Add update helpers if Profile settings need direct saves.

- `lib/i18n/translations.ts`
  - Add labels for recipe preferences, serving recalculation states, ingredient warnings, halal alternatives, share text, and settings hints.

### New Modules Needed
- `lib/recipes/preferences.ts`
  - Load current preference values from Supabase profile when signed in and local onboarding answers when needed.
  - Normalize preferences for recipe detail warning logic.

- `lib/recipes/ingredient-warnings.ts`
  - Convert ingredient metadata plus user preferences into display tags.
  - Produce warning severity such as allergy, diet conflict, and halal conflict.

- `supabase/functions/recipe-recalculate/index.ts`
  - Edge function for servings recalculation.
  - Input: recipe id, target servings, optional access/session context.
  - Output: updated servings, ingredients, steps, and unchanged per-serving nutrition unless AI determines the recipe composition changed.

### Interface Changes
- `RecipeDraft`
  - Add `cuisine: string`.
  - Add `meal_type: string`.
  - Ingredient items may include:
    - `dietary_flags?: string[]`
    - `allergen_hints?: string[]`
    - `is_halal?: boolean | null`
    - `halal_concern?: string | null`
    - `suggested_alternative?: string | null`

- `recipes` table
  - Add `cuisine text not null default 'General'`.
  - Add `meal_type text not null default 'Meal'`.
  - Continue storing ingredient-level metadata in `ingredients_json`.

- Recipe recalculation endpoint
  - Request:
    ```json
    {
      "recipe_id": "uuid",
      "servings": 6
    }
    ```
  - Response:
    ```json
    {
      "recipe": {
        "id": "uuid",
        "servings": 6,
        "ingredients_json": [],
        "steps_json": [],
        "nutrition_json": {}
      }
    }
    ```

- Native share content
  - Share title: recipe title.
  - Share message: recipe title, optional description, and source link when available.

## UX Requirements
- Recipe details top overlay keeps back, share, and delete actions.
- Recipe details must not show the bottom tab bar or custom bottom navigation.
- Header tags show exactly cuisine and meal type.
- Servings edits update local UI immediately and trigger AI recalculation after a short debounce.
- Recalculation must ignore stale responses if the user changes servings again before the previous request completes.
- Ingredient rows should be compact, with a small checkbox on the left, ingredient name, optional warning tag below, and amount aligned right.
- Allergy warnings should be red.
- Non-halal warnings should be red and include a suggested alternative when available.
- Measurement preference should have an info hint telling users they can change units in settings.

## Open Questions
- Exact debounce duration for servings recalculation. Recommended: 900-1200ms.
- Whether ingredient amounts should be converted client-side for display or rewritten by AI during import/recalculation. Recommended: AI stores normalized recipe amounts, client formats display based on measurement preference where reliable.
- Whether `cuisine` and `meal_type` should be top-level columns only or also mirrored in `nutrition_json`/metadata. Recommended: top-level columns.

## Success Criteria
- Imported recipes show cuisine and meal type with fallbacks when AI is uncertain.
- Recipe details no longer shows source/generic tags, fake rating, top calories pill, bottom nav, or Add to Grocery List.
- Share opens the native share sheet with useful recipe content.
- Delete removes the recipe and leaves the details screen.
- Editing servings triggers one debounced AI recalculation after the user pauses and saves the returned ingredients/steps immediately.
- Nutrition section remains per serving after serving count changes.
- Ingredient checkboxes match the compact uploaded visual style and use checked as "already have."
- Allergy and halal conflicts render clearly from current user preferences.
- Profile exposes editable recipe preferences for diet, allergies, measurement system, and nutrition display.
- Existing tests pass: `npm test && npm run lint`.
