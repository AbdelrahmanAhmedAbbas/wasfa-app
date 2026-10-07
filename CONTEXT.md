# Wasfa

Wasfa turns a cooking video saved on social media into a structured, bilingual recipe that can be planned and shopped for.

## Language

### Importing

**Source Platform**:
The social network a recipe was imported from: Instagram, TikTok or YouTube.
_Avoid_: Source, provider, network

**Short**:
A YouTube video published in YouTube's short-form format, at most three minutes long. It is the only kind of YouTube video Wasfa imports.
_Avoid_: YouTube video, clip, YouTube reel

### Onboarding and sign-in

**Onboarding**:
The run of screens a new person walks through before using the app: language, intro, chat questions, kitchen card, demo, sign-up, offer, setup.
_Avoid_: Questionnaire (that is only the chat questions), signup flow

**Sign-up screen**:
The onboarding step with the reviews and the sign-in buttons, shown after the demo. It is only ever reached by walking on from the demo, never opened on its own.
_Avoid_: Reviews screen, login screen, auth screen

**Login screen**:
The standalone sign-in screen for a **Returning account**. It is where a signed-out device opens once setup has been finished on it, and where "I already have an account" leads.
_Avoid_: Sign-in screen, sign-up screen

**New account**:
A signed-in account with no saved profile. It goes through the whole **Onboarding**, wherever it signed in; only the **Sign-up screen** is skipped when it is already signed in.
_Avoid_: New user, first-time user

**Returning account**:
A signed-in account that already has a saved profile. It goes straight into the app and keeps that profile, wherever it signed in.
_Avoid_: Existing user, old user
