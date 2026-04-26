---
version: alpha
name: Wasfa Meal Planner
description: A warm, bilingual mobile design system for saving recipes, planning meals, and building grocery lists with a friendly food mascot identity.
colors:
  primary: "#5A8A5A"
  on-primary: "#FFFFFF"
  primary-dark: "#3D6B3D"
  primary-darker: "#2E5530"
  primary-light: "#7BAD6E"
  primary-soft: "#E8F5E0"
  primary-soft-strong: "#D9EFCC"
  primary-outline: "#A3D48F"
  secondary: "#2BA88A"
  on-secondary: "#FFFFFF"
  secondary-soft: "#DDF3EB"
  tertiary: "#F5A623"
  on-tertiary: "#1C2B1C"
  tertiary-soft: "#FFF3E0"
  gold: "#F3D179"
  on-gold: "#132416"
  background: "#FAFDF7"
  background-warm: "#FDF9F4"
  background-library: "#FFFAF6"
  background-beige: "#E8DCCB"
  background-dark: "#132416"
  surface: "#FFFFFF"
  surface-soft: "#F4FAEF"
  surface-warm: "#F6F1E9"
  surface-muted: "#F5F8F3"
  border: "#E0EDD8"
  border-warm: "#E0DCD6"
  border-muted: "#C6CFBA"
  divider: "#E0EDD8"
  text: "#1C2B1C"
  text-strong: "#252821"
  text-muted: "#6B7C6B"
  text-subtle: "#9AAD9A"
  text-warm-muted: "#7A7F74"
  text-on-dark-soft: "#CFE2C8"
  success: "#2BA88A"
  success-dark: "#1E9F92"
  danger: "#D64545"
  danger-dark: "#8A2626"
  danger-soft: "#FFF1F1"
  scrim: "#1C2B1C"
typography:
  display-xl:
    fontFamily: Bricolage Grotesque
    fontSize: 52px
    fontWeight: 900
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 45px
    fontWeight: 900
    lineHeight: 47px
    letterSpacing: -0.02em
  display-md:
    fontFamily: Bricolage Grotesque
    fontSize: 38px
    fontWeight: 900
    lineHeight: 42px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 32px
    fontWeight: 800
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Bricolage Grotesque
    fontSize: 28px
    fontWeight: 800
    lineHeight: 34px
    letterSpacing: 0em
  title-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 24px
    fontWeight: 800
    lineHeight: 30px
    letterSpacing: 0em
  title-md:
    fontFamily: Bricolage Grotesque
    fontSize: 20px
    fontWeight: 700
    lineHeight: 26px
    letterSpacing: 0em
  body-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 19px
    fontWeight: 500
    lineHeight: 25px
    letterSpacing: 0em
  body-md:
    fontFamily: Bricolage Grotesque
    fontSize: 16px
    fontWeight: 500
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Bricolage Grotesque
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: 0em
  label-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 18px
    fontWeight: 900
    lineHeight: 24px
    letterSpacing: 0em
  label-md:
    fontFamily: Bricolage Grotesque
    fontSize: 16px
    fontWeight: 700
    lineHeight: 22px
    letterSpacing: 0em
  label-sm:
    fontFamily: Bricolage Grotesque
    fontSize: 12px
    fontWeight: 800
    lineHeight: 16px
    letterSpacing: 0em
  arabic-body:
    fontFamily: Vazirmatn
    fontSize: 16px
    fontWeight: 600
    lineHeight: 24px
    letterSpacing: 0em
rounded:
  none: 0px
  xs: 6px
  sm: 10px
  md: 12px
  lg: 14px
  xl: 16px
  "2xl": 20px
  "3xl": 24px
  "4xl": 28px
  pill: 999px
  circle: 999px
