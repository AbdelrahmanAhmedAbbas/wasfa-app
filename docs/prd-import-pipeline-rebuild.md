# PRD: Recipe Import Pipeline Rebuild

## Overview
Rebuild the recipe import pipeline to be cheaper, more accurate, and produce significantly better cooking guides. Remove the failing OpenGraph and visual-OCR steps, wire correct per-platform Apify actors (Instagram metadata-only, TikTok with built-in transcript), introduce two-stage extraction (structured recipe → procedural step rewrite), automatically fill missing ingredient measurements via web search, deduplicate imports across users via a global extraction cache, and keep both English and Arabic versions natively rather than via translate-from-source. Total per-import cost stays at or below today's spend while shipping richer output.

## Goals
- Remove the OpenGraph, oEmbed, and visual-OCR pipeline steps that are misconfigured or never produced reliable output.
- Use the correct Apify actor per platform (`APIFY_ACTOR_INSTAGRAM`, `APIFY_ACTOR_TIKTOK`), configurable via env so actors can be swapped without redeploys.
- Skip OpenRouter audio transcription on TikTok by using the TikTok actor's built-in transcript field.
- Generate true cook-friendly procedural steps (with title, equipment, ingredients used, tips, optional temperature) instead of slicing the transcript.
- Fall back automatically to web search when ingredient measurements are missing, without asking the user to enter or correct anything.
- Dedup imports across users via a global `recipe_extraction_cache` so the same URL is never extracted twice.
- Use a tiered model strategy: premium model for the bottleneck step (Stage 1 extraction), affordable specialized models for everything else, with OpenRouter fallback chains for reliability.
- Save both English and Arabic versions of every recipe natively (each language rewritten end-to-end, not translated from a single source).
- Show an "estimated" badge in the recipe UI on ingredients whose measurements were autofilled.

## Non-Goals
- Do not migrate or backfill existing recipes; the user will wipe the imports table manually.
- Do not add user-facing review/correction UI for AI-flagged inconsistencies; sanity-check failures are silent telemetry only.
- Do not change the import job lifecycle states, share-extension entrypoint, or rate-limit policy.
- Do not add a content-hash or `(platform, post_id)` dedup; URL-only dedup is sufficient for v1.
- Do not change the recipe details screen UI beyond surfacing the new step fields and "estimated" ingredient badge.
- Do not add new sources beyond Instagram and TikTok.

## User Stories
- As a user importing a TikTok recipe, I want extraction to complete in seconds without paying for a separate transcription so the import feels instant.
- As a beginner cook, I want each step to read like clear instructions ("Heat 2 tbsp oil in a large pan over medium heat") instead of transcript chunks ("and we just heat some oil") so I can follow along easily.
- As a user following a step, I want to see which ingredients that step uses with their amounts so I do not have to scroll back to the ingredients list.
- As a user, I want missing ingredient measurements to be filled in automatically using web sources for the same dish so I never see a recipe with "flour - ?".
- As a user, I want to see a small "estimated" hint on autofilled measurements so I know when to sanity-check.
- As an Arabic-speaking user, I want recipes saved natively in Arabic with cooking-show fluency rather than mechanical translations from English.
- As a user importing a URL someone else already imported, I want it to load instantly because we have already extracted it.
- As an operator, I want the per-platform Apify actor IDs in env vars so I can swap actors without a code deploy when one breaks.

## Technical Design

### Modules Affected

- `supabase/functions/_shared/pipeline.ts`
  - Remove `fetchOEmbedMetadata`, `fetchOpenGraphMetadata`, `fetchSourceMetadata`, and the call to `extractVisualRecipeText`.
  - Remove the `MAX_VISUAL_OCR_UPLOAD_BYTES` constant and OCR-related logging stages (`openrouter_video_ocr*`, `cleanup_artifacts.video_ocr_cleared`).
  - Remove `apifySkippedReason` fallback chain that depends on OG/oEmbed; Apify is now the single metadata source.
  - Replace the single `APIFY_ACTOR_ID` constant with two env reads: `APIFY_ACTOR_INSTAGRAM` and `APIFY_ACTOR_TIKTOK`.
  - Add `fetchTikTokViaApify` that calls the TikTok actor with `{translate: "english", video_url: [sourceUrl]}` and returns metadata + a transcript string sourced from `transcript.text` (use the original-language transcript; ignore `translation`).
  - Refactor `fetchApifyMetadata` to dispatch on `params.job.source_platform` and call the correct actor.
  - Skip the OpenRouter transcription step entirely when the TikTok actor already returned a transcript.
  - Add a cache lookup at the top of `runImportPipeline` against `recipe_extraction_cache`; on hit, copy the cached extraction payload into a fresh recipe row for the user and short-circuit before any Apify or model calls.
  - On successful extraction (cache miss), upsert into `recipe_extraction_cache`.
  - Update `mapPipelineError` to drop OG/OCR-specific codes and add a TikTok-actor-specific failure code.
  - Update `confidence` payload sent to `upsertRecipeDraft` to drop OCR fields and include new step-rewrite + sanity-check telemetry.

