# Wasfa — Google Stitch Design Brief

How to use this file:
1. Paste **Part 1 (Master Brief)** into Stitch first — it sets the product, audience, and design system.
2. Then paste **one screen prompt at a time** from Part 3. Stitch produces better results one screen per prompt.
3. Part 4 holds the future/roadmap screens (not built yet — design them ahead of the code).

---

## PART 1 — MASTER BRIEF (paste this first)

Design a mobile app called **Wasfa (وصفة)** — a recipe-saving and meal-planning app for Arabic-first home cooks in the Gulf and wider MENA region. Platform: iOS and Android, mobile-only, portrait. Fully bilingual English / Arabic with complete RTL mirroring.

### The core problem we solve
People save cooking videos on Instagram and TikTok and then lose them. Wasfa turns a saved social post into a real, structured, searchable recipe — ingredients, steps, servings, nutrition — then builds weekly meal plans and grocery lists from those recipes.

### Target audience
- **Primary:** Women aged 25–45 in Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman, Egypt and Jordan who cook for a household. Arabic is their first language; many are comfortably bilingual. Heavy Instagram and TikTok users. They save far more recipes than they ever cook.
- **Secondary:** Younger cooks aged 20–30 living alone or newly married, learning to cook, budget-conscious, and wanting to eat at home more.
- **Mindset:** Not professional chefs and not calorie-obsessed dieters. They want less daily decision fatigue, less wasted grocery money, and food their family will actually eat. Halal is the default assumption, not a special filter.
- **Emotional tone to design for:** warm, encouraging, home-kitchen, family-oriented. Never clinical, never corporate, never a fitness tracker.
- **Design implications:** large touch targets for one-handed phone use in a kitchen; Arabic typography treated as a first-class citizen, never an afterthought; food photography that reads as Gulf/Levantine home cooking (kabsa, machboos, mandi, koshari, shawarma, mahshi, fattah, dates, saffron rice) rather than Western salads and avocado toast.

### Brand personality
A cheerful kitchen assistant, not a productivity tool. Fresh, rounded, food-friendly, optimistic, and safe. The brand mascot is a soft spoon-and-leaf character that appears in onboarding, empty states, and loading moments.

### COLOR SCHEME
Botanical and warm. Pale cream and leafy greens for calm and trust, with teal for success and orange/gold as energy accents.

**Primary greens**
- Primary green `#5A8A5A` — primary buttons, selected states, brand moments
- Primary dark `#3D6B3D` — titles, high-emphasis text
- Primary darker `#2E5530` — pressed button state
- Primary light `#7BAD6E` — accent borders, highlights
- Primary soft `#E8F5E0` — selected card fills, soft badges
- Primary soft strong `#D9EFCC` — warmer selected fill
- Primary outline `#A3D48F` — outlines

**Accents**
- Secondary teal `#2BA88A` — success, "saved", extraction complete
- Secondary soft `#DDF3EB`
- Tertiary orange `#F5A623` — selected checkmarks, floating action button, food-energy highlights
- Tertiary soft `#FFF3E0`
- Gold `#F3D179` on text `#132416` — paywall CTA only

**Surfaces & backgrounds**
- Background `#FAFDF7` (pale green-white, default app background)
- Background warm `#FDF9F4` (cream)
- Background library `#FFFAF6` (warm recipe-book feel)
- Background beige `#E8DCCB`
- Background dark `#132416` (deep forest — paywall only)
- Surface white `#FFFFFF`, surface soft `#F4FAEF`, surface warm `#F6F1E9`, surface muted `#F5F8F3`

**Lines & text**
- Border `#E0EDD8`, border warm `#E0DCD6`, border muted `#C6CFBA`, divider `#E0EDD8`
- Text `#1C2B1C`, text strong `#252821`, text muted `#6B7C6B`, text subtle `#9AAD9A`, text warm muted `#7A7F74`
- Text on dark `#FFFFFF`, text on dark soft `#CFE2C8`

