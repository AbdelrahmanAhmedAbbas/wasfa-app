# Onboarding API Contracts

**Phase**: 1 — Design & Contracts  
**Branch**: `002-onboarding-redesign`  
**Date**: 2026-03-14

---

## Interface Overview

This feature exposes two internal interface contracts:

1. **Supabase Database Contract** — the `onboarding_profiles` table schema and RLS policies
2. **TypeScript Module Contracts** — the public API surface of `lib/onboarding/answers.ts` and `lib/onboarding/supabase.ts`

---

## Contract 1: Supabase Table — `onboarding_profiles`

### Schema

```sql
TABLE public.onboarding_profiles (
  user_id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  diet               text[]      NOT NULL DEFAULT '{}',
  allergies          text[]      NOT NULL DEFAULT '{}',
  referral_source    text        NULL,
  invite_code        text        NULL,
  age_range          text        NULL,
  measurement_system text        NULL,
  nutrition_display  text        NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
)
```

### Row-Level Security

| Policy Name | Operation | Predicate |
|-------------|-----------|-----------|
| `users_select_own_profile` | SELECT | `auth.uid() = user_id` |
| `users_insert_own_profile` | INSERT | `auth.uid() = user_id` |
| `users_update_own_profile` | UPDATE | `auth.uid() = user_id` |

### Invariants

- One row per user. Callers must use `upsert` (not `insert`) to handle re-onboarding.
- `diet` array length SHOULD NOT exceed 2 (enforced at application layer).
- `referral_source` and `invite_code` MUST be consistent: `invite_code` is non-null only when `referral_source = 'invite_code'`.

---

## Contract 2: `lib/onboarding/answers.ts`

### Exported Types

```ts
export type DietOption = "halal" | "omnivore" | "vegetarian" | "vegan" | "keto" | "pescatarian";
export type AllergyOption = "shellfish" | "seafood" | "dairy" | "peanut" | "tree_nut" | "egg" | "gluten" | "wheat";
export type ReferralSource = "invite_code" | "instagram" | "facebook" | "app_store" | "tiktok" | "friend";
export type AgeRange = "<18" | "18-25" | "25-30" | "30-35" | "35-40" | "40+";
export type MeasurementSystem = "imperial" | "metric";
export type NutritionDisplay = "show" | "hide";

export type OnboardingAnswers = {
  diet: DietOption[];
  allergies: AllergyOption[];
  referralSource: ReferralSource | null;
  inviteCode: string | null;
  ageRange: AgeRange | null;
  measurementSystem: MeasurementSystem | null;
  nutritionDisplay: NutritionDisplay | null;
};

export const EMPTY_ONBOARDING_ANSWERS: OnboardingAnswers;
```

### Exported Functions

```ts
// Returns current locally-saved answers, or EMPTY_ONBOARDING_ANSWERS if none
export async function getOnboardingAnswers(): Promise<OnboardingAnswers>;

// Merges `partial` into existing locally-saved answers and persists
export async function saveOnboardingAnswers(partial: Partial<OnboardingAnswers>): Promise<void>;

// Clears all local onboarding answers (called after successful sync to Supabase)
export async function clearOnboardingAnswers(): Promise<void>;
```

---

## Contract 3: `lib/onboarding/supabase.ts`

### Exported Functions

```ts
// Upserts onboarding profile to Supabase for the given userId.
// Throws on network failure so the caller (step 8 screen) can handle retry.
export async function saveOnboardingProfile(
  userId: string,
  answers: OnboardingAnswers
): Promise<void>;

// Reads the onboarding profile for the given userId from Supabase.
// Returns null if no profile exists yet.
export async function getOnboardingProfile(
  userId: string
): Promise<OnboardingAnswers | null>;
```

### Error Handling

- On Supabase error, both functions re-throw the original `PostgrestError`.
- Callers (step 8 screen) are responsible for displaying retry UI.
- No silent failures — errors must surface to the user.

---

## Contract 4: `lib/auth/AuthProvider.tsx` — New Exports

```ts
// Existing context value type — updated to add signInWithApple
export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  hasCompletedOnboarding: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;   // NEW — no-op placeholder
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};
```

### Routing Behaviour (AuthProvider contract)

| State | Route |
|-------|-------|
| `loading === true` | Render nothing (splash screen visible) |
| `user === null` | `(auth)/welcome` |
| `user !== null && hasCompletedOnboarding === false` | `(onboarding)/welcome` (step 1) |
| `user !== null && hasCompletedOnboarding === true` | `(tabs)` |

> **Note**: "Get Started" on `(auth)/welcome` navigates to `(auth)/register`. After successful sign-in on `(auth)/register`, `AuthProvider` state updates and the router picks up the `user !== null && hasCompletedOnboarding === false` case automatically.
