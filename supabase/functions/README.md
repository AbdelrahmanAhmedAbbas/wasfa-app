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
- Apify actors are set with the optional secrets `APIFY_ACTOR_INSTAGRAM`, `APIFY_ACTOR_TIKTOK`, `APIFY_ACTOR_YOUTUBE` and `APIFY_ACTOR_YOUTUBE_AUDIO`; each falls back to a default in code (`clockworks~tiktok-scraper` for TikTok, `streamers~youtube-scraper` and `marielise.dev~youtube-video-downloader` for YouTube). A secret that names a different actor must accept the same input and return the same fields.

## One path for every platform
Instagram, TikTok and YouTube Shorts all follow the same steps: an Apify actor returns the post's text and a downloadable media file, the file is downloaded, its audio is transcribed through OpenRouter, and the transcript plus the caption or description go to the recipe extraction. When the media cannot be fetched or transcribed, the import continues with the text it has.
- TikTok: the actor is run with `shouldDownloadVideos: true` so the video is copied into Apify storage; TikTok's own video links cannot be downloaded from a server.

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
- One Apify actor supplies the title, description, duration and thumbnail; a second one downloads the Short's audio as MP3. They run at the same time. The audio actor bills per minute of audio, and each run is capped at $0.05 with `maxTotalChargeUsd`.
- When the audio actor fails, the reason is recorded as `media_error` on the job's `metadata_fetch` event.
- `node scripts/spike-youtube-short.mjs <short-url>` sends the same two Apify requests from your machine (needs `APIFY_TOKEN`). Run it whenever an actor changes.
- `docs/adr/0001-youtube-shorts-read-by-gemini.md` records the earlier design, in which Gemini read the Short from its link, and why it was replaced.

## Time budget
- A job is marked failed with `IMPORT_TIMED_OUT` after 135 seconds, ahead of the 150-second background-task limit on the Supabase free plan, so a slow import ends with an error instead of staying in `processing`.

## Notes
- The migration creates RLS-protected tables for jobs, drafts, recipes, and events.
- AI orchestration uses Vercel AI SDK (`ai`) with OpenRouter for transcription, Gemini parsing/localization/nutrition, and cited web-search fallback for missing ingredient measurements.
- Ingredient drafts with name-only items are left in `awaiting_user_review` instead of being auto-confirmed.
- Temporary media/audio/transcript artifacts are handled in-memory and cleared immediately after extraction attempt.
- Draft payload always stores localized recipe text for both `en` and `ar` (falls back to source text if translation fails).
- Android text sharing is bridged into `mealplanner://import?...` in native `MainActivity`.
- iOS currently supports deep-link import route handling; full Share Extension target still needs to be added in Xcode if you want direct "Share to app" from iOS share sheet.