**Status**
- Success `#2BA88A` / success dark `#1E9F92`
- Danger `#D64545` / danger dark `#8A2626` / danger soft background `#FFF1F1`
- Scrim (bottom-sheet dim) `#1C2B1C` at low opacity

**Color rules**
- Cream, white, and pale green dominate. Never a monochrome green interface — keep it alive with cream, teal, orange, and real food photography.
- No cold blue-gray or purple anywhere. When neutral structure is needed use warm sage or beige, not gray.
- Orange and gold are highlights only, never the dominant brand color.
- Danger states stay muted: soft red text on pale pink, never harsh.

### TYPOGRAPHY
- **English: Bricolage Grotesque** — chunky, friendly, slightly quirky.
- **Arabic: Vazirmatn** — set body at weight 600 so Arabic carries the same visual weight as English.
- Display XL 52px / 900 / -2% tracking · Display LG 45px / 900 · Display MD 38px / 900
- Headline LG 32px / 800 · Headline MD 28px / 800
- Title LG 24px / 800 · Title MD 20px / 700
- Body LG 19px / 500 · Body MD 16px / 500 · Body SM 14px / 500
- Label LG 18px / 900 · Label MD 16px / 700 · Label SM 12px / 800
- Onboarding and questionnaire titles are intentionally oversized, heavy, and compact — poster-like, 38–52px. Never shrink them to generic app-header size.
- Weight discipline: 900 hero confidence, 800 page titles and food-card names, 700 buttons and list headings, 500 supporting copy.

### SHAPE, SPACING, DEPTH
- Radii: xs 6 · sm 10 · md 12 · lg 14 · xl 16 · 2xl 20 · 3xl 24 · 4xl 28 · pill 999
- Buttons are pills or near-pills (28px radius, 56px tall). Large cards 16–24px. Hero recipe images 24px. Bottom sheets 28px top corners. Never sharp rectangular enterprise shapes.
- Spacing scale: 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64
- 24px horizontal margins on narrative/onboarding screens; 16px on dense app tabs. Vertical stacks with 12–24px gaps. 24px section gaps.
- Depth is soft and sparing. Most cards are flat with a 1px sage border. Shadows only on primary CTAs (green-tinted, 0/6/16 at 15%), floating language pills, bottom navigation, and chips (0/3/12 at 8%).
- Motion: 150ms fast, 260ms standard, 420ms slow, ease-out. Pressed opacity 0.7, disabled 0.5.

### COMPONENT LANGUAGE
- **Primary CTA:** full-width green pill, 56px tall, white 18px/900 text, in a sticky footer.
- **Secondary CTA:** transparent or outlined pill, dark-green text.
- **Gold CTA:** gold pill on dark forest background — paywall only.
- **Cards:** white or pale green, 1px sage border, 16px padding, 16–20px radius.
- **Selection card:** white → soft green `#E8F5E0` fill with dark green text and an orange checkmark when selected.
- **Inputs & search:** white, 52px tall, 12–16px radius, warm border, no heavy shadow.
- **Badges:** pill-shaped; teal for success, soft green for accent.
- **Bottom sheets:** white, 28px top corners, forest-green scrim behind.
- **Back button:** 52px white circle with a subtle chevron.
- **Tab bar:** floating, rounded, with an energetic orange add/action button.
- **Progress:** thin green progress bar at the top of every questionnaire screen.

### GLOBAL SCREEN RULES
- Mobile-first with generous safe-area padding; sticky footer CTA on narrative screens.
- Onboarding screens follow: one strong image or mascot moment → oversized title → short subtitle → sticky footer CTA.
- App tabs are denser: search field, folders, recipe cards, grocery rows, compact and predictable.
- Recipe cards use real food photography with a dark gradient overlay and white text.
- **Every screen must be delivered in both an English LTR version and an Arabic RTL version** with mirrored rows, right-aligned text, and a reversed back-button direction.