- `supabase/functions/_shared/ai.ts`
  - Promote model choice to per-step constants:
    - `EXTRACTION_MODELS = ["anthropic/claude-sonnet-4.6", "anthropic/claude-haiku-4.5", "google/gemini-2.5-flash"]` (OpenRouter fallback chain via `models:` field).
    - `STEP_REWRITER_MODEL = "anthropic/claude-haiku-4.5"`.
    - `SANITY_CHECK_MODEL = "anthropic/claude-haiku-4.5"`.
    - `WEB_RESEARCH_MODEL = "google/gemini-2.5-flash"` (with OpenRouter `:online` web plugin).
    - Keep nutrition / localization / missing-details fill on `google/gemini-2.5-flash`.
  - Remove `extractVisualRecipeText` and `visualRecipeTextSchema`.
  - Remove `inferIngredientQuantitiesWithAi`; collapse it into a single `fillMissingMeasurements` call that uses web search and falls back gracefully to standard cooking proportions when no citation is found.
  - Update `recipeObjectSchema` to drop the `video_ocr` source enum value (`source` becomes `caption | transcript | web_research | user_edit`).
  - Update step schema to: `{order, title, text, duration_minutes?, temperature?: {value, unit: "C" | "F"}, equipment?: string[], ingredients_used?: string[], tips?: string[]}`.
  - Add `rewriteStepsForLanguage(draft, language: "en" | "ar")` that takes the Stage 1 extraction and returns rewritten procedural steps in the target language. Called twice in parallel, results stored in `localized.en.steps` and `localized.ar.steps` respectively. The top-level `steps` field stores whichever language matches the source language (used for cache parity).
  - Add `runSanityCheck(draft)` that returns `{passed: boolean, issues: string[]}`; never throws, never blocks the save.
  - Add ingredient-name normalization (`lowercase`, strip plural suffix, trim) used at link time so `ingredients_used` arrays resolve against `ingredients[].name` reliably.
  - Replace `researchMissingIngredientDetails` body with the new web-search prompt: search by recipe title, prefer cited matches, fall back to standard proportions, return per-ingredient `evidence_text` and `citation_url` when cited, leave them null when uncited.
  - All extraction calls use OpenRouter's `models: [...]` array form for automatic fallback on provider errors.

- `supabase/functions/_shared/types.ts`
  - Update `RecipeStep` type to match the new step schema (with `title`, `temperature`, `equipment`, `ingredients_used`, `tips` all optional except `title`).
  - Drop `"video_ocr"` from the ingredient `source` union; add `"web_research"` and `"ai_estimate"` as the two autofill sources.
  - Add `is_estimated: boolean` field on `IngredientItem` so the UI can render the "estimated" badge.

- `supabase/functions/_shared/validation.ts`
  - Update `validateRecipeDraft` to validate the new step shape and the new `is_estimated` ingredient field.

- `supabase/functions/_shared/db.ts`
  - Add `findCachedExtractionByUrl(adminClient, normalizedUrl)` returning the cached payload or `null`.
  - Add `upsertExtractionCache(adminClient, {normalizedUrl, payload, sourcePlatform, sourcePostId, modelInfo})`.
  - `confirmRecipeFromDraft` accepts the new step/ingredient shape; no API surface change but JSON column writes the richer schema.

- `supabase/functions/_shared/ingredient-details.ts`
  - Update `markIngredientReviewStates` to set `is_estimated: true` on ingredients whose measurements came from web research or AI fallback (not from caption/transcript).
  - Keep the strict trigger (any null quantity OR null unit → needs autofill).

- `app/recipe/[id].tsx`
  - Render the new step fields: title as section header, equipment + ingredients_used in a per-step header, tips in a collapsible "💡" block, structured temperature in the step text.
  - Render an "estimated" subtitle/badge on ingredient rows with `is_estimated: true`.

- `lib/recipes/client.ts`, `lib/import/types.ts`
  - Mirror type changes from `_shared/types.ts` so the client deserializes the new shape.

### New Modules Needed

