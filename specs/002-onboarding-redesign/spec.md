# Feature Specification: Onboarding Flow Redesign

**Feature Branch**: `002-onboarding-redesign`
**Created**: 2026-03-14
**Status**: Draft
**Input**: Redesign the complete onboarding flow with 8 new screens, registration gate before onboarding, Apple sign-in, animated welcome, and persist onboarding data to Supabase.

## Clarifications

### Session 2026-03-14

- Q: Are onboarding steps 3-7 skippable (can user tap Continue without selecting)? → A: Yes, all steps skippable — Continue is always enabled, unselected fields stored as empty.
- Q: What triggers the step 1 title transition (Hi!/Welcome → We got you!/folder grid)? → A: Auto-timed — titles appear, pause ~2-3s, then auto-transition to second set + folder grid. All new text (titles, subtitles, options, labels) must have Arabic translations.
- Q: Can users modify onboarding preferences after completing the flow? → A: Yes, via Settings screen with ability to edit all preferences.
- Q: Resume behavior when app killed mid-onboarding? → A: Resume from last completed step, preserving all entered data.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registration Before Onboarding (Priority: P1)

A new user taps "Get Started" on the welcome/auth screen and is presented with registration options (Google and Apple sign-in). After successful registration, the user proceeds directly into the onboarding flow. The existing login screen also gains an Apple sign-in option. Both login and registration screens show Google as a standard button with the Google colored logo (not a branded OAuth badge).

**Why this priority**: Users must be authenticated before onboarding so that onboarding answers can be saved against their user ID in the database.

**Independent Test**: Can be tested by tapping "Get Started", completing Google sign-in, and verifying the user is created and redirected to onboarding step 1.

**Acceptance Scenarios**:

1. **Given** a new user on the auth welcome screen, **When** they tap "Get Started", **Then** they see registration options with Google and Apple sign-in buttons.
2. **Given** a user on the registration screen, **When** they tap "Sign in with Google", **Then** Google OAuth flow completes and they are redirected to onboarding step 1.
3. **Given** a user on the registration screen, **When** they tap "Sign in with Apple", **Then** nothing happens for now (placeholder, to be configured later).
4. **Given** a returning user on the login screen, **When** they view the auth options, **Then** they see both Google and Apple buttons styled as standard buttons with colored logos.
5. **Given** a user who completes registration, **When** the auth succeeds, **Then** a user record exists in the database before onboarding begins.

---

### User Story 2 - Animated Welcome Screen - Step 1 (Priority: P1)

After registration, the user sees an image (no border/container) with animated titles below: "Hi!", "Welcome to Wasfa", and "Let's get cooking." in a distinct accent color. These titles animate out and are replaced with "We got you!", "With Wasfa...", "You'll never lose a recipe again", followed by a grid of example recipe folders (with names, images, and recipe counts). Below the grid, explanatory text reads "Folders are your personal filing system for all your recipes" with a Continue button.

**Why this priority**: This is the first impression of the app and sets the tone for the entire experience.

**Independent Test**: Can be tested by completing registration and verifying the welcome screen displays with animations, folder grid, and Continue button.

**Acceptance Scenarios**:

1. **Given** a newly registered user, **When** they land on step 1, **Then** they see a full-width image at the top with no border or container.
2. **Given** the user is viewing step 1, **When** the screen loads, **Then** animated titles "Hi!", "Welcome to Wasfa", and "Let's get cooking." appear sequentially.
3. **Given** the initial titles are displayed, **When** the animation progresses, **Then** the titles animate away and are replaced with "We got you!", "With Wasfa...", "You'll never lose a recipe again".
4. **Given** the second set of titles is visible, **When** the user scrolls down, **Then** they see a grid of recipe folder examples with folder names, images, and recipe counts.
5. **Given** the folder grid is visible, **When** the user looks below the grid, **Then** they see "Folders are your personal filing system for all your recipes" and a Continue button.

---

### User Story 3 - Savings Chart Screen - Step 2 (Priority: P2)