---

## PART 2 — SCREEN MAP AT A GLANCE

**Built today (23 screens)**

| # | Flow | Screen | Purpose |
|---|---|---|---|
| 1 | Questionnaire | Welcome | Hook + start |
| 2 | Questionnaire | Goal | Single-select main goal |
| 3 | Questionnaire | Pain | Multi-select frustrations |
| 4 | Questionnaire | Diet | Image-grid diet choice |
| 5 | Questionnaire | Allergies | Multi-select allergens |
| 6 | Questionnaire | Solution | Problem → answer mapping |
| 7 | Questionnaire | Proof | Stats + testimonials |
| 8 | Questionnaire | Processing | Animated personalization |
| 9 | Questionnaire | Demo | Simulated Instagram import (the "aha" moment) |
| 10 | Questionnaire | Value | Recipe reveal + benefits |
| 11 | Auth | Sign up | Google / Apple |
| 12 | Paywall | Offer | Dark forest + gold CTA |
| 13 | Questionnaire | Setup | Account provisioning |
| 14 | Auth | Welcome | Returning-user sign-in |
| 15 | Auth | Register | Email fallback |
| 16 | Tabs | Home / Library | Folders + recipe grid |
| 17 | Tabs | Planner | Coming-soon placeholder |
| 18 | Tabs | Grocery | Shopping list |
| 19 | Tabs | Profile | Language, units, nutrition, account |
| 20 | Detail | Recipe detail | Ingredients, steps, nutrition, chef tip |
| 21 | Import | Import entry | Paste or share a URL |
| 22 | Import | Import progress | Live extraction status |
| 23 | System | Not found / error | Fallback |

**Planned (not built yet — Part 4):** real meal planner, week plan detail, add-to-plan sheet, recipe edit, cook mode, search & discovery, folder detail, manual recipe entry, photo/OCR import, nutrition goals, household sharing, notification settings, language & region settings, referral/share, subscription management, onboarding language picker, offline/empty/error states.

---

## PART 3 — SCREEN PROMPTS (built screens)

### 1. Questionnaire — Welcome
Full-bleed warm cream background `#FDF9F4`. A large friendly spoon-and-leaf mascot illustration centered in the upper two-thirds, optionally with soft floating food illustrations (a tomato, a herb sprig, a spice bowl) around it. Below it an oversized 45px/900 dark forest headline: "Save every recipe you find online." Then a 16px muted subtitle: "Turn Instagram and TikTok cooking posts into organized recipes, meal plans, and grocery lists." Sticky footer with a full-width green pill CTA "Let's get started". A small floating white language-toggle pill (EN / ع) in the top-right corner with a soft shadow. No progress bar on this screen.

### 2. Questionnaire — Goal
Pale green background `#FAFDF7`. Thin green progress bar at top (step 1 of 8) with a 52px white circular back button below it. Title 38px/900: "What do you want Wasfa to help with first?" Subtitle 16px muted: "Choose the main win you want this week." A vertical stack of 5 single-select cards, each 72px tall, white with a 1px sage border and a 16px radius, containing a soft-green rounded icon tile on the left and 16px/700 label text: "Save recipes from social media", "Plan family meals faster", "Eat better at home", "Spend less on groceries", "Cook food my family likes". Selected state: `#E8F5E0` fill, `#7BAD6E` border, dark green text, orange circular checkmark on the trailing edge. Sticky footer green pill "Continue", disabled at 0.5 opacity until a choice is made.

### 3. Questionnaire — Pain (multi-select)
Same frame as the Goal screen, progress at step 2. Title: "What makes meal planning hard right now?" Subtitle: "Pick all that feel familiar." Five multi-select cards with rounded-square checkboxes on the leading edge instead of radio circles: "I lose recipes I saved", "I get tired of deciding daily", "Groceries go to waste", "Family preferences are tricky", "I do not have time to organize". Multiple cards can show the selected soft-green state at once. Sticky footer green pill "Continue".

