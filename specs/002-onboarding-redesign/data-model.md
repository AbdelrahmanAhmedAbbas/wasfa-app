# Data Model: Onboarding Flow Redesign

**Feature**: 002-onboarding-redesign
**Date**: 2026-03-14

## Entities

### OnboardingProfile

Stores a user's onboarding preferences, linked to their authenticated account.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | Primary key, auto-generated | Unique profile ID |
| user_id | UUID | Foreign key → auth.users(id), unique, not null | Links to authenticated user |
| diet_preferences | text[] | Max 2 items | Selected diet types (e.g., ["halal", "keto"]) |
| allergies | text[] | Optional, no max | Selected allergens (e.g., ["dairy", "peanut"]) |
| referral_source | text | Optional | How user heard about app (e.g., "instagram", "invite_code") |
| invite_code | text | Optional | Invite code if provided |
| age_range | text | Optional | Selected age range (e.g., "25-30") |
| measurement_system | text | "imperial" or "metric" | Preferred measurement system |
| nutrition_display | text | "show" or "hide" | Whether to display nutrition info |
| created_at | timestamptz | Default now() | When profile was created |
| updated_at | timestamptz | Default now() | Last update timestamp |

**Validation Rules**:
- `diet_preferences` array length must be <= 2
- `measurement_system` must be one of: "imperial", "metric"
- `nutrition_display` must be one of: "show", "hide"
- `referral_source` must be one of: "invite_code", "instagram", "facebook", "app_store", "tiktok", "friend"
- `age_range` must be one of: "under_18", "18-25", "25-30", "30-35", "35-40", "40+"
- One row per user (upsert pattern)

**Access Policy**: Row-level security — users can only read/write their own row (matching `auth.uid() = user_id`).

### OnboardingAnswers (Local)

Local AsyncStorage representation used during the flow before final sync to database.

| Field | Type | Description |
|-------|------|-------------|
| diet | string[] | Selected diet preferences (max 2) |
| allergies | string[] | Selected allergens |
| source | string | Referral source |
| inviteCode | string? | Optional invite code |
| ageRange | string | Selected age range |
| measurementSystem | "imperial" \| "metric" | Measurement preference |
| nutritionDisplay | "show" \| "hide" | Nutrition display preference |

**Storage Key**: `@meal_planner_onboarding_answers` (same key as existing, new shape)

## Relationships

```
auth.users (1) ←→ (0..1) user_onboarding_profiles
```

- A user has at most one onboarding profile
- Profile is created during step 8 ("Setting things up...")
- If user re-does onboarding, the existing row is upserted (updated)

## State Transitions

### Onboarding Flow State

```
[Not Started] → [In Progress (Step 1-7)] → [Syncing (Step 8)] → [Completed]
```

- **Not Started**: User just registered, no onboarding answers exist
- **In Progress**: User is navigating steps 1-7, answers saved locally per step
- **Syncing**: Step 8 — local answers are being saved to database
- **Completed**: AsyncStorage flag set, user redirected to main app

### Step 8 Sync Checklist States

```
Saving dietary preferences:    [pending] → [complete]
Saving app preferences:        [pending] → [complete]
Getting recommendations:       [pending] → [complete]
```

Each step transitions sequentially with visual feedback.

## Migration Required

A new Supabase migration file to create the `user_onboarding_profiles` table with:
- Table creation with all fields
- RLS policies (select, insert, update for own rows)
- Index on `user_id` (unique)
- Trigger for `updated_at` auto-update
