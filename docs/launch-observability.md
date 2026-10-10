# Wasfa launch setup

The app has PostHog events for a launch funnel, Sentry crash capture, a Resend welcome email, and an in-app feedback board. Sentry's DSN is configured for EAS preview and production builds; source map uploads still need an auth token.

## PostHog: analytics

PostHog was already installed. Set `EXPO_PUBLIC_POSTHOG_KEY` and, if needed, `EXPO_PUBLIC_POSTHOG_HOST` in the EAS preview and production environments. Keep local testing in a separate PostHog project or omit the key locally.

Build a funnel in PostHog using:

1. `sign_in_started` to `signed_in` (filter `new_account = true` for new users)
2. `onboarding_completed`
3. `import_started` to `import_completed`
4. `recipe_planned`

Also watch `sign_in_failed`, `import_rejected`, `import_failed`, and `feedback_submitted` by day. Screen events use route templates, without recipe IDs or imported URLs.

Before launch, use a preview build and a test account to check each event and its properties in PostHog's live event feed. Confirm a failed import appears with an error code and a completed import leads to `recipe_planned` when the recipe is added to a meal plan.

## Sentry: crashes

1. The Sentry project is `itqan-tech/react-native`. The Expo Sentry plugin has these slugs in `app.json`, and `EXPO_PUBLIC_SENTRY_DSN` is set in the EAS preview and production environments.
2. Create a Sentry organization auth token with Source Map Upload and Release Creation permissions, then store it as the **sensitive** `SENTRY_AUTH_TOKEN` in EAS preview and production. Never put it in `EXPO_PUBLIC_` or commit it. Sensitive visibility also lets local `eas env:exec` use the token to upload source maps for EAS updates.
3. Make a new native build because the Sentry SDK has native code. Verify a test exception from a preview build appears in Sentry with a readable stack trace and release.

The SDK is disabled in development and associates errors with the account ID only. It does not send name or email as Sentry user fields.

## Resend: welcome email

1. `wasfa.life` is verified in the Resend account `eng.abdelrahman.ahmed11@gmail.com`. The website uses the sending key named **Wasfa** and the sender `Wasfa Support <support@wasfa.life>`.
2. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in the **Convex environment** for each deployment serving the app. The key is server-only; never use an `EXPO_PUBLIC_` variable for it. The website's local `.env` has the current key; do not copy it into this repository or its `.env.example`.
3. Create a fresh test account, finish onboarding, and confirm one welcome email appears in Resend. Saving the profile again must not send another email. Inspect the email in English and Arabic, including the plain-text version.

The app schedules a single welcome email after the first onboarding profile save. It uses Resend's email API, not a Resend contact list, and does not create a contact when sending. Resend's idempotency key protects against duplicate requests in its retention window. A later multi-email sequence would require a separate subscription and unsubscribe design.

## Feedback board

Signed-in users open **Profile → Share feedback** to post a bug or feature idea and vote on posts. Posts are visible to other signed-in users without author identity. The newest 100 posts are shown. The screen asks users to leave out personal information.
Each account can create up to three posts in 24 hours.

To update a post's status, use the Convex dashboard or run the internal `feedback:setStatus` mutation with `postId` and `status` (`open`, `planned`, or `done`). Account deletion removes the author's posts and their votes.

## First three weeks after launch

Check PostHog, Sentry, the feedback board, and Resend each day. Prioritize crashes and blocked sign-in or import flows first; then look at onboarding drop-off, repeated feature requests, and welcome-email delivery. Keep a weekly note with counts, affected flows, links to evidence, and the next fix. Once the launch date and service accounts exist, a Codex heartbeat can run this watch on a schedule with the appropriate connectors.
