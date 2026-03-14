# Tasks: Auto Language Detection

**Input**: Design documents from `/specs/001-auto-language-detection/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Tests not requested — no test tasks generated

---

## Phase 1: Setup

**Purpose**: Install the new dependency required by all subsequent tasks.

- [x] T001 Install expo-localization via `npx expo install expo-localization` and confirm it appears in package.json

**Checkpoint**: `expo-localization` is listed in package.json — proceed to Foundational phase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Refactor `LanguageProvider.tsx` core internals — shared by all three user stories. Must be complete before any user story phase begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Remove `NativeModules` and `Platform` imports from `lib/i18n/LanguageProvider.tsx` and replace with `import * as Localization from 'expo-localization'`
- [x] T003 Rewrite `detectDeviceLanguage()` in `lib/i18n/LanguageProvider.tsx` to use `Localization.getLocales()[0]?.languageCode` — return `"ar"` if code starts with `"ar"`, else `"en"`, with `"en"` as fallback when array is empty
- [x] T004 Add `AsyncStorage` import from `@react-native-async-storage/async-storage` in `lib/i18n/LanguageProvider.tsx` (already a project dependency — no install needed)

**Checkpoint**: Foundation ready — LanguageProvider imports are clean, detection function uses expo-localization, AsyncStorage is imported.

---

## Phase 3: User Story 1 — App Opens in Device Language (Priority: P1) 🎯 MVP

**Goal**: Arabic-language devices see the app in Arabic immediately on cold launch, with no manual configuration and no visible English flash.

**Independent Test**: Set device/simulator language to Arabic → cold-launch the app → all text must be Arabic with RTL layout. Then test with an English device — must show English.

### Implementation for User Story 1

- [x] T005 [US1] Rewrite the `useEffect` initialization block in `lib/i18n/LanguageProvider.tsx` to call `detectDeviceLanguage()` (now using expo-localization) and call `setLanguageState(detected)` before `setIsReady(true)`, so the first render is always in the correct language

**Checkpoint**: At this point, US1 is fully functional. Set device to Arabic, cold-launch — app opens in Arabic, no flash.

---

## Phase 4: User Story 2 — Language Updates on Foreground Resume (Priority: P2)

**Goal**: When the user changes the device language in Settings and returns to the app, the app updates its displayed language without requiring a restart.

**Independent Test**: Launch app, background it, change device language in Settings, foreground the app — language updates without restart.

**Dependency on US1**: Requires Phase 3 complete (detection function must work correctly).

### Implementation for User Story 2

- [x] T006 [US2] In `lib/i18n/LanguageProvider.tsx`, update the `AppState` `"change"` event handler so that on `nextState === "active"`, it reads `AsyncStorage.getItem('@wasfa/language')` — if a saved preference exists, skip re-detection; if null, call `detectDeviceLanguage()` and update state

**Checkpoint**: US2 functional. Background the app → change device language → foreground → language updates. If user has a manual preference saved, it is NOT overridden by the device language change.

---

## Phase 5: User Story 3 — Manual Language Override (Priority: P3)

**Goal**: Users can pick EN or AR from the Profile screen. The choice persists across app restarts and takes priority over device language detection.

**Independent Test**: On an Arabic device (app shows Arabic) → tap English in Profile → app switches to English → kill and relaunch → stays English.

**Dependency on US2**: Requires Phase 4 complete (AppState handler must respect saved preference).

### Implementation for User Story 3

- [x] T007 [US3] In `lib/i18n/LanguageProvider.tsx`, update the initialization `useEffect` to first call `AsyncStorage.getItem('@wasfa/language')` — if value is `"en"` or `"ar"`, use it as the initial language; otherwise fall back to `detectDeviceLanguage()`; set `isReady(true)` only after this full async sequence completes
- [x] T008 [US3] In `lib/i18n/LanguageProvider.tsx`, implement `setLanguage` (currently a no-op) to call `await AsyncStorage.setItem('@wasfa/language', lang)` then `setLanguageState(lang)`
- [x] T009 [P] [US3] In `app/(tabs)/profile.tsx`, destructure `language` and `setLanguage` from `useLanguage()`, and add a language settings row with a two-option pill selector (using `t("english")` / `t("arabic")` labels and `t("language")` as section heading) that calls `setLanguage("en")` or `setLanguage("ar")` on press — place it above the "Coming Soon" placeholder section

**Checkpoint**: US3 functional. Open Profile on Arabic device → tap English → app shows English immediately → restart app → still English.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup and validation across all stories.

- [x] T010 [P] In `lib/i18n/LanguageProvider.tsx`, wrap the `AppState` handler's `AsyncStorage.getItem` call in a try-catch with a fallback to `detectDeviceLanguage()` to guard against AsyncStorage read failures
- [ ] T011 Run all 6 manual QA scenarios from `specs/001-auto-language-detection/quickstart.md` and confirm all pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on T001 (expo-localization installed) — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 complete (T002, T003, T004)
- **US2 (Phase 4)**: Depends on Phase 3 complete (T005 — detection must work before foreground listener is updated)
- **US3 (Phase 5)**: Depends on Phase 4 complete (T006 — AppState handler must respect saved prefs before wiring setLanguage)
- **Polish (Phase 6)**: Depends on all user story phases complete

### User Story Dependencies (Sequential — all in same file)

Since US1, US2, and US3 all modify `lib/i18n/LanguageProvider.tsx`, they must be implemented sequentially to avoid merge conflicts. US3 additionally touches `app/(tabs)/profile.tsx` which is independent.

- T009 [US3] (profile.tsx) can be done **in parallel** with T007 and T008 (LanguageProvider.tsx) once Phase 4 is complete.

### Parallel Opportunities

```
Phase 1 → Phase 2 (sequential, all small)
Phase 3 → Phase 4 → Phase 5 (sequential, same file)

Within Phase 5:
  T007 + T008 (LanguageProvider.tsx) — must be sequential
  T009 (profile.tsx) — can run in parallel with T007/T008
```

---

## Implementation Strategy

### MVP First (User Story 1 Only — 4 tasks)

1. T001: Install expo-localization
2. T002 → T003 → T004: Clean up LanguageProvider imports and detection
3. T005: Fix initialization to use new detection
4. **STOP and VALIDATE**: Arabic device → cold-launch → Arabic UI, no flash
5. This fixes the reported bug — shippable as a hotfix

### Incremental Delivery

1. **MVP** (T001–T005): Fixes the bug — Arabic devices work on launch
2. **+ US2** (T006): Adds runtime language sync on foreground resume
3. **+ US3** (T007–T009): Adds manual override with persistence + Profile UI
4. **Polish** (T010–T011): Error guard + full QA sign-off

---

## Notes

- All changes are in 2 files: `lib/i18n/LanguageProvider.tsx` (T002–T008, T010) and `app/(tabs)/profile.tsx` (T009)
- No new screens, no database changes, no server changes
- `expo-localization` is the only new dependency
- AsyncStorage is already installed — no additional install needed
- The `isReady` null-render guard already prevents flash — we just need the async init to complete the full detection sequence before flipping it
