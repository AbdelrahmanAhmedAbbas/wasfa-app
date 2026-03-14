# Tasks: Onboarding Flow Redesign

**Input**: Design documents from `/specs/002-onboarding-redesign/`  
**Branch**: `002-onboarding-redesign`  
**Date**: 2026-03-14  
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

**Organization**: Grouped by user story to enable independent implementation and testing.  
**Tests**: Not requested in spec — no test tasks generated.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US9)
- Exact file paths included in every task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the new type definitions, theme tokens, database migration, and Supabase function that every screen depends on.

- [x] T001 Replace `OnboardingAnswers` type in `lib/onboarding/answers.ts` — new fields: `diet: DietOption[]`, `allergies: AllergyOption[]`, `referralSource`, `inviteCode`, `ageRange`, `measurementSystem`, `nutritionDisplay`; add `EMPTY_ONBOARDING_ANSWERS` constant; add `clearOnboardingAnswers()` export
- [x] T002 [P] Add `@meal_planner_onboarding_step` step-index key helpers to `lib/onboarding/storage.ts` — exports `getOnboardingStep(): Promise<number>` and `setOnboardingStep(n: number): Promise<void>`
- [x] T003 [P] Create `lib/onboarding/supabase.ts` — export `saveOnboardingProfile(userId, answers)` (upsert to `onboarding_profiles`) and `getOnboardingProfile(userId)` per contracts/onboarding-api.md
- [x] T004 [P] Keep green accent tokens in `lib/theme/onboarding.ts` — retain `#5A8A5A` (green) for `primary`, `primaryAccent`, `accentBorder`; add `teal: "#2BA88A"` for checklist done state; add `dietImages` placeholder mapping
- [x] T005 [P] Create Supabase migration file `supabase/migrations/20260314120000_onboarding_profile.sql` — `onboarding_profiles` table with RLS policies (select/insert/update own row) and `updated_at` trigger per data-model.md

**Checkpoint**: Type system + theme + DB migration ready. No screens yet — purely additive.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared component infrastructure and auth wiring that every onboarding screen needs. MUST complete before any screen work.

- [x] T006 Add `signInWithApple` no-op stub to `lib/auth/AuthProvider.tsx` and `lib/auth/types.ts` — function signature `() => Promise<void>`, body logs "Apple Sign-In not yet configured", no native package needed
- [x] T007 [P] Extend `components/onboarding/OnboardingScaffold.tsx` — add optional `heroImage?: ImageSourcePropType` prop that renders a full-bleed image above the progress bar (no border/container, `resizeMode="cover"`); existing `title`/`subtitle` props unchanged, image variant replaces the top padding
- [x] T008 [P] Create `components/onboarding/SelectionCard.tsx` — reusable card component accepting `label`, `selected: boolean`, `onPress`, optional `icon`/`emoji`; selected state = brand-green border (`onboardingColors.primary` = `#5A8A5A`, 2px) + green checkmark badge (top-right); supports single-select and multi-select usage patterns
- [x] T009 [P] Create `components/onboarding/ImageOptionGrid.tsx` — 2-column grid of tappable image+label tiles; props: `options: {id, label, image}[]`, `selected: string[]`, `onToggle(id)`, `maxSelect?: number`; enforces max selection with visual feedback (greyed-out unselected tiles when limit reached)
- [x] T010 [P] Create `components/onboarding/SetupChecklist.tsx` — animated checklist for step 8; props: `items: {label, done: boolean}[]`; each row fades checkmark in with reanimated `withTiming`; done row text color transitions to teal (`#2BA88A`)
- [x] T011 [P] Add new i18n translation keys for all 8 new onboarding screens to `lib/i18n/translations.ts` (EN + AR strings for titles, subtitles, option labels, button labels, checklist items — ~40–60 new keys total)
- [x] T012 Update `app/(onboarding)/_layout.tsx` — change `totalSteps` to 8; update route list to reflect new screen names (`welcome`, `savings`, `diet`, `allergies`, `source`, `age`, `preferences`, `setup`); remove references to old routes

**Checkpoint**: Foundation complete. All shared components and wiring in place. Screen implementation can now begin.

---

## Phase 3: User Story 1 — Registration Before Onboarding (Priority: P1) 🎯 MVP