The user sees a chart image (from existing assets) with informational text explaining that Wasfa helps save time and money by organizing recipes and generating grocery lists with only the ingredients that matter.

**Why this priority**: Communicates the value proposition visually, reinforcing user motivation before collecting preferences.

**Independent Test**: Can be tested by navigating to step 2 and verifying the chart image and descriptive text are displayed with a Continue button.

**Acceptance Scenarios**:

1. **Given** the user completed step 1, **When** they arrive at step 2, **Then** they see the chart image displayed prominently.
2. **Given** the user is on step 2, **When** they read the content, **Then** they see text explaining time/money savings through recipe organization and smart grocery lists.
3. **Given** the user is on step 2, **When** they tap Continue, **Then** they proceed to step 3.

---

### User Story 4 - Diet Selection Screen - Step 3 (Priority: P1)

The user sees a mascot/design image at the top and is asked "Do you follow a diet?" with diet options displayed in a 2-column grid with images. Halal is the first option. This is a multi-select with a maximum of 2 selections.

**Why this priority**: Diet preference is critical for recipe recommendations and directly impacts user experience.

**Independent Test**: Can be tested by navigating to step 3, selecting up to 2 diet options, and verifying the selection is stored.

**Acceptance Scenarios**:

1. **Given** the user is on step 3, **When** they view the screen, **Then** they see a mascot image at the top and the question "Do you follow a diet?" with subtitle "Which plan best suits your needs? You can always change this later."
2. **Given** the diet options are displayed, **When** the user views them, **Then** Halal is the first option, followed by other diets (Omnivore, Vegetarian, Vegan, Keto, Pescatarian, etc.) in a 2-column grid with images.
3. **Given** no options are selected, **When** the user taps a diet option, **Then** it becomes selected with an orange border and checkmark.
4. **Given** 2 options are already selected, **When** the user tries to select a third, **Then** the selection is prevented (maximum 2 enforced).
5. **Given** the user has made selections, **When** they tap Continue, **Then** their diet choices are saved and they proceed to step 4.

---

### User Story 5 - Allergies Screen - Step 4 (Priority: P2)

The user sees a mascot image (avocado characters) and is asked "Any allergies?" with "Select all that apply" subtitle. A scrollable list of common allergens is displayed with toggle icons, and the user can select multiple allergies.

**Why this priority**: Allergy data is important for safe recipe recommendations but is secondary to diet preference.

**Independent Test**: Can be tested by navigating to step 4, selecting allergens, and verifying selections are stored.

**Acceptance Scenarios**:

1. **Given** the user is on step 4, **When** they view the screen, **Then** they see a mascot image and "Any allergies?" title with "Select all that apply" subtitle.
2. **Given** the allergen list is displayed, **When** the user views it, **Then** they see options including: Shellfish, Seafood, Dairy, Peanut, Tree nut, Egg, Gluten, Wheat.
3. **Given** the user selects allergens, **When** they tap on an allergen row, **Then** the icon toggles to show selected state.
4. **Given** the user has made selections (or none), **When** they tap Continue, **Then** their allergy choices are saved and they proceed to step 5.

---

### User Story 6 - How Did You Hear About Us - Step 5 (Priority: P3)

The user sees a mascot image (lemon character) and is asked "How did you hear about us?" with single-select options in card format, including an invite code option with an expandable text field.

**Why this priority**: Attribution data is valuable for marketing but does not affect user experience.

**Independent Test**: Can be tested by navigating to step 5, selecting a source, and verifying it is stored.

**Acceptance Scenarios**:

1. **Given** the user is on step 5, **When** they view the screen, **Then** they see a mascot image and "How did you hear about us?" title.
2. **Given** the options are displayed, **When** the user views them, **Then** they see card-style options: "I have an Invite Code" (with expandable text field), Instagram, Facebook, App Store, TikTok, From a friend.
3. **Given** the user selects "I have an Invite Code", **When** they tap it, **Then** an "Enter code here" text field appears within the card.
4. **Given** the user selects an option, **When** it becomes selected, **Then** it shows an orange border and checkmark (single-select).
5. **Given** the user has selected a source, **When** they tap Continue, **Then** their choice is saved and they proceed to step 6.

