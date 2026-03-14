# Feature Specification: Auto Language Detection

**Feature Branch**: `001-auto-language-detection`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User description: "the app does not detect the language of the phone, right now the phone is switched to arabic, but the app still shows the english mode"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - App Opens in Device Language (Priority: P1)

An Arabic-speaking user has their phone set to Arabic. When they launch the Wasfa app for the first time (or after clearing app data), the app should immediately display in Arabic with right-to-left layout — no manual configuration required.

**Why this priority**: This is the core failure the user reported. The app ignoring the phone's language setting creates a broken first-time experience and forces Arabic speakers to navigate an English UI they may not fully understand.

**Independent Test**: Install the app on a device with Arabic as the system language, launch it cold, and verify all text appears in Arabic with RTL layout.

**Acceptance Scenarios**:

1. **Given** the device system language is Arabic, **When** the user opens the app, **Then** all text is displayed in Arabic and the layout direction is right-to-left.
2. **Given** the device system language is English, **When** the user opens the app, **Then** all text is displayed in English and the layout direction is left-to-right.
3. **Given** the device system language is any non-Arabic language, **When** the user opens the app, **Then** the app defaults to English.

---

### User Story 2 - Language Updates When Device Language Changes (Priority: P2)

A user switches their phone's system language from English to Arabic while the app is running (or in the background). When they return to the app, it should reflect the new language without needing to restart.

**Why this priority**: Without this, a language switch requires a full app restart — acceptable as a workaround, but poor experience.

**Independent Test**: With the app in the background, change the device language to Arabic, return to the app, and verify the UI updates to Arabic.

**Acceptance Scenarios**:

1. **Given** the app is in the background and the device language changes to Arabic, **When** the user brings the app to the foreground, **Then** the app displays in Arabic.
2. **Given** the app is in the background and the device language changes back to English, **When** the user brings the app to the foreground, **Then** the app displays in English.

---

### User Story 3 - Manual Language Override (Priority: P3)

A user wants to use the app in a different language than their device is set to (e.g., device is in Arabic but they prefer English in this app). They should be able to change the app language from within the app settings or profile screen and have that choice persist across sessions.

**Why this priority**: While auto-detection is the primary fix, some users intentionally use apps in a different language than the system default. A manual override respects user autonomy without sacrificing the auto-detection fix.

**Independent Test**: On a device set to Arabic (so app starts in Arabic), navigate to profile/settings, change language to English, kill and reopen the app, and verify it stays in English.

**Acceptance Scenarios**:

1. **Given** the user has manually selected English in app settings, **When** the app is opened even on an Arabic device, **Then** the app respects the manual selection and shows English.
2. **Given** the user has manually selected a language, **When** the app is restarted, **Then** the manual selection persists.

---

### Edge Cases

- What happens when the device locale is a regional Arabic variant (e.g., `ar-SA`, `ar-EG`, `ar-MA`)? All Arabic variants must map to Arabic mode.
- What happens when the device has no locale set at all? App defaults to English.
- What happens on the first app launch before detection completes? App must not flash English before switching to Arabic (no visible language flicker on startup).
- What happens when a user has a manual language preference and then changes the device language? The manual preference takes priority. The user cannot revert to device auto-detection from within the app (out of scope).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST detect the device's system language at launch and display content in that language without any user action.
- **FR-002**: The app MUST support Arabic (all regional variants: ar-SA, ar-EG, ar-MA, etc.) and English as displayable languages.
- **FR-003**: All Arabic regional locale codes (`ar-*`) MUST map to Arabic display mode with right-to-left layout.
- **FR-004**: The app MUST NOT display in English when the device language is set to Arabic.
- **FR-005**: The app MUST update the displayed language when the device language changes and the user returns to the foreground.
- **FR-006**: The app MUST NOT show a visible flash of English content before switching to Arabic on Arabic-language devices.
- **FR-007**: The app MUST allow users to manually override the detected language from the Profile screen via a two-option selector (English / Arabic). Resetting the preference back to device auto-detection is out of scope.
- **FR-008**: A manually selected language preference MUST persist across app restarts and take priority over auto-detected device language.
- **FR-009**: The app MUST fall back to English for any device language that is not Arabic.

### Key Entities

- **Language Preference**: The user's explicitly chosen in-app language. When present, overrides device detection. When absent, auto-detection applies.
- **Device Language**: The system-level language setting of the device, read at app startup and on foreground resume.
- **Active Language**: The resolved language in use (`en` or `ar`), derived from manual preference if set, otherwise from device language.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of users with Arabic as their device language see the app in Arabic on first launch, with no manual configuration.
- **SC-002**: Language detection and display occur within the normal app startup time — users perceive no additional delay or flicker when the app opens in the correct language.
- **SC-003**: All Arabic regional locale variants (`ar-SA`, `ar-EG`, `ar-MA`, etc.) correctly trigger Arabic mode.
- **SC-004**: After a device language change, the app reflects the correct language within 1 foreground resume cycle (no restart required).
- **SC-005**: Manual language overrides persist across 100% of app restarts without resetting to device language.

## Clarifications

### Session 2026-03-14

- Q: Should the Profile screen language selector include a third "Auto" option to reset the manual preference and revert to device detection? → A: No — the selector is a two-option pill (EN | AR) only. Resetting to device-auto-detect is out of scope for this feature.

## Assumptions

- The app already has full Arabic translations implemented — this feature is about reliable detection and persistence, not adding new translations.
- A manual language toggle UI can be added to the existing profile screen, where language switching is already referenced in the app's translation strings.
- No server-side language preference sync is required; local device storage is sufficient for the manual override (User Story 3).
- The root cause of the reported bug is that the current device language detection mechanism does not reliably read the device locale in all environments (e.g., simulator vs. physical device, Expo Go vs. standalone build).