### 4. Questionnaire — Diet
Progress step 3. Title: "How do you eat?" Subtitle: "This shapes every recipe we suggest." A 2-column grid of 6 image cards, each with a 4:3 food photograph on top and a 16px/700 label beneath on white: Halal, Omnivore, Vegetarian, Vegan, Keto, Pescatarian. Use Gulf and Middle-Eastern dishes in the photography. Selected card: 2px `#7BAD6E` border, soft green tint over the image, and an orange circular checkmark in the top-trailing corner. Sticky footer green pill "Continue".

### 5. Questionnaire — Allergies
Progress step 4. Title: "Anything you need us to avoid?" Subtitle: "We will keep these out of your recipes and lists." A wrapping cloud of pill-shaped chips, each white with a sage border, an emoji or small icon, and a 14px label: Nuts, Dairy, Gluten, Eggs, Shellfish, Soy, Sesame, Fish. Selected chips flip to `#E8F5E0` fill with `#7BAD6E` border and dark green text. Below the chips, a full-width soft "None of these" option. Sticky footer green pill "Continue" plus a plain text "Skip" link beneath it.

### 6. Questionnaire — Solution
Progress step 5. Title 38px/900: "Your Wasfa plan is taking shape". Subtitle: "Here is how we will handle the parts that usually slow you down." A vertical stack of 3–5 two-row cards. Each card shows a strikethrough or muted red-tinted problem line on top ("Saved posts disappear") and a teal-checkmarked answer line below ("Wasfa turns each post into a searchable recipe card"), separated by a hairline divider. Cards are soft green `#F4FAEF` with a sage border, 20px radius. Sticky footer green pill "Continue".

### 7. Questionnaire — Proof
Warm cream background `#FDF9F4`. Progress step 6. Title: "Built for busy home cooks". Subtitle: "Wasfa is shaped around real Gulf and MENA cooking habits." A row of 3 stat tiles with huge 32px/900 green numbers over 12px/800 uppercase muted labels: "recipes organized", "less planning stress", "social imports". Below them, a horizontally scrollable carousel of 3 testimonial cards, each white with a warm beige border, a 5-star row in gold, an italic quote, and an attribution with a small circular avatar: "I finally stopped hunting through saved reels before dinner." — Noura, Riyadh; "The grocery list alone saves my weekly shop." — Mariam, Dubai; "It understands the food we actually cook at home." — Dana, Kuwait. Sticky footer green pill "Continue".

### 8. Questionnaire — Processing
Centered, no progress bar, no back button. Pale green background. A large animated circular progress ring in green with a percentage in the middle, or the mascot with a stirring-spoon animation. Title 28px/800 below: "Building your recipe-saving flow". Subtitle muted: "A quick preview is being prepared for you." Beneath, a vertical checklist of 3 steps that complete one after another, each row turning from a muted gray spinner to a teal filled checkmark with the text darkening: "Reading your answers", "Preparing import demo", "Personalizing recipe card". No CTA — this screen auto-advances.

### 9. Questionnaire — Demo ⭐ the most important screen
This is the "aha" moment: a simulated Instagram import. Three states of one screen.
- **State A (before):** Title 32px/800 "Try the import magic", subtitle "Tap once to see how a saved post becomes a usable recipe." Centered, a realistic mock social-media post card — rounded 24px, a food photo of kabsa, a fake handle row with a small circular avatar, and mock like/comment/share icons — tilted very slightly for depth with a soft shadow. Sticky footer green pill "Import with Wasfa".
- **State B (during):** the post card visibly "scans": a soft green sweep line moves down the image, and small labelled chips fly out of the photo toward the bottom of the screen. A status line cycles through "Reading the post…", "Extracting ingredients…", "Finding cooking steps…", "Saving to your library…" with a thin green progress bar.
- **State C (after):** the post card flips or morphs into a clean white Wasfa recipe card showing a title, a teal "Saved to your library" badge, an ingredient count and a step count with icons, and cook time / servings metadata. Confetti-light celebration is acceptable but keep it subtle. Sticky footer green pill "Show my plan".