**Goal**: New users tap "Get Started" → see a dedicated registration screen with Google + Apple sign-in → after Google OAuth they land on onboarding step 1. Returning users still see both buttons on the login screen.

**Independent Test**: Tap "Get Started" on auth welcome → registration screen appears with both buttons. Tap "Sign in with Google" → OAuth completes → user lands on `(onboarding)/welcome`. Tap "Sign in with Apple" → nothing happens (no crash). Returning user login → both buttons visible.

- [x] T013 [US1] Create `app/(auth)/register.tsx` — registration screen with "Create your account" heading; Google sign-in button (white button, Google colored "G" logo, "Continue with Google" text); Apple sign-in button (black button, white Apple logo, "Continue with Apple" text, `onPress` calls `signInWithApple` no-op); "Already have an account?" link back to `welcome`; use `onboardingColors` and brand fonts
- [x] T014 [US1] Update `app/(auth)/welcome.tsx` "Get Started" button — change `router.push` destination from inline auth logic to `/(auth)/register`; also restyle the existing Google and Apple buttons on the login section of this screen to match the new standard button style (white card + colored logo, matching `register.tsx`)
- [x] T015 [US1] Update routing logic in `app/index.tsx` (or auth redirect logic in `app/_layout.tsx`) — ensure `user !== null && !hasCompletedOnboarding` routes to `/(onboarding)/welcome` (step 1) after registration; verify `user !== null && hasCompletedOnboarding` still routes to `/(tabs)`

**Checkpoint**: User Story 1 independently testable — registration gating works end-to-end.

---

## Phase 4: User Story 2 — Animated Welcome Screen Step 1 (Priority: P1) 🎯 MVP

**Goal**: After registration, user sees onboarding step 1: top image, animated title sequence (first set → second set), folder grid, and Continue button.

**Independent Test**: Complete registration → land on step 1 → animated titles run (no jank) → "Continue" advances to step 2.

- [x] T016 [US2] Replace `app/(onboarding)/welcome.tsx` — top image (`assets/images/onboarding-1.png`) via `heroImage` prop on `OnboardingScaffold`; Phase-1 animated text ("Hi!", "Welcome to Wasfa", "Let's get cooking." in brand primary accent color (`onboardingColors.primary`), sequential fade-in using `reanimated` `withDelay`/`withTiming`); auto-transition after ~2.5 s to Phase-2 text ("We got you!", "With Wasfa...", "You'll never lose a recipe again") + folder grid; folder grid uses `assets/images/onbarding-cards.png` as static image (non-interactive placeholder — interactive folder tiles deferred to future feature); explanatory text below grid; Continue button routes to `/(onboarding)/savings`
- [x] T017 [US2] Save step index on continue in `app/(onboarding)/welcome.tsx` — call `setOnboardingStep(1)` before `router.push`

**Checkpoint**: User Story 2 independently testable — animated step 1 visible after registration.

---

## Phase 5: User Story 3 — Savings Chart Screen Step 2 (Priority: P2)

**Goal**: Step 2 shows existing chart image and value-proposition copy. Informational only — no data collected.

**Independent Test**: Navigate to step 2 → chart image and copy visible → "Continue" advances to step 3.

- [x] T018 [US3] Create `app/(onboarding)/savings.tsx` — `OnboardingScaffold` with `heroImage={require('../../assets/images/onboarding-chart.png')}`; title "Save time and money"; subtitle explaining recipe organisation + smart grocery lists; `onBack` → `/(onboarding)/welcome`; `onContinue` → `/(onboarding)/diet`; calls `setOnboardingStep(2)` on continue

**Checkpoint**: User Story 3 independently testable — step 2 visible and navigable.

---

## Phase 6: User Story 4 — Diet Selection Screen Step 3 (Priority: P1) 🎯 MVP

**Goal**: Step 3 presents a 2-column image grid of diet options. Halal is first. Multi-select max 2. Skippable (Continue always enabled).

**Independent Test**: Navigate to step 3 → Halal is first option → can select 2 items → third tap is blocked → Continue saves to AsyncStorage and advances to step 4. Tapping Continue with nothing selected also advances (empty array saved).