- `supabase/migrations/2026XXXX_recipe_extraction_cache.sql`
  - `recipe_extraction_cache` table:
    - `normalized_source_url text primary key`
    - `source_platform text not null`
    - `source_post_id text`
    - `payload jsonb not null` (the full extraction draft including localized.en/ar)
    - `extraction_model text` (which model in the fallback chain actually produced the result)
    - `created_at timestamptz default now()`
    - `updated_at timestamptz default now()`
  - RLS: service-role-only (no client access).
  - No TTL in v1; cache entries are pristine and can be invalidated manually if a creator changes their post.

- `supabase/functions/_shared/cache.ts`
  - URL normalization helper (`normalizeSourceUrlForCache`) — lowercase host, strip query/utm params, strip trailing slash, normalize Instagram/TikTok URL variants (mobile vs desktop subdomains, share-link expansion).
  - Wraps `findCachedExtractionByUrl` and `upsertExtractionCache` with logging hooks.

- `supabase/functions/_shared/step-rewriter.ts`
  - Self-contained module owning the Stage 2 prompts, the per-language rewrite call, and the post-process normalization that links `ingredients_used` to `ingredients[].name`.

- `supabase/functions/_shared/sanity-check.ts`
  - Self-contained module that runs the Haiku-based sanity check and returns structured issues for telemetry only.

### Interface Changes

- Apify request bodies (internal):
  - Instagram: unchanged (`{resultsLimit, skipPinnedPosts, username: [sourceUrl]}`).
  - TikTok: new — `{translate: "english", video_url: [sourceUrl]}`.

- Recipe step JSON shape (database `steps_json` column and API response):
  - Before: `{order: number, text: string, duration_minutes?: number}`.
  - After: `{order, title, text, duration_minutes?, temperature?: {value, unit}, equipment?: string[], ingredients_used?: string[], tips?: string[]}`.

- Ingredient JSON shape:
  - Add `is_estimated: boolean`.
  - Source enum: `"caption" | "transcript" | "web_research" | "ai_estimate" | "user_edit"` (drop `video_ocr`).

- New env variables:
  - `APIFY_ACTOR_INSTAGRAM` (default fallback to current `nH2AHrwxeTRJoN5hX` if unset, with a warn log).
  - `APIFY_ACTOR_TIKTOK` (default fallback to `W2tevPiLZeuTLtcG7` if unset).

- New `job_events` log stages:
  - `cache_lookup` (hit/miss, normalized url).
  - `cache_write` (model used, payload bytes).
  - `tiktok_apify_transcript_used` (transcript chars, replaces `openrouter_transcribe` for TikTok jobs).
  - `step_rewrite` (language, model, step count).
  - `sanity_check` (passed: bool, issue_count, issues).
  - `web_measurement_fill` (ingredients filled, citations count).

- `confidence` payload on `recipe_drafts` row:
  - Drop: all `video_ocr_*` fields.
  - Add: `extraction_model_used`, `step_rewrite_models: {en, ar}`, `sanity_check: {passed, issue_count}`, `cache_hit: bool`, `cache_source_url`.

## Open Questions
- How are Apify actor pricing changes monitored? Do we want a per-job cost log so we can alert when a single import exceeds an expected ceiling?
- For TikTok URLs that the actor cannot access (private, deleted, geo-blocked), what error code should we surface to the user — same generic `MEDIA_NOT_AVAILABLE` or a new `TIKTOK_INACCESSIBLE`?
- Should the cache be invalidated automatically if a creator updates their original post? (Out of scope for v1; flagging for future.)

## Success Criteria
- Import of a TikTok cooking video (e.g. the Honey BBQ Mac n Cheese example) completes without an OpenRouter audio call and produces a recipe with: cuisine, meal type, servings, full bilingual ingredient list, procedural steps with titles + ingredients_used + at least one tip, and nutrition estimate.
- Import of an Instagram reel produces the same shape, using OpenRouter transcription for audio.
- A recipe with intentionally missing measurements (e.g., creator wrote "flour, sugar, eggs" with no amounts) is autofilled by the web-search fallback, with `is_estimated: true` on the filled rows and citations populated when found.
- Re-importing the same URL from a different user account returns instantly (cache hit, no Apify or model calls), and `job_events` shows `cache_lookup: hit`.
- Import cost per recipe (measured via OpenRouter dashboard + Apify dashboard) is at or below the pre-rebuild baseline.
- Step text in imported recipes scans as procedural cooking instructions (passes a manual review of 10 sample imports), not transcript chunks.
- Both `localized.en.steps` and `localized.ar.steps` are populated on every successful import.
- Sanity check telemetry is logged on every import; we can pull a weekly report of issue rate to monitor extraction quality.
- No code path references OpenGraph, oEmbed, or video OCR after the rebuild.