### 10. Questionnaire — Value
Title 38px/900: "Your first recipe is ready". Subtitle: "Wasfa keeps the recipes you love usable when it is time to cook." A hero recipe card at 24px radius with a food photo, a dark gradient overlay and white 20px/800 title text, plus small white pills for servings and cook time. Below it, 3 benefit rows, each with a soft green circular icon tile and 16px/500 text: "Save Instagram and TikTok recipes before they get buried.", "Turn posts into ingredients, steps, and grocery lists.", and a third benefit about weekly plans. Sticky footer: primary green pill "Create my account" with a muted "Maybe later" text link beneath it.

### 11. Auth — Sign up
Pale green background, centered composition, a small back chevron top-leading. The Wasfa leaf logo at the top. Title 32px/800: "Save your recipes for good". Subtitle 16px muted: "Create a free account so your library follows you everywhere." Two stacked full-width 56px pill buttons: a white "Continue with Google" with the Google glyph and a sage border, and a black "Continue with Apple" with the Apple glyph. Below them, centered 12px legal microcopy with underlined "Terms" and "Privacy Policy" links in dark green. Keep the whole screen calm and uncluttered — no form fields.

### 12. Paywall — Offer
The only dark screen in the app. Deep forest `#132416` background with a subtle radial green glow behind the content. Top-center: a gold pill badge "7-day free trial". Title 38px/900 in white: "Unlock unlimited recipe saving". Subtitle in `#CFE2C8`. Four feature rows, each with a gold or teal checkmark and white 16px/500 text: unlimited imports, meal planning, smart grocery lists, and nutrition breakdowns. Below them, two selectable plan cards side by side — monthly and annual — where the annual card is pre-selected with a gold border and a small gold "Save 40%" ribbon. Sticky footer: a full-width gold pill CTA `#F3D179` with dark `#132416` 18px/900 text "Start my free trial", a small line beneath it reading the price and "cancel anytime", and a muted "Restore purchases" link. A dismiss X sits in the top-trailing corner.

### 13. Questionnaire — Setup
Centered, minimal. Pale green background. The mascot with a gentle bounce, a 28px/800 title "Setting up your kitchen", and a muted subtitle. A vertical checklist of provisioning steps that tick over to teal checkmarks one by one: creating your library, applying your diet, preparing your first plan. Include an error variant of the same screen: the same layout with a soft red `#FFF1F1` card, muted red text, and a green pill "Try again" button.

### 14. Auth — Welcome (returning user)
Warm cream background with a large food-photography hero at the top that fades into the background. The Wasfa logo and wordmark over it. Title 38px/900 "Welcome back", subtitle muted. A full-width green pill "Get started" and a secondary transparent pill "I already have an account". Tapping the secondary opens a white bottom sheet with 28px top corners over a forest scrim, containing a "Sign in" title, subtitle, a "Continue with Google" button, and legal microcopy.

### 15. Auth — Register (email fallback)
A simple form screen: back chevron, 28px/800 title, and three stacked 52px white input fields with warm borders and floating labels — name, email, password — with a password visibility toggle and inline validation in muted red. Full-width green pill "Create account" in a sticky footer, and a "Already have an account? Sign in" text link beneath.