- [x] T019 [US4] Create `app/(onboarding)/diet.tsx` — `OnboardingScaffold` with mascot image (reuse `assets/images/mascot.png`); title "Do you follow a diet?" (translated); subtitle text; `ImageOptionGrid` with 6 options in order: `halal`, `omnivore`, `vegetarian`, `vegan`, `keto`, `pescatarian` — use existing mascot image as placeholder for all diet images until real art is supplied; `maxSelect={2}`; **on mount: initialise selected state from `getOnboardingAnswers().diet` so back-navigation restores prior selections (FR-013)**; `onContinue` calls `saveOnboardingAnswers({ diet: selected })` then `setOnboardingStep(3)` then `router.push('/(onboarding)/allergies')`; `continueDisabled` is always `false` (skippable)
- [x] T020 [P] [US4] Add diet option placeholder images mapping to `lib/theme/onboarding.ts` — export `dietImages` object mapping diet key → `require()` path; initially all point to `mascot.png`; easy to swap when real assets arrive

**Checkpoint**: User Story 4 independently testable — diet screen functional with placeholder images.

---

## Phase 7: User Story 5 — Allergies Screen Step 4 (Priority: P2)

**Goal**: Step 4 shows a scrollable list of allergen toggle rows. Multi-select, unlimited. Skippable.

**Independent Test**: Navigate to step 4 → 8 allergens visible → tapping toggles selection state → Continue saves to AsyncStorage and advances to step 5. Empty selection also advances.

- [x] T021 [US5] Create `app/(onboarding)/allergies.tsx` — `OnboardingScaffold` with mascot image; title "Any allergies?"; subtitle "Select all that apply"; scrollable list of 8 `SelectionCard` rows (Shellfish, Seafood, Dairy, Peanut, Tree Nut, Egg, Gluten, Wheat) with toggle icons; **on mount: initialise from `getOnboardingAnswers().allergies` (FR-013)**; local state array; `onContinue` calls `saveOnboardingAnswers({ allergies: selected })` then `setOnboardingStep(4)` then navigates to `/(onboarding)/source`; always enabled

**Checkpoint**: User Story 5 independently testable — allergen toggle list functional.

---

## Phase 8: User Story 6 — How Did You Hear About Us Step 5 (Priority: P3)

**Goal**: Step 5 presents referral source cards (single-select). "I have an Invite Code" expands an inline text field. Skippable.

**Independent Test**: Navigate to step 5 → 6 source cards visible → selecting one highlights it → selecting "I have an Invite Code" reveals text input → Continue saves source + inviteCode and advances to step 6. Empty selection also advances.

- [x] T022 [US6] Replace `app/(onboarding)/source.tsx` — `OnboardingScaffold` with mascot image; title "How did you hear about us?"; 6 `SelectionCard` items: "I have an Invite Code" (with toggle to reveal `TextInput` "Enter code here" within the card), "Instagram", "Facebook", "App Store", "TikTok", "From a friend"; single-select (selecting one deselects previous); **on mount: initialise from `getOnboardingAnswers()` fields `referralSource` + `inviteCode` (FR-013)**; `onContinue` calls `saveOnboardingAnswers({ referralSource: selected, inviteCode: code || null })` then `setOnboardingStep(5)` then navigates to `/(onboarding)/age`; always enabled

**Checkpoint**: User Story 6 independently testable — referral source + invite code flow works.

---

## Phase 9: User Story 7 — Age Range Screen Step 6 (Priority: P2)

**Goal**: Step 6 shows age range single-select cards. Skippable.

**Independent Test**: Navigate to step 6 → 6 age range cards visible → selecting one highlights it (orange border + checkmark) → Continue saves to AsyncStorage and advances to step 7. Empty selection also advances.

- [x] T023 [US7] Create `app/(onboarding)/age.tsx` — `OnboardingScaffold` with mascot image; title "How old are you?"; subtitle "Select your age range"; 6 `SelectionCard` options: `<18`, `18-25`, `25-30`, `30-35`, `35-40`, `40+`; single-select local state; **on mount: initialise from `getOnboardingAnswers().ageRange` (FR-013)**; `onContinue` calls `saveOnboardingAnswers({ ageRange: selected })` then `setOnboardingStep(6)` then navigates to `/(onboarding)/preferences`; always enabled

**Checkpoint**: User Story 7 independently testable — age range selection works.

