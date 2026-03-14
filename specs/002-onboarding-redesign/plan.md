# Implementation Plan: Onboarding Flow Redesign

**Branch**: `002-onboarding-redesign` | **Date**: 2026-03-14 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/002-onboarding-redesign/spec.md`

## Summary

Replace the existing 10-screen onboarding flow with a new 8-screen flow that gates onboarding behind authentication (Google OAuth + Apple Sign-In placeholder), collects diet preferences, allergies, referral source, age range, and app preferences, then persists all data to Supabase. The flow is skippable at every preference step (3–7), supports RTL/Arabic, and resumes mid-flow via AsyncStorage. A new registration screen is introduced before the onboarding flow.

## Technical Context

**Language/Version**: TypeScript 5.9 / React Native 0.81.5  
**Primary Dependencies**: Expo ~54, expo-router ~6, react-native-reanimated ~4.1.1, @supabase/supabase-js ^2.95.3, expo-auth-session ^7, expo-web-browser ~15, @react-native-async-storage/async-storage ^2.2.0, @expo/vector-icons ^15  
**Storage**: Supabase (PostgreSQL via supabase-js) for persisted onboarding profiles; AsyncStorage for mid-flow local state  
**Testing**: React test renderer (existing); no E2E test runner configured  
**Target Platform**: iOS 15+ and Android (React Native / Expo managed workflow)  
**Project Type**: Mobile app (Expo + expo-router file-based routing)  
**Performance Goals**: Step transitions at 60 fps; animated title sequence completes in ~4–5 s; final data save within 5 s of reaching step 8  
**Constraints**: Offline-resilient local save; no new native modules (stay in Expo managed workflow); Apple Sign-In is visual-only (no entitlement/config required for now)  
**Scale/Scope**: 8 onboarding screens replacing 10 existing screens; 1 new registration screen; 1 new Supabase table migration; ~10 new/modified source files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> The constitution file is currently a placeholder template (not yet filled in for this project). Gates cannot be evaluated against specific principles. Proceeding with universal best-practice gates:

| Gate | Status | Notes |
|------|--------|-------|
| No new native modules | ✅ PASS | All packages already in managed Expo workflow |
| Data persisted to authenticated user | ✅ PASS | Supabase row linked to `auth.uid()` |
| Local save before remote save | ✅ PASS | AsyncStorage used throughout; Supabase call only on step 8 |
| All text localizable (EN + AR) | ✅ PASS | Existing `LocalizedText` + `useLanguage` infra used |
| Skippable steps store null/empty | ✅ PASS | Unselected fields written as empty arrays / null |
| Apple Sign-In non-functional (placeholder) | ✅ PASS | Button rendered, onPress is no-op |
| No breaking change to tab navigation | ✅ PASS | `(tabs)` group untouched |

**Post-Design Re-check**: Will re-evaluate after Phase 1 data-model + contracts are finalized.

## Project Structure

### Documentation (this feature)

```text
specs/002-onboarding-redesign/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   └── onboarding-api.md
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
app/
├── (auth)/
│   ├── _layout.tsx              [EXISTING – no change]
│   └── welcome.tsx              [MODIFY – add Apple Sign-In button; split "Get Started" into registration route]
├── (onboarding)/
│   ├── _layout.tsx              [EXISTING – minor: update total step count from 10 → 8]
│   ├── register.tsx             [NEW – registration screen with Google + Apple buttons]
│   ├── welcome.tsx              [REPLACE – step 1: animated titles + folder grid]
│   ├── savings.tsx              [NEW – step 2: chart image + value prop text]
│   ├── diet.tsx                 [NEW – step 3: 2-col image grid, multi-select max 2]
│   ├── allergies.tsx            [NEW – step 4: allergen list, multi-select]
│   ├── source.tsx               [REPLACE – step 5: referral source + invite code card]
│   ├── age.tsx                  [NEW – step 6: age range single-select cards]
│   ├── preferences.tsx          [NEW – step 7: measurement + nutrition preference sections]
│   └── setup.tsx                [NEW – step 8: animated checklist + Supabase persist]
│   [REMOVE: family.tsx, frequency.tsx, getstarted.tsx, goals.tsx, location.tsx, proof.tsx, results.tsx, value.tsx]
│
components/
└── onboarding/
    ├── OnboardingScaffold.tsx   [EXISTING – extend: add support for full-bleed image header variant]
    ├── SelectionCard.tsx        [NEW – reusable single/multi-select card with orange border + checkmark]
    ├── ImageOptionGrid.tsx      [NEW – 2-column grid of image+label options (diet screen)]
    └── SetupChecklist.tsx       [NEW – animated progressive checklist for step 8]
│
lib/
├── onboarding/
│   ├── answers.ts               [REPLACE – new OnboardingAnswers type matching spec entities]
│   ├── storage.ts               [EXISTING – no change]
│   └── supabase.ts              [NEW – saveOnboardingProfile(userId, answers) function]
├── auth/
│   ├── AuthProvider.tsx         [MODIFY – add signInWithApple (no-op stub); route new users to register screen]
│   └── types.ts                 [MODIFY – add signInWithApple to AuthContextValue]
└── theme/
    └── onboarding.ts            [MODIFY – add orange accent tokens matching spec (selected border, checkmark)]
│
assets/
└── images/
    ├── onboarding-chart.png     [EXISTING ✅]
    ├── onboarding-1.png         [EXISTING – reuse for step 1 top image]
    ├── onbarding-cards.png      [EXISTING – repurpose for folder grid on step 1]
    ├── diet-halal.png           [NEW – to be added: diet option image]
    ├── diet-omnivore.png        [NEW – to be added]
    ├── diet-vegetarian.png      [NEW – to be added]
    ├── diet-vegan.png           [NEW – to be added]
    ├── diet-keto.png            [NEW – to be added]
    └── diet-pescatarian.png     [NEW – to be added]
│
supabase/
└── migrations/
    └── 20260314120000_onboarding_profile.sql  [NEW – onboarding_profiles table]
```

**Structure Decision**: Single mobile app project (Option 3 variant). All changes are within the existing Expo managed monorepo. No new top-level package. The feature replaces the `(onboarding)` route group screens in place and adds one route (`register.tsx`) to `(auth)`.

## Complexity Tracking

> No Constitution violations to justify (constitution is a placeholder template; no active principle gates were violated).

---

*Plan generated by `/speckit.plan` on branch `002-onboarding-redesign`.*
