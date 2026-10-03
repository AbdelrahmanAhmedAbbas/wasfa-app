---
status: proposed (becomes accepted once a spike confirms OpenRouter can pass a Short's link to Gemini)
---

# YouTube imports are Shorts only, and Gemini reads the Short from its link

YouTube is the third Source Platform, but only Shorts are imported: the pipeline's size caps and timeouts are built for clips of a few minutes, so regular videos are rejected rather than attempted. Unlike Instagram (download the media, transcribe the audio) and TikTok (use the scraper's transcript), a Short's content comes from Gemini reading the YouTube link directly through OpenRouter, because YouTube media cannot be downloaded the way Instagram's can and because many Shorts carry the recipe as on-screen text over music. An Apify actor supplies only the metadata (title, description, duration, thumbnail).

## Considered Options

- **YouTube captions, alone or before Gemini.** Rejected: by list prices checked on 2026-10-01, a caption-scraping actor costs about $0.005 per video, roughly the same as the estimated cost of Gemini reading a one-minute Short (this is the video-read step only, not the whole import), captions miss on-screen ingredient lists, and auto-captions for Arabic dialects are weak.
- **YouTube Data API for metadata.** Free and faster, but declined to avoid adding a Google account and secret; metadata stays on Apify like the other platforms.
- **Any YouTube video, or any video under a length cap.** Rejected: long-form needs a different transcript strategy and costs more per import.

## Consequences

- The Gemini call must be routed to the Google AI Studio provider; Vertex does not accept YouTube links. Google labels YouTube-link input a preview feature and it only works for public videos.
- If OpenRouter cannot pass a Short's link to Gemini, the agreed fallback is the Apify actor's subtitle and transcription options, which loses on-screen text.
- Because the content does not come from the scrape, a failed scrape does not fail a Shorts import: it continues without the description, and without the three-minute check, which also does not run when the actor returns no duration.
- When Gemini cannot read a Short, the import continues with the title and description and the result is cached, the same as Instagram. A review proposed skipping the shared-cache write in that case so a guessed recipe is not served to later users; this was considered and declined in favour of identical behaviour across platforms. A cache row for such a Short stays until it is removed by hand.