---

## Phase 10: User Story 8 — Preferences Screen Step 7 (Priority: P2)

**Goal**: Step 7 collects measurement system + nutrition display preference in two grouped single-select sections. Skippable.

**Independent Test**: Navigate to step 7 → two sections visible → each section allows one selection → Continue saves both preferences and advances to step 8. Empty selections also advance.

- [x] T024 [US8] Create `app/(onboarding)/preferences.tsx` — `OnboardingScaffold` with mascot image; title "Set your preferences"; subtitle "Customize your Wasfa experience. You can always change these later."; **Measurements section**: two `SelectionCard` rows — "Imperial (US) – Fahrenheit, pounds, cups, ounces…" and "Metric – Celsius, grams, liters…"; **Nutrition section**: two `SelectionCard` rows — "Show – Display nutrition info on recipes" and "Hide – Hide nutrition info"; independent single-select state per section; **on mount: initialise both sections from `getOnboardingAnswers()` fields `measurementSystem` + `nutritionDisplay` (FR-013)**; `onContinue` calls `saveOnboardingAnswers({ measurementSystem, nutritionDisplay })` then `setOnboardingStep(7)` then navigates to `/(onboarding)/setup`; always enabled

**Checkpoint**: User Story 8 independently testable — preferences screen works with grouped sections.

---

## Phase 11: User Story 9 — Setting Things Up Screen Step 8 (Priority: P1) 🎯 MVP

**Goal**: Step 8 shows an animated checklist as local answers are saved to Supabase. On completion the user is redirected to the main app.

**Independent Test**: Complete steps 1–7 (or navigate directly with pre-seeded local answers) → step 8 checklist animates through 3 items → after ~3 s user is redirected to `(tabs)` → `onboarding_profiles` row visible in Supabase dashboard for that user.

- [x] T025 [US9] Create `app/(onboarding)/setup.tsx` — `OnboardingScaffold` with mascot image and `showContinueButton={false}`; title "Setting things up…"; subtitle "Personalizing your experience based on your preferences."; `SetupChecklist` component with 3 items: "Saving dietary preferences", "Saving app preferences", "Getting recommendations"; on mount: load answers via `getOnboardingAnswers()`, then sequentially: mark item 1 done (save diet+allergies via `saveOnboardingProfile`), mark item 2 done (save source+age+prefs via `saveOnboardingProfile`), mark item 3 done; each step has ~800 ms delay for UX; **ONLY after all three steps succeed**: call `completeOnboarding()` then `clearOnboardingAnswers()` then `router.replace('/(tabs)')` — `clearOnboardingAnswers` MUST NOT be called before a successful save (U2 fix); on error at any step show inline retry button that re-attempts `saveOnboardingProfile` with locally preserved answers

**Checkpoint**: User Story 9 independently testable — data persists to Supabase and user enters the main app.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Remove dead code, wipe old routes, validate RTL, and ensure resume behavior works end-to-end.