### 16. Tabs — Home / Library
Warm recipe-book background `#FFFAF6`, 16px side margins. Header row: a 24px/800 greeting "Good evening, Noura" on the leading side and a circular avatar on the trailing side. Below it a 52px white search field with a sage border and a magnifier icon. Then a "Folders" section header with a small "+ New folder" text action, followed by a horizontally scrolling row of folder chips — each a rounded square tile with a food thumbnail, a folder name, and a muted recipe count — plus a dashed-border "create folder" tile at the end. Then a "Your recipes" section header and a 2-column grid of recipe cards: 24px radius, full-bleed food photo, dark gradient overlay, white 16px/800 title, and small white pills for cook time and servings. Long-pressing a folder opens a context menu with Rename and Delete. Also design the empty state: the mascot holding an empty plate, a friendly line about saving a first recipe, and a green pill "Import a recipe". A floating orange circular add button sits above a floating rounded tab bar with four items — Home, Planner, Grocery, Profile — using outline icons, a green filled pill behind the active item, and white icons on the active state.

### 17. Tabs — Planner (current placeholder)
A calm empty screen: the mascot with a calendar illustration, a 24px/800 title "Meal planner is coming soon", a muted one-line subtitle, and a soft green teaser card describing what it will do. No CTA. Keep the floating tab bar visible with Planner active.

### 18. Tabs — Grocery
Pale green background. Header: 28px/800 "Shopping list" with a muted subtitle showing item and recipe counts, and a trailing icon button for share/clear. Items are grouped under small uppercase 12px/800 muted category headers — Produce, Dairy, Meat, Pantry, Spices. Each row is a compact white card with a rounded-square checkbox on the leading edge, 16px/500 item text, and a muted trailing quantity with unit. Checked rows get a teal filled checkbox, strikethrough text, and drop to 0.5 opacity. A small progress summary sits at the top ("12 of 20 done") with a thin teal progress bar. Include the empty state: mascot with a shopping basket, "Your list is empty", a hint line, and a green pill "Add recipes to your plan".

### 19. Tabs — Profile
Pale green background. A profile header card: circular avatar, 20px/700 name, muted email, and a soft green "Free trial" or "Pro" badge. Below it, grouped settings sections with small uppercase muted headers. **Preferences:** Language with a segmented English / العربية control; Units with a segmented Metric / Imperial control; Show nutrition with a green toggle switch. **Account:** Manage subscription, Notifications, Help & support — each a white row with a leading soft-green icon tile, a 16px/500 label, and a trailing chevron. **Danger:** a "Sign out" row in muted red on a pale pink background. Also design the guest variant: the same screen with a "You are browsing as a guest" card and a "Sign in with Google" pill at the top.

### 20. Recipe detail
A tall scrolling screen. A full-bleed food photo hero at the top, about 40% of the screen height, with a dark gradient at its base; floating 36px white circular icon buttons for back, favorite, and a three-dot menu sit over it. The content sheet slides up over the image with 28px top corners on white. Inside: a 28px/800 recipe title, a row of small soft-green metadata pills for cuisine, meal type, cook time and servings, and a source attribution row showing the original Instagram or TikTok handle with a platform glyph. A servings stepper with minus and plus circular buttons scales the quantities. Then a segmented control switching between Ingredients, Instructions and Nutrition. **Ingredients:** rows with a small round checkbox, item name, and a trailing bold quantity; any allergy-conflicting item is flagged with a muted red warning chip. **Instructions:** numbered steps in large green circles with 16px/500 body text and optional per-step timing chips. **Nutrition:** a 2x2 grid of soft cards showing calories, protein, carbs, and fats with large green numbers. Below everything, a warm beige "Chef's tip" card with a lightbulb icon. Sticky footer with two buttons side by side: an outlined pill "Add to plan" and a green pill "Add to list".

### 21. Import — Entry
A focused single-purpose screen. Back chevron, 28px/800 title "Import a recipe", muted subtitle "Paste a link from Instagram, TikTok, or YouTube." A large 52px white input field with a link icon and the placeholder "Paste a video link…", plus a green "Paste" button inside the trailing edge. Below it, three platform pills with brand glyphs showing what is supported. A soft green tip card at the bottom explains that recipes can also be shared to Wasfa directly from the social app's share sheet, illustrated with a small phone-share graphic. Sticky footer green pill "Import".

