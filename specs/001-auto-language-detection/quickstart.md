# Quickstart: Auto Language Detection

**Feature**: 001-auto-language-detection
**Date**: 2026-03-14

---

## What This Feature Does

Fixes the app always showing English regardless of the device language. After this feature:
- Arabic-language devices see the app in Arabic immediately on launch
- Users can manually change the in-app language from the Profile screen
- The manual selection persists across restarts

---

## How to Test (Manual QA)

### Test 1: Arabic device → Arabic app (P1 — core bug fix)

1. On a simulator or physical device, go to **Settings → General → Language & Region** and set the device language to **Arabic**.
2. Cold-launch the Wasfa app (kill it first if running).
3. **Expected**: All text is in Arabic, layout is right-to-left.

### Test 2: English device → English app

1. Set device language to **English**.
2. Cold-launch the app.
3. **Expected**: All text is in English, layout is left-to-right.

### Test 3: Regional Arabic variants

1. Set device language to **Arabic (Saudi Arabia)** or **Arabic (Egypt)**.
2. Cold-launch the app.
3. **Expected**: App displays in Arabic with RTL layout.

### Test 4: Foreground resume after language change

1. Launch the app (any language).
2. Put the app in background (home button).
3. Change device language in Settings.
4. Return to the app (do NOT restart it).
5. **Expected**: App reflects the new language without a restart.

### Test 5: Manual override — change language in Profile

1. Launch app on an Arabic device (app shows Arabic).
2. Go to **Profile** tab.
3. Tap **English** in the language selector.
4. **Expected**: App switches to English immediately.
5. Kill the app and relaunch.
6. **Expected**: App stays in English (manual preference persisted).

### Test 6: No language flash on startup

1. Set device to Arabic.
2. Cold-launch the app.
3. Watch the startup carefully.
4. **Expected**: App does NOT briefly flash English before showing Arabic.

---

## Files Changed

| File | Change |
|------|--------|
| `lib/i18n/LanguageProvider.tsx` | Fix `detectDeviceLanguage()` to use `expo-localization`; wire `setLanguage` to AsyncStorage; check stored preference on init |
| `app/(tabs)/profile.tsx` | Add language toggle UI (EN/AR pill selector) in the settings section |
| `package.json` | Add `expo-localization` dependency |

---

## Dependencies

- **expo-localization**: Install with `npx expo install expo-localization`
- **@react-native-async-storage/async-storage**: Already installed, no action needed

---

## Key Design Decisions

- **No new screens** — language selector lives in existing Profile screen
- **No server changes** — preference is stored locally only
- **No translation changes** — all Arabic text already exists in `lib/i18n/translations.ts`
- **Backward compatible** — users without a stored preference get auto-detection (new default behavior fixes the bug)