- [x] T026 Delete the 8 replaced onboarding screen files: `app/(onboarding)/family.tsx`, `frequency.tsx`, `getstarted.tsx`, `goals.tsx`, `location.tsx`, `proof.tsx`, `results.tsx`, `value.tsx`
- [x] T027 [P] Verify RTL layout on all 8 new onboarding screens — check `textAlign`, icon direction, and grid order in `useLanguage` Arabic mode; fix any alignment issues in screen files and `OnboardingScaffold.tsx`
- [x] T028 [P] Implement mid-flow resume logic in `app/(onboarding)/_layout.tsx` — on mount, read `getOnboardingStep()` and `router.replace` to the correct screen if step > 0 and `!hasCompletedOnboarding`
- [ ] T029 [P] Add onboarding preferences edit section to `app/(tabs)/profile.tsx` — the existing profile screen has only a "Coming Soon" placeholder; replace the placeholder `View` with an inline "My Preferences" card containing editable sections for diet (multi-select, max 2), allergies (multi-select), measurement system (single-select), and nutrition display (single-select); on save call `saveOnboardingProfile(user.id, updatedAnswers)` and update local state; load current values from `getOnboardingAnswers()` on mount (FR-018) ⚠️ **T029 was incorrectly marked done — `profile.tsx` has no preferences UI yet; this task is OPEN**
- [ ] T030 Run full end-to-end flow on iOS simulator and Android emulator — verify animations, navigation, AsyncStorage persistence, Supabase upsert (including SC-003: save completes within 5 s of reaching step 8), and redirect to tabs

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)       → No dependencies, start immediately
Phase 2 (Foundation)  → Depends on Phase 1 ⚠️ BLOCKS all screens
Phase 3 (US1)         → Depends on Phase 2
Phase 4 (US2)         → Depends on Phase 2
Phase 5 (US3)         → Depends on Phase 2
Phase 6 (US4)         → Depends on Phase 2
Phase 7 (US5)         → Depends on Phase 6 (US4 must be navigable first)
Phase 8 (US6)         → Depends on Phase 2
Phase 9 (US7)         → Depends on Phase 2
Phase 10 (US8)        → Depends on Phase 2
Phase 11 (US9)        → Depends on Phases 3+10 (auth + all local answers must exist)
Phase 12 (Polish)     → Depends on all user story phases complete
```

### User Story Dependencies

| User Story | Priority | Depends On | Can Parallel With |
|------------|----------|------------|-------------------|
| US1 – Registration | P1 | Phase 2 | US2, US3, US4, US5, US6, US7, US8 |
| US2 – Welcome (Step 1) | P1 | Phase 2 | US1, US3, US4, US6, US7, US8 |
| US3 – Savings (Step 2) | P2 | Phase 2 | US1, US2, US4, US6, US7, US8 |
| US4 – Diet (Step 3) | P1 | Phase 2 | US1, US2, US3, US6, US7, US8 |
| US5 – Allergies (Step 4) | P2 | US4 (for navigation) | US6, US7, US8 |
| US6 – Source (Step 5) | P3 | Phase 2 | US1, US2, US3, US4, US7, US8 |
| US7 – Age (Step 6) | P2 | Phase 2 | US1, US2, US3, US4, US6, US8 |
| US8 – Preferences (Step 7) | P2 | Phase 2 | US1, US2, US3, US4, US6, US7 |
| US9 – Setup (Step 8) | P1 | US1 + US4 + US8 complete | — |

---

## Parallel Execution Examples

```
# Phase 1 — run all in parallel:
T001 answers.ts type update
T002 storage.ts step-index helpers
T003 lib/onboarding/supabase.ts
T004 lib/theme/onboarding.ts theme additions (teal, dietImages)
T005 supabase migration SQL

# Phase 2 — run in parallel after Phase 1:
T006 AuthProvider Apple stub
T007 OnboardingScaffold heroImage prop
T008 SelectionCard component
T009 ImageOptionGrid component
T010 SetupChecklist component
T011 i18n translation keys
T012 onboarding _layout.tsx update

# After Phase 2 — screens can be worked in parallel:
T013 register.tsx (US1)       |  T016 welcome.tsx (US2)    |  T018 savings.tsx (US3)
T019 diet.tsx (US4)           |  T022 source.tsx (US6)     |  T023 age.tsx (US7)
T024 preferences.tsx (US8)
```

---

## Implementation Strategy

### MVP Scope (P1 Stories Only: US1, US2, US4, US9)

1. Complete **Phase 1** (Setup)
2. Complete **Phase 2** (Foundation)
3. Complete **Phase 3** (US1 — Registration)
4. Complete **Phase 4** (US2 — Animated welcome)
5. Complete **Phase 6** (US4 — Diet selection)
6. Complete **Phase 11** (US9 — Setup + Supabase persist) — skip optional steps 4–7 (empty arrays)
7. **Validate**: Registration → 8-step flow (steps 3–7 skippable) → data in Supabase → main app
8. Deploy / demo

### Incremental Delivery After MVP

Add P2 stories (US3, US5, US7, US8) then P3 story (US6) in any order — each screen is independently navigable.

---

## Notes

- All 30 tasks use exact file paths
- [P] tasks touch different files — safe to run in parallel
- [Story] labels map 1:1 to user stories in spec.md (US1–US9)
- No test tasks generated (not requested in spec)
- Diet images use `mascot.png` as placeholder — swap when real assets are ready
- Commit after each phase checkpoint for clean git history on `002-onboarding-redesign`
