# Data Model: Auto Language Detection

**Feature**: 001-auto-language-detection
**Date**: 2026-03-14

---

## Entities

### LanguagePreference (local device storage)

Represents a user's explicitly chosen in-app language, stored on the device. When present, overrides device auto-detection. When absent, auto-detection applies.

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `value` | `string \| null` | `"en"`, `"ar"`, or `null` | The manually selected language code. `null` means "use device default". |

**Storage key**: `@wasfa/language`
**Storage mechanism**: AsyncStorage (on-device, no network)
**Validation**: Must be one of `"en"` or `"ar"`. Any other value is treated as `null` (deleted/ignored).

**State transitions**:
```
null (not set) → "en" | "ar"   [user manually selects language]
"en" | "ar"   → "en" | "ar"   [user changes selection]
"en" | "ar"   → null           [user resets to device default — future feature]
```

---

### ActiveLanguage (runtime, in-memory only)

The resolved language the app is currently displaying. Derived from LanguagePreference and DeviceLanguage — never persisted directly.

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `language` | `AppLanguage` | `"en"` or `"ar"` | The language currently in use |
| `isRTL` | `boolean` | `true` for `"ar"`, `false` for `"en"` | Layout direction |

**Resolution logic** (priority order):
1. If `LanguagePreference.value` is set → use it
2. Else → read device locale via `expo-localization` → map `ar-*` to `"ar"`, all others to `"en"`
3. Fallback → `"en"`

---

### DeviceLanguage (runtime, read-only)

The language reported by the operating system. Read-only; the app cannot write to it.

| Field | Source | Description |
|-------|--------|-------------|
| `languageCode` | `expo-localization` `getLocales()[0].languageCode` | ISO 639-1 code: `"ar"`, `"en"`, `"fr"`, etc. |
| `languageTag` | `expo-localization` `getLocales()[0].languageTag` | BCP 47 tag: `"ar-SA"`, `"ar-EG"`, `"en-US"`, etc. |

**Mapping rule**: Any `languageCode` starting with `"ar"` → `"ar"`. All others → `"en"`.

---

## Context API Shape

The `LanguageContext` exposed to the rest of the app:

```
{
  language: "en" | "ar"          // current active language
  isRTL: boolean                  // true when language is "ar"
  t: (key: TranslationKey) => string  // translation function
  setLanguage: (lang: "en" | "ar") => Promise<void>  // manual override (persists to AsyncStorage)
}
```

Note: `setLanguage` is currently a no-op in the codebase. This feature wires it to AsyncStorage.

---

## No New Database Entities

This feature is entirely local/on-device. No new Supabase tables, columns, or server-side data required.