spacing:
  "0": 0px
  "0-5": 2px
  "1": 4px
  "1-5": 6px
  "2": 8px
  "2-5": 10px
  "3": 12px
  "3-5": 14px
  "4": 16px
  "5": 20px
  "6": 24px
  "7": 28px
  "8": 32px
  "10": 40px
  "12": 48px
  "14": 56px
  "16": 64px
  screen-horizontal: 24px
  screen-bottom: 20px
  card-padding: 16px
  dense-card-padding: 14px
  section-gap: 24px
  control-gap: 12px
shadows:
  soft-green:
    color: "#5A8A5A"
    opacity: 0.15
    offset-x: 0px
    offset-y: 6px
    blur: 16px
    spread: 0px
  chip:
    color: "#1C2B1C"
    opacity: 0.08
    offset-x: 0px
    offset-y: 3px
    blur: 12px
    spread: 0px
  card:
    color: "#000000"
    opacity: 0.10
    offset-x: 0px
    offset-y: 2px
    blur: 4px
    spread: 0px
  floating-tab:
    color: "#000000"
    opacity: 0.20
    offset-x: 0px
    offset-y: 4px
    blur: 5px
    spread: 0px
elevation:
  flat:
    level: 0
    shadow: none
  raised:
    level: 2
    shadow: "{shadows.card}"
  chip:
    level: 3
    shadow: "{shadows.chip}"
  cta:
    level: 4
    shadow: "{shadows.soft-green}"
  floating:
    level: 5
    shadow: "{shadows.floating-tab}"
motion:
  duration-fast-ms: 150
  duration-standard-ms: 260
  duration-slow-ms: 420
  easing-standard: ease-out
  easing-emphasized: cubic-out
  pressed-opacity: 0.7
  disabled-opacity: 0.5
components:
  app-screen:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
  warm-library-screen:
    backgroundColor: "{colors.background-library}"
    textColor: "{colors.text}"
  dark-paywall-screen:
    backgroundColor: "{colors.background-dark}"
    textColor: "{colors.text-on-dark-soft}"
  card-standard:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card-padding}"
  card-soft:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.card-padding}"
  card-warm:
    backgroundColor: "{colors.surface-warm}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.6}"
  recipe-image-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.3xl}"
    height: 260px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.4xl}"
    height: 56px
    padding: "0px 24px"
  button-primary-pressed:
    backgroundColor: "{colors.primary-darker}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.primary-dark}"
    typography: "{typography.label-md}"
    rounded: "{rounded.pill}"
    height: 56px
    padding: "0px 24px"
  button-gold:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.4xl}"
    height: 56px
    padding: "0px 24px"
  icon-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.circle}"
    size: 36px
  back-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-subtle}"
    rounded: "{rounded.circle}"
    size: 52px
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xl}"
    height: 52px
    padding: "0px 14px"
  selection-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: "{spacing.4}"
  selection-card-selected:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.xl}"
    padding: "{spacing.4}"
  badge-success:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  badge-accent:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-dark}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.pill}"
    padding: "7px 10px"
  bottom-sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.4xl}"
    padding: "{spacing.5}"
---

## Overview

Wasfa feels like a cheerful kitchen assistant rather than a clinical productivity tool. The visual identity is fresh, rounded, and food-friendly: pale cream and leafy greens establish calm and trust, while a spoon-and-leaf mascot gives the app a soft, playful personality. Interfaces should feel optimistic and approachable, with large touch targets, gentle cards, and confident headings that make recipe capture and meal planning feel easy.

The product is bilingual and mobile-first. English screens use Bricolage Grotesque for its chunky, friendly character; Arabic screens use Vazirmatn with a slightly stronger weight so the two languages feel equally intentional. The UI should support both left-to-right and right-to-left composition without changing the underlying brand mood.

## Colors

The core palette is botanical and warm. Use fresh green for primary actions, selected states, folder creation, and brand moments. Pair it with off-white and cream surfaces rather than stark gray. White cards sit on pale green or warm cream backgrounds, creating a clean recipe-book feeling.

Dark forest green is the anchor for titles, paywall backgrounds, and high-emphasis copy. Teal is reserved for completion, extraction, saved, and success states. Orange and gold are accent colors for selected marks, tabs, paywall CTAs, and food-energy moments; they should appear as highlights, not as the dominant brand color.

