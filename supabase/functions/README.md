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
- Apify actor ID is hardcoded in pipeline as `nH2AHrwxeTRJoN5hX`.

## Deploy
```bash
supabase db push
supabase functions deploy import-create
supabase functions deploy import-share
supabase functions deploy import-status
supabase functions deploy import-confirm
```

## Notes
- The migration creates RLS-protected tables for jobs, drafts, recipes, and events.
- AI orchestration uses Vercel AI SDK (`ai`) with OpenRouter for both transcription (OpenAI model via OpenRouter) and Gemini parsing/localization/nutrition.
- Pipeline is URL-share first and attempts metadata/OpenGraph resolution, then Apify actor fallback, then transcription and schema-constrained parsing.
- Temporary media/audio/transcript artifacts are handled in-memory and cleared immediately after extraction attempt.
- Draft payload always stores localized recipe text for both `en` and `ar` (falls back to source text if translation fails).
- Android text sharing is bridged into `mealplanner://import?...` in native `MainActivity`.
- iOS currently supports deep-link import route handling; full Share Extension target still needs to be added in Xcode if you want direct "Share to app" from iOS share sheet.
