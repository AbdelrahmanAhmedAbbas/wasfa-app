# Research: Auto Language Detection

**Feature**: 001-auto-language-detection
**Date**: 2026-03-14

---

## Decision 1: Device Language Detection Method

**Decision**: Replace current `Intl.DateTimeFormat().resolvedOptions().locale` with `expo-localization`'s `getLocales()`.

**Rationale**:
- `Intl.DateTimeFormat()` returns the device *region/formatting* locale, not necessarily the UI display language. On the Hermes JS engine (used by React Native), it may default to UTC and does not reliably reflect the phone's UI language.
- `NativeModules.SettingsManager` (iOS `AppleLocale`) is a deprecated, platform-specific approach prone to breaking with OS updates.
- `expo-localization` is the official Expo SDK API for this purpose. `getLocales()[0].languageCode` returns the device UI language code (e.g., `"ar"`, `"en"`) with guaranteed at-least-one-element result.

**Alternatives considered**:
- `NativeModules.SettingsManager` — works but platform-specific and brittle
- `Intl.DateTimeFormat` — wrong API for this use case (formatting, not detection)
- `react-native-localize` — community library, redundant when `expo-localization` is available

**Install**: `npx expo install expo-localization` (auto-resolves correct version for SDK 54)

**Usage**:
```
import * as Localization from 'expo-localization';
const locales = Localization.getLocales();
const languageCode = locales[0].languageCode; // "ar", "en", etc.
```

---

## Decision 2: Manual Language Override Persistence

**Decision**: Use `@react-native-async-storage/async-storage` (already installed) with key `@wasfa/language`.

**Rationale**: AsyncStorage is already a project dependency used elsewhere (onboarding answers). Adding a simple string value for language preference requires no new dependency.

**Alternatives considered**:
- MMKV (synchronous, faster) — not installed, adds dependency for marginal gain
- Supabase user preferences — requires network, not needed for local-only preference

**Pattern**:
- On manual language selection: `AsyncStorage.setItem('@wasfa/language', 'ar')`
- On app start: `AsyncStorage.getItem('@wasfa/language')` → if non-null, use it; otherwise detect from device

---

## Decision 3: Preventing Language Flash on Startup

**Decision**: The existing `LanguageProvider` already returns `null` when `isReady` is false. Extend the async initialization to also read AsyncStorage before setting `isReady = true`. This ensures the app never renders in English and then flips to Arabic.

**Rationale**: The SplashScreen is already hidden after fonts load (`_layout.tsx`). Since `LanguageProvider` renders `null` until ready, the language detection just needs to complete before `isReady` is set. Extending the `useEffect` initialization to include the AsyncStorage read (one awaited call, ~1ms) adds negligible startup time.

**Alternatives considered**:
- `useLayoutEffect` — still async-after-render, no meaningful difference for AsyncStorage reads
- Synchronous initialization — not possible with AsyncStorage which is inherently async

---

## Decision 4: Responding to Device Language Changes at Runtime

**Decision**: Keep the existing `AppState.addEventListener("change", ...)` pattern in `LanguageProvider`. On foreground resume, re-run detection — but only override the active language if the user has NOT set a manual preference.

**Rationale**: Current code already re-calls `detectDeviceLanguage()` on foreground. The enhancement is to skip the override when a user-saved preference exists in AsyncStorage.

---

## Decision 5: Manual Language Selector UI

**Decision**: Add a language toggle (EN / AR pill selector) to the existing Profile screen, replacing the "Coming Soon" placeholder section.

**Rationale**: The Profile screen is the natural settings home. Translation keys for `language`, `english`, `arabic` already exist in both EN and AR in `lib/i18n/translations.ts`. The `setLanguage` function in `LanguageProvider` currently is a no-op — it needs to be wired to AsyncStorage writes.

---

## Existing Code Status

| Component | Current State | Action Needed |
|-----------|--------------|---------------|
| `lib/i18n/LanguageProvider.tsx` | Has detection (broken) + AppState listener | Fix `detectDeviceLanguage()` + wire `setLanguage` to AsyncStorage |
| `lib/i18n/translations.ts` | Full EN+AR translations including `language`, `english`, `arabic` keys | No changes needed |
| `app/(tabs)/profile.tsx` | Has language context, no language UI | Add language toggle UI |
| `app/_layout.tsx` | Wraps app in `LanguageProvider` | No changes needed |
| `expo-localization` | NOT installed | Install via `npx expo install expo-localization` |