### 22. Import — Progress
Centered, calm, no back button while running. A rounded preview thumbnail of the post being imported at the top. A large circular green progress ring with a percentage. A 24px/800 status title that changes as work proceeds, and beneath it a vertical list of pipeline stages that tick to teal checkmarks in sequence: downloading the video, transcribing audio, extracting ingredients, writing steps, translating, saving. The mascot appears beside the list in a "reading" pose. On completion the screen transitions to a success state with a teal checkmark burst, the finished recipe card, and a green pill "Open recipe". Also design the failure state: a muted red soft card, a plain-language explanation, and two buttons — outlined "Try again" and text "Back to home".

### 23. System — Not found / error
The mascot looking puzzled beside a tipped-over bowl, a 24px/800 title "We could not find that", a muted one-line subtitle, and a green pill "Back to home". Warm cream background.

---

## PART 4 — FUTURE SCREEN PROMPTS (roadmap, not built yet)

### 24. Meal planner — Week view
Replaces the placeholder. A horizontally scrolling week strip at the top with day pills showing the weekday letter and date; the selected day is a filled green pill. Beneath it, meal sections — Breakfast, Lunch, Dinner, Snack — each a soft card containing either a compact recipe row with a thumbnail, title and cook time, or a dashed-border "+ Add a recipe" empty slot. A trailing three-dot menu on each row offers Swap, Remove, and View recipe. A floating action button generates a full week automatically. A summary bar at the bottom shows planned meals and a "Build grocery list" green pill.

### 25. Meal planner — Day detail
A single day expanded: a large date header, a vertical timeline of meals with time-of-day markers, larger recipe cards with photos, a daily nutrition summary card with a stacked bar for calories and macros, and an "Add meal" pill at the bottom.

### 26. Add to plan — Bottom sheet
A white sheet with 28px top corners over a forest scrim. Title "Add to your plan", a small recipe preview row at the top, a horizontal day selector, a 2x2 grid of meal-slot chips (Breakfast, Lunch, Dinner, Snack), an optional servings stepper, and a full-width green pill "Add to plan".

### 27. Recipe — Edit
The recipe detail layout in an editable mode: an editable title field, a photo with a "Change photo" overlay button, ingredient rows that become editable fields with drag handles and trailing delete icons plus an "+ Add ingredient" dashed row, and the same pattern for steps with a multiline text area per step. A sticky footer with an outlined "Cancel" pill and a green "Save changes" pill.

### 28. Cook mode
A distraction-free, screen-awake cooking view. One step at a time in very large 28px/800 text on a warm cream full-screen background, with a step counter like "Step 3 of 8" and a thin green progress bar at the top. A collapsible ingredients drawer pulls up from the bottom. Large arrow buttons or full-screen swipe move between steps. Any step with a duration shows a big circular countdown timer in green with start and reset controls. A discreet exit X sits in the top corner. Design an Arabic RTL variant where the step order and arrows are mirrored.

### 29. Search & discovery
A full-screen search experience. A focused 52px search field at the top with a cancel text action. Below it, when empty: a "Recent searches" list of chips with trailing X icons, and a "Browse by cuisine" horizontal row of image chips — Saudi, Emirati, Levantine, Egyptian, Indian, Italian. When results exist: a horizontal row of filter chips for diet, cook time, meal type, and folder, then a 2-column grid of recipe cards. Include a no-results state with the mascot, a friendly line, and a green pill "Import a new recipe".

### 30. Folder detail
A header card with the folder name in 28px/800, a muted recipe count, and trailing icon buttons for rename and share. A 2-column recipe grid below. A multi-select mode shows circular checkboxes on each card and a floating action bar at the bottom with Move, Remove and Share. Include the empty folder state.