---

### User Story 7 - Age Range Screen - Step 6 (Priority: P2)

The user sees a mascot image (apple characters) and is asked "How old are you?" with "Select your age range" subtitle. Single-select card options for age ranges are displayed.

**Why this priority**: Age data helps personalize content and is a standard onboarding question.

**Independent Test**: Can be tested by navigating to step 6, selecting an age range, and verifying it is stored.

**Acceptance Scenarios**:

1. **Given** the user is on step 6, **When** they view the screen, **Then** they see a mascot image, "How old are you?" title, and "Select your age range" subtitle.
2. **Given** the age options are displayed, **When** the user views them, **Then** they see: < 18, 18-25, 25-30, 30-35, 35-40, 40+.
3. **Given** the user selects an age range, **When** they tap it, **Then** it shows orange border and checkmark (single-select).
4. **Given** the user has selected an age range, **When** they tap Continue, **Then** their choice is saved and they proceed to step 7.

---

### User Story 8 - Preferences Screen - Step 7 (Priority: P2)

The user sees a mascot image (cherry characters) and is asked to "Set your preferences" with two sections: Measurements (Imperial/Metric, single-select) and Nutrition (Show/Hide nutrition info, single-select).

**Why this priority**: These preferences affect how recipes are displayed throughout the app.

**Independent Test**: Can be tested by navigating to step 7, selecting measurement and nutrition preferences, and verifying they are stored.

**Acceptance Scenarios**:

1. **Given** the user is on step 7, **When** they view the screen, **Then** they see a mascot image, "Set your preferences" title, and "Customize your Wasfa experience. You can always change these later." subtitle.
2. **Given** the Measurements section is visible, **When** the user views it, **Then** they see "Imperial (US) - Fahrenheit, pounds, cups, ounces..." and "Metric - Celsius, grams, liters..." options.
3. **Given** the Nutrition section is visible, **When** the user views it, **Then** they see "Show - Display nutrition info on recipes" and "Hide - Hide nutrition info" options.
4. **Given** the user makes selections, **When** they tap Continue, **Then** their preferences are saved and they proceed to step 8.

---

### User Story 9 - Setting Things Up Screen - Step 8 (Priority: P1)

The user sees a mascot image (potato characters) and a "Setting things up..." title with "Personalizing your experience based on your preferences." subtitle. A checklist of setup steps is shown with progressive completion indicators. All onboarding data is saved to the database linked to the authenticated user's ID.

**Why this priority**: This is the final onboarding step where all collected data is persisted to the backend.

**Independent Test**: Can be tested by completing all previous steps and verifying that all onboarding data appears in the database under the correct user ID.

**Acceptance Scenarios**:

1. **Given** the user arrives at step 8, **When** the screen loads, **Then** they see the mascot image, "Setting things up..." title, and the progress checklist.
2. **Given** the setup is in progress, **When** each step completes, **Then** the corresponding checklist item gets a blue checkmark and its text turns teal/green.
3. **Given** all setup steps complete, **When** the final step finishes, **Then** the user is automatically redirected to the main app.
4. **Given** the setup completes, **When** the data is verified in the database, **Then** all onboarding answers (diet, allergies, source, invite code, age range, measurements, nutrition preference) are stored against the user's ID.
5. **Given** a network error occurs during save, **When** the save fails, **Then** the user sees a retry option and data is not lost.

---

### Edge Cases

