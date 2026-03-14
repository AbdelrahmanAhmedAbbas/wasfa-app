# Quickstart: Onboarding Flow Redesign

**Feature**: 002-onboarding-redesign
**Date**: 2026-03-14

## Prerequisites

- Node.js installed, `npm install` completed
- Supabase CLI installed (`supabase` command available)
- Local Supabase instance running or remote project configured
- Expo Go or development build available on device/simulator
- Environment variables set in `.env` (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY)

## Getting Started

### 1. Apply Database Migration

```bash
# Generate and apply the new migration for onboarding profiles
supabase migration new onboarding_profiles
# Edit the generated file with the schema from data-model.md
supabase db push
```

### 2. Add Mascot Assets

Add the following mascot images to `assets/images/`:
- `mascot-garlic.png` (reuse existing `mascot.png` or source new garlic character)
- `mascot-avocado.png` (for allergies screen)
- `mascot-lemon.png` (for source screen)
- `mascot-apple.png` (for age range screen)
- `mascot-cherry.png` (for preferences screen)
- `mascot-potato.png` (for setup screen)

Add diet option images to `assets/images/diets/`:
- `halal.png`, `omnivore.png`, `vegetarian.png`, `vegan.png`, `keto.png`, `pescatarian.png`

### 3. Run the App

```bash
npx expo start
```

### 4. Test the Flow

1. Open app → Auth welcome screen
2. Tap "Get Started" → Registration screen with Google + Apple buttons
3. Complete Google sign-in → Step 1 (animated welcome)
4. Navigate through all 8 steps
5. Verify data appears in `user_onboarding_profiles` table in Supabase

## Key Files to Modify

| File | Change |
|------|--------|
| `app/(auth)/welcome.tsx` | Add Apple button, restyle Google button |
| `app/(onboarding)/_layout.tsx` | Replace 10-screen routes with 8 new ones |
| `app/(onboarding)/*.tsx` | Replace all screen files with new implementations |
| `lib/auth/AuthProvider.tsx` | Update routing after registration to go to onboarding |
| `lib/onboarding/answers.ts` | Update `OnboardingAnswers` type with new fields |
| `lib/onboarding/sync.ts` | New file — sync local answers to Supabase |
| `lib/theme/onboarding.ts` | Update colors to orange accent palette |
| `lib/i18n/translations.ts` | Add translation keys for all new screens |
| `components/onboarding/OnboardingScaffold.tsx` | Minor adjustments for new screen layouts |
| `supabase/migrations/` | New migration for `user_onboarding_profiles` table |

## Architecture Decisions

- **Local-first storage**: Answers saved to AsyncStorage per step, synced to Supabase only at step 8
- **Scaffold reuse**: Existing `OnboardingScaffold` component adapted for new screens
- **Animation**: `react-native-reanimated` for step 1 title transitions
- **Apple button**: Styled button placeholder (no actual auth flow yet)
