# Research: Onboarding Flow Redesign

**Feature**: 002-onboarding-redesign
**Date**: 2026-03-14

## R1: Onboarding Data Persistence to Supabase

**Decision**: Create a new `user_onboarding_profiles` table in Supabase to store onboarding answers, replacing the AsyncStorage-only approach.

**Rationale**: The spec requires saving onboarding data to Supabase linked to user ID. Currently all answers are stored locally via AsyncStorage (`@meal_planner_onboarding_answers`). A new Supabase migration is needed to create the table with RLS policies matching existing patterns (users can only access their own rows).

**Alternatives considered**:
- Store in `auth.users` metadata via `supabase.auth.updateUser({ data: {...} })` — rejected because user_metadata has size limits and is not structured for querying.
- Keep in AsyncStorage only — rejected because spec explicitly requires Supabase persistence.

## R2: Apple Sign-In Implementation

**Decision**: Add `expo-apple-authentication` package for the Apple button UI, but make it non-functional (placeholder) as specified.

**Rationale**: No Apple auth packages are currently installed. The spec says Apple sign-in should be present but non-functional. Using `expo-apple-authentication` provides the native Apple button styling. However, since the user wants a standard styled button (not the native Apple button), we only need the package for future auth flow — for now, a custom styled button with Apple logo is sufficient.

**Alternatives considered**:
- `@invertase/react-native-apple-authentication` — heavier, unnecessary for a placeholder button.
- Native Apple button via `expo-apple-authentication` `AppleAuthenticationButton` — rejected because user wants standard button style matching Google.

## R3: Color Scheme — Orange Accent

**Decision**: Update the onboarding color scheme to use orange (#F5A623) as the primary accent for selected states and Continue buttons, with dark navy (#1A1A4E) for titles, matching the reference images.

**Rationale**: The reference images consistently use orange as the accent color (Continue button, selected card borders, checkmarks) and dark navy for titles. This differs from the current green (#5A8A5A) palette. The user explicitly said "same style of the app and colors of the brand" while providing orange-themed references, indicating the brand palette should be updated for onboarding.

**Alternatives considered**:
- Keep green palette — rejected because reference images clearly use orange.

## R4: Google Button Restyling

**Decision**: Replace the current Google OAuth badge-style button with a standard button containing the Google colored "G" logo on both login and registration screens.

**Rationale**: Current implementation uses a badge-style Google button with icon. User explicitly requested "normal button with google colored logo." This means a white/light button with the multi-colored Google "G" icon and standard text.

## R5: Animation Approach for Step 1

**Decision**: Use `react-native-reanimated` (already installed v4.1.1) for the title entrance/exit animations on the welcome screen.

**Rationale**: Reanimated is already a project dependency and supports layout animations, fade in/out, and sequential timing — exactly what's needed for the "Hi! → Welcome to Wasfa → Let's get cooking" → transition → "We got you!" flow.

**Alternatives considered**:
- Built-in `Animated` API — less capable for sequenced layout animations.
- `react-native-animatable` — unnecessary additional dependency.

## R6: Mascot Images for New Screens

**Decision**: New mascot image assets (avocado, lemon, apple, cherry, potato characters) will need to be added to `assets/images/`. Existing mascot images (`mascot.png`, `mascot-reading.png`, `mascot-typing.png`) can be reused where appropriate.

**Rationale**: The reference images show different cute food character mascots for each screen. The existing garlic mascot is already available. Additional characters need to be sourced/designed and added as PNG assets.

## R7: Onboarding Flow Replacement Strategy

**Decision**: Replace all 10 existing screens in `app/(onboarding)/` with 8 new screens. Update the `_layout.tsx` to reflect the new route order. Keep `OnboardingScaffold` as the base component, adapting it for new layouts.

**Rationale**: The spec requires a complete replacement. The existing scaffold component handles progress, back navigation, Continue button, RTL support — all of which are needed. Some screens (like step 1 with animations) may use a lighter variant of the scaffold.

## R8: New OnboardingAnswers Type

**Decision**: Extend the `OnboardingAnswers` type to include new fields: `diet` (string[], max 2), `allergies` (string[]), `ageRange` (string), `measurementSystem` ("imperial" | "metric"), `nutritionDisplay` ("show" | "hide"), `inviteCode` (string optional). Keep existing `source` field.

**Rationale**: The new flow collects different data than the old flow. The type must expand to accommodate diet (replacing religion), allergies (new), age range (new), and app preferences (new).