### 31. Manual recipe entry
A stepped form across three light steps with a progress bar: basics (title, photo upload tile, cuisine, meal type, cook time, servings), ingredients (repeatable quantity + unit + name rows with an add button), and steps (repeatable numbered text areas). Sticky footer with "Back" outlined and "Next" or "Save recipe" in green.

### 32. Photo / OCR import
A camera-first screen: a live camera viewfinder with a rounded green cropping frame overlay and a hint line "Point at a recipe page or handwritten card". A large circular white shutter button, a gallery thumbnail on the leading side, and a flash toggle on the trailing side. After capture, a review screen shows the photo with detected text regions highlighted in translucent green and a green pill "Extract recipe".

### 33. Nutrition goals
A calm, non-clinical screen. A title, a friendly subtitle making clear this is optional. A daily calorie target with a large stepper or slider in green. Three macro sliders — protein, carbs, fats — each with a soft colored track and a percentage readout, plus a small donut chart summarizing the split. Toggle rows for showing nutrition on recipe cards and in the planner. Sticky green "Save goals" pill. Keep the tone encouraging, never diet-shaming.

### 34. Household / family sharing
A screen showing the household name, a list of member rows with circular avatars, names, and role badges (Owner, Member), a dashed "+ Invite someone" row, and an invite bottom sheet containing a shareable code in a large monospaced pill with a copy button and a "Share invite" green pill. A soft green explainer card describes that plans and grocery lists are shared.

### 35. Notification settings
Grouped toggle rows with a leading soft-green icon tile each: meal reminders (with a time picker row beneath when enabled), grocery reminders, weekly plan ready, new feature announcements. Each toggle is green when on. A muted footnote explains quiet hours.

### 36. Language & region
A dedicated screen with two large selectable cards for English and العربية, each showing the language name in its own script with a sample line of text rendered in its own typeface, and an orange checkmark when selected. Below them, rows for region (used for ingredient names and measurement conventions), measurement system as a segmented control, and a soft explainer card noting that changing language restarts the app into the matching layout direction.

### 37. Referral / invite a friend
A celebratory warm screen. A large illustration of the mascot handing over a dish. A 32px/900 title about giving a friend a free month, a subtitle explaining the reward, a large referral code in a dashed-border pill with a copy icon, and a full-width green pill "Share invite". Below, a small progress row of avatar slots showing how many friends have joined.

### 38. Subscription management
A current-plan card at the top with the plan name, price, renewal date, and a teal "Active" badge. Below it, plan comparison cards for monthly and annual with the annual carrying a gold "Best value" ribbon. Rows for payment method, billing history, and restore purchases. At the bottom, a muted "Cancel subscription" text link in soft red — deliberately low-emphasis but clearly reachable.

### 39. Onboarding — Language picker (pre-questionnaire)
The very first screen a new user sees. Full warm cream background, the Wasfa logo centered, and two very large selectable pill cards stacked vertically: "English" and "العربية", each rendered in its own typeface at 24px/800. Below them, a muted line in both languages saying this can be changed later. A green pill "Continue" activates once a language is chosen.

### 40. Shared states library
Deliver a single sheet of reusable states in the Wasfa style: a skeleton-loading recipe grid with soft green shimmer placeholders; an offline banner as a warm beige strip with a cloud-off icon; a generic error card in soft red with a retry pill; a success toast as a teal pill with a white checkmark; a confirmation dialog as a white 24px-radius card over a forest scrim with an outlined cancel pill and a soft-red confirm pill; and an empty state template with the mascot, a title, a subtitle, and a green pill.

---

## PART 5 — DELIVERY CHECKLIST

For every screen ask Stitch for:
1. English LTR and Arabic RTL versions.
2. Default, loading, empty, and error states where they apply.
3. Selected / pressed / disabled states for every interactive control.
4. iPhone-sized frames with safe-area insets respected.
5. Colors and type pulled strictly from the tokens in Part 1 — no improvised palette.