- What happens when the user kills the app mid-onboarding and reopens it? They resume from the last completed step with all previously entered data preserved (using AsyncStorage).
- What happens when Google OAuth fails during registration? The user should see an error message and be able to retry.
- What happens when the user has no network during the final "Setting things up" step? The app should show a retry option and preserve locally saved answers.
- What happens when the user selects 2 diets and tries to select a third? The third selection should be prevented with visual feedback.
- What happens when the user taps back on the first onboarding screen? They should return to the registration/auth screen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a registration screen with Google and Apple sign-in options before the onboarding flow begins.
- **FR-002**: The Google sign-in button MUST be styled as a standard button with the Google colored logo (not a branded OAuth badge), on both login and registration screens.
- **FR-003**: The Apple sign-in button MUST be present but non-functional (placeholder for future configuration).
- **FR-004**: Step 1 MUST display an image without border/container, followed by animated titles ("Hi!", "Welcome to Wasfa", "Let's get cooking.") that transition to ("We got you!", "With Wasfa...", "You'll never lose a recipe again") with a recipe folder grid and Continue button.
- **FR-005**: Step 2 MUST display the existing chart image from assets with text explaining time/money savings through recipe organization and smart grocery lists.
- **FR-006**: Step 3 MUST present diet options in a 2-column image grid with Halal as the first option, supporting multi-select with a maximum of 2 selections.
- **FR-007**: Step 4 MUST present an allergen list (Shellfish, Seafood, Dairy, Peanut, Tree nut, Egg, Gluten, Wheat) with multi-select toggle capability.
- **FR-008**: Step 5 MUST present "How did you hear about us?" with single-select card options including an invite code field.
- **FR-009**: Step 6 MUST present age range options (< 18, 18-25, 25-30, 30-35, 35-40, 40+) as single-select cards.
- **FR-010**: Step 7 MUST present measurement preference (Imperial/Metric) and nutrition display preference (Show/Hide) as single-select options within grouped sections.
- **FR-011**: Step 8 MUST display a progressive setup checklist ("Saving dietary preferences", "Saving app preferences", "Getting recommendations") with animated completion indicators.
- **FR-012**: System MUST persist all onboarding data (diet, allergies, source, invite code, age range, measurement preference, nutrition preference) to the database, linked to the authenticated user's ID.
- **FR-013**: System MUST save onboarding answers locally during the flow so data is not lost if the user navigates back.
- **FR-017**: All onboarding steps (3-7) MUST be skippable — the Continue button is always enabled regardless of whether the user has made a selection. Unselected fields are stored as empty/null.
- **FR-014**: All screens MUST follow the existing Wasfa brand colors and visual style (green accents for selected states and buttons, dark text, white/cream backgrounds, mascot images).
- **FR-015**: All screens MUST support both English and Arabic (RTL) layouts.
- **FR-016**: The onboarding flow MUST replace the existing 10-screen flow with the new 8-screen flow.
- **FR-018**: System MUST allow users to modify all onboarding preferences (diet, allergies, measurement system, nutrition display) via a Settings screen after onboarding completes.

### Key Entities

- **OnboardingProfile**: Represents a user's complete onboarding data - includes diet preferences (max 2), allergies (multiple), referral source, invite code, age range, measurement system, nutrition display preference. Linked to a user ID.
- **User**: An authenticated user account created via Google or Apple sign-in, identified by a unique ID.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% of users who begin registration complete the full onboarding flow without abandoning.
- **SC-002**: Users complete the entire onboarding flow (8 steps) in under 3 minutes.
- **SC-003**: 100% of completed onboarding flows result in all user preferences being saved to the database within 5 seconds of reaching step 8.
- **SC-004**: The animated welcome screen (step 1) title transitions complete smoothly without visible jank on supported devices.
- **SC-005**: Users can navigate back through all onboarding steps without losing previously entered data.

## Assumptions

- The existing mascot images in assets can be reused for some screens; additional mascot variants (avocado, lemon, apple, cherry, potato characters as seen in reference images) will need to be added to assets.
- The `onboarding-chart.png` asset exists and is suitable for step 2.
- The app already has Supabase configured and the user will be authenticated before onboarding begins.
- The existing `OnboardingScaffold` component can be adapted or extended for the new screen layouts.
- Diet option images (food photos for the 2-column grid) will need to be sourced and added to assets.
- The folder grid examples on step 1 will use placeholder images and data.
- Apple Sign-In will be a visual-only button for now; the actual OAuth flow will be implemented in a future feature.