Avoid cold blue-gray interfaces. When neutral structure is needed, prefer warm borders like soft sage or beige. Danger states use muted red with pale pink backgrounds so errors remain clear without feeling harsh.

## Typography

Type is expressive and rounded. Display and onboarding titles are intentionally oversized, heavy, and compact, often using 38-52px sizes with 800-900 weights. This creates a friendly poster-like rhythm on onboarding and questionnaire screens.

Body text is smaller and calmer, usually 14-19px with generous line height. Labels and CTAs should be bold enough to feel tactile, especially on pill buttons and badges. Use numeric weights consistently: 900 for hero confidence, 800 for page titles and food-card names, 700 for buttons and list headings, 500 for supportive copy.

For Arabic, use Vazirmatn at weight 600 for normal text. Maintain the same spacing and hierarchy as English screens, but allow right alignment and RTL row reversal where needed.

## Layout

The layout system is mobile-first with generous safe-area padding. Standard screens use 24px horizontal margins for narrative flows and 16px for dense app tabs. Content is organized in vertical stacks with 12-24px gaps. Cards and inputs sit inside full-screen surfaces rather than web-style section layouts.

Onboarding screens favor one strong image or mascot moment, a large title, a short subtitle, and a sticky footer CTA. App tabs are denser: search fields, folders, recipe cards, grocery rows, and profile actions use compact cards with clear borders and predictable spacing.

Use imagery as real product content. Recipe cards should show food imagery with a dark overlay and white text when possible. Mascot and food illustrations should be large enough to carry the emotional tone, especially in empty states, onboarding, and demos.

## Elevation & Depth

Depth is soft and sparing. The base hierarchy comes from tonal layers, borders, and rounded containment; shadows are reserved for floating language pills, primary CTAs, bottom navigation, and raised profile actions.

When shadows appear, they should be low-opacity and diffused. Green-tinted CTA shadows are preferred over generic gray where the action is brand-forward. Most content cards can remain flat with a 1px sage or warm beige border.

## Shapes

Wasfa uses a very rounded shape language. Buttons are pills or near-pills, large cards use 16-24px radii, hero recipe images use 24px, and sheets use 28px top corners. Tiny controls such as checkboxes and badges still keep softened edges.

Do not mix sharp, rectangular enterprise shapes into this interface. The mascot, leaf logo, and rounded food illustrations set the tone: friendly, safe, and tactile.

## Components

Primary CTAs are tall green pills with white bold text. They typically sit in sticky footers and should span the available width. Secondary actions are outline or transparent text-first controls, often also pill-shaped. The paywall may use a gold CTA on a dark forest surface for stronger contrast.

Cards are white or pale green with a thin sage border. Selection cards use a soft green background and may add orange checkmarks or accent badges. Grocery rows are compact, with a small rounded checkbox, food item text, and muted metadata.

Inputs and search bars are white, 52px tall, and rounded at 12-16px. Use warm borders instead of heavy shadows. Bottom sheets are white, rounded at the top, and dim the background with a forest-green scrim.

Tab navigation can be more energetic: a floating orange add/action button is acceptable, especially when paired with otherwise calm green and cream surfaces.

## Do's and Don'ts

- Do use cream, white, and pale green as the dominant surfaces.
- Do use forest green for important titles and green pills for primary actions.
- Do make touch targets large, rounded, and easy to scan.
- Do include mascot or food imagery for onboarding, empty states, and recipe demos.
- Do preserve RTL support with mirrored rows and right-aligned text when Arabic is active.
- Don't make the UI monochrome green; use warm cream, teal, orange, and food imagery to keep it lively.
- Don't use heavy gray shadows on ordinary cards.
- Don't shrink onboarding titles into generic app headings; they should feel bold and welcoming.
- Don't use cold blue or purple as a primary brand direction.
- Don't reference implementation tokens, code variables, or asset paths when reproducing this design system.
