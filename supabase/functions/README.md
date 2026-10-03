# Import Pipeline Functions

## Functions
- `import-create`
- `import-share`
- `import-status`
- `import-confirm`

## Required Secrets
Set these custom secrets in Supabase project secrets:
- `OPENROUTER_API_KEY`
- `APIFY_TOKEN` (required for Apify URL scraping fallback)
- `ARTIFACT_ENCRYPTION_SECRET` (recommended, min 16 chars)

Notes:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically by Supabase Edge Functions and should not be added manually in the Secrets UI.
- Model IDs are hardcoded in code; no model-name environment variables are required.
- Apify actors are set per platform with the optional secrets `APIFY_ACTOR_INSTAGRAM`, `APIFY_ACTOR_TIKTOK` and `APIFY_ACTOR_YOUTUBE`; each falls back to a default in code (`streamers~youtube-scraper` for YouTube).

## Deploy
```bash
supabase db push
supabase functions deploy import-create
supabase functions deploy import-share
supabase functions deploy import-status
supabase functions deploy import-confirm
```

Run `supabase db push` before deploying the functions: they read columns the latest migration adds.

## YouTube Shorts
- Only Shorts are imported. A YouTube link must be `/shorts/<id>` on `youtube.com`, `www.youtube.com` or `m.youtube.com`; anything else is rejected with the code `YOUTUBE_NOT_A_SHORT`. A Short longer than 3 minutes fails with `SHORT_TOO_LONG`.
- The Apify actor supplies the title, description, duration and thumbnail. Gemini then reads the speech and on-screen text from the Short's link through OpenRouter, pinned to the Google AI Studio provider. Nothing is downloaded.
- `node scripts/spike-youtube-short.mjs <short-url>` sends the same two requests from your machine (needs `OPENROUTER_API_KEY`, and `APIFY_TOKEN` to check the actor). Run it before the first deploy and whenever the actor or model changes.
- See `docs/adr/0001-youtube-shorts-read-by-gemini.md` for why.

## Time budget
- A job is marked failed with `IMPORT_TIMED_OUT` after 135 seconds, ahead of the 150-second background-task limit on the Supabase free plan, so a slow import ends with an error instead of staying in `processing`.

## Notes
- The migration creates RLS-protected tables for jobs, drafts, recipes, and events.
- AI orchestration uses Vercel AI SDK (`ai`) with OpenRouter for transcription, Gemini parsing/localization/nutrition, video OCR, and cited web-search fallback for missing ingredient measurements.
- Pipeline is URL-share first and attempts metadata/OpenGraph resolution, then Apify actor fallback, then transcription and schema-constrained parsing.
- Video OCR runs only for downloaded video media under 20 MB and stores concise OCR text as an encrypted `ocr_text` raw artifact.
- Ingredient drafts with name-only items are left in `awaiting_user_review` instead of being auto-confirmed.
- Temporary media/audio/transcript artifacts are handled in-memory and cleared immediately after extraction attempt.
- Draft payload always stores localized recipe text for both `en` and `ar` (falls back to source text if translation fails).
- Android text sharing is bridged into `mealplanner://import?...` in native `MainActivity`.
- iOS currently supports deep-link import route handling; full Share Extension target still needs to be added in Xcode if you want direct "Share to app" from iOS share sheet.
