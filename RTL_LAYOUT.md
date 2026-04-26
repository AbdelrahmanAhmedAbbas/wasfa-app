# RTL Layout Guide

This app supports English (LTR) and Arabic (RTL). The important detail is that RTL is applied at the root of the app, not screen by screen. That means many layout values become logical instead of physical once Arabic is active.

Read this before adding or changing UI. Most RTL bugs here come from trying to manually flip something that Yoga already flipped.

## Root Direction

`app/_layout.tsx` wraps the app in a root `View` whose `direction` follows the current language:

```tsx
const direction = isRTL ? "rtl" : "ltr";

return (
  <View style={{ flex: 1, direction }}>
    {/* app */}
  </View>
);
```

When `direction` is `"rtl"`, React Native/Yoga treats row layout, start/end edges, and text alignment as logical. In this app, that means a value that looks like "left" in code can render at the visual right edge in Arabic.

## The Bug We Hit

The home screen Arabic layout looked left-aligned even though many elements had `textAlign: "right"`.

Root cause:

- The root parent already had `direction: "rtl"`.
- Under that RTL parent, `textAlign: "right"` behaved like logical end, which rendered on the visual left.
- Several local RTL overrides used `row-reverse` or `alignItems: "flex-end"`, which double-flipped layout back toward LTR.

Result:

- Arabic titles, buttons, folder names, the empty state, and the new recipe button drifted to the wrong side.
- Components that should hug the right edge in Arabic instead appeared left-aligned.

## Actual Fix

The fix is to use logical-start alignment and let the root RTL direction do the visual flip.

Reference implementation:

```ts
export function getHomeScreenLayout(isRTL: boolean) {
  if (isRTL) {
    return {
      headerArrow: "arrow-left" as const,
      textAlign: "left" as const,
      writingDirection: "rtl" as const,
      recipeMenuPosition: {
        left: 10,
        right: "auto" as const,
      },
    };
  }

  return {
    headerArrow: "arrow-right" as const,
    textAlign: "left" as const,
    writingDirection: "ltr" as const,
    recipeMenuPosition: {
      left: "auto" as const,
      right: 10,
    },
  };
}
```

Why `textAlign: "left"` for both languages?

- In English, root direction is LTR, so `"left"` renders on the visual left.
- In Arabic, root direction is RTL, so `"left"` acts as logical start and renders on the visual right.
- This matches the existing pattern in `components/onboarding/OnboardingScaffold.tsx`.

Use `homeLayout.textAlign` instead of hardcoded values. For example, the display-name line in `app/(tabs)/index.tsx` should use:

```tsx
<Text style={{ textAlign: homeLayout.textAlign }}>
  {displayNameLabel}
</Text>
```

Do not hardcode `textAlign: "right"` for Arabic screens inside the root RTL tree.

## Rules

Use these rules for app screens that are rendered under `app/_layout.tsx`.

### Text

Do:

```tsx
const textAlign = "left";

<Text style={{ textAlign, writingDirection: isRTL ? "rtl" : "ltr" }}>
  {title}
</Text>
```

Or use a screen helper like `getHomeScreenLayout(isRTL)`:

```tsx
<Text
  style={{
    textAlign: homeLayout.textAlign,
    writingDirection: homeLayout.writingDirection,
  }}
>
  {title}
</Text>
```

Avoid:

```tsx
<Text style={{ textAlign: isRTL ? "right" : "left" }} />
```

That can push Arabic text to the visual left because the root already supplies RTL direction.

### Flex Rows

Do:

```tsx
<View style={{ flexDirection: "row" }} />
```

Yoga will render row children right-to-left when the root direction is RTL.

Avoid:

```tsx
<View style={{ flexDirection: isRTL ? "row-reverse" : "row" }} />
```

Inside the root RTL tree, this often double-flips the row.

### Start and End

Use logical start/end concepts. In the root RTL tree:

- `flex-start` means visual right in Arabic and visual left in English.
- `flex-end` means visual left in Arabic and visual right in English.

Avoid using `alignItems: "flex-end"` when what you mean is "align to the Arabic right edge." Use `flex-start` or inherit the normal row behavior instead.

### Absolute Positioning

Absolute `left` and `right` are still physical positions. Swap them deliberately:

```ts
recipeMenuPosition: isRTL
  ? { left: 10, right: "auto" as const }
  : { left: "auto" as const, right: 10 };
```

### Horizontal ScrollView Order

Horizontal `ScrollView` visual order can still need explicit handling. If the "first" item must appear on the right in Arabic, render a different child order for RTL.

Reference:

- `renderFolderTiles` in `app/(tabs)/index.tsx`

### Directional Icons

Icons that imply direction must be selected from `isRTL`:

```ts
headerArrow: isRTL ? "arrow-left" : "arrow-right";
```

This applies to arrows, chevrons, next/back icons, and any control that visually points through the interface.

### Mixed Arabic and Latin Text

Wrap embedded LTR text, such as English names in Arabic UI, with bidi isolates:

```ts
function wrapLtrInlineText(value: string) {
  return /[A-Za-z0-9]/.test(value) ? `\u2066${value}\u2069` : value;
}
```

Reference:

- `wrapLtrInlineText` in `app/(tabs)/index.tsx`

## Checklist Before Shipping RTL UI

- [ ] Test the screen in Arabic and English.
- [ ] Text uses `textAlign: "left"` or a helper that returns logical-start alignment under the root direction.
- [ ] Text with meaningful direction also sets `writingDirection`.
- [ ] There is no local `row-reverse` unless the component is intentionally outside the root RTL behavior.
- [ ] There is no `alignItems: "flex-end"` used as a shortcut for "right aligned in Arabic."
- [ ] Absolute `left` and `right` positions are swapped intentionally.
- [ ] Horizontal scrollers manually order children when visual order matters.
- [ ] Directional icons flip with `isRTL`.
- [ ] Mixed Arabic/Latin strings use bidi isolates where needed.

## Known Good References

- `app/_layout.tsx`: sets root `direction`.
- `components/onboarding/OnboardingScaffold.tsx`: uses `textAlign = "left"` because root RTL flips it visually.
- `lib/home/home-screen.ts`: centralizes home-screen alignment, writing direction, arrows, and absolute menu positions.
- `app/(tabs)/index.tsx`: uses `homeLayout.textAlign`, `renderFolderTiles`, and `wrapLtrInlineText`.
- `app/(tabs)/_layout.tsx`: handles tab-bar visual ordering separately because the dock has physical animation math.

## Red Flags

When reviewing RTL changes, search for these first:

```text
row-reverse
textAlign: "right"
alignItems: "flex-end"
justifyContent: "flex-end"
marginLeft
marginRight
paddingLeft
paddingRight
left:
right:
```

These are not always wrong, but each one needs a reason. If there is no reason, prefer the root direction and logical-start behavior.
