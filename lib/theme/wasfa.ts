// Redesign palette: green carries the brand (headers, today, progress),
// orange is reserved for actions (CTAs, checks, active tab, filters).
export const wasfaColors = {
  primary: "#5A8A5A",
  primaryDark: "#3D6B3D",
  primarySoft: "#E8F5E0",
  primarySoftBorder: "#D8E9C8",
  background: "#FFFCF6",
  surface: "#FFFFFF",
  soft: "#FBF7F0",
  warm: "#FFF1DE",
  ink: "#1C2B1C",
  muted: "#6E7468",
  line: "#ECE6DA",
  checkBorder: "#DDD6CA",
  cta: "#F2851A",
  ctaSoft: "#FFF0DC",
  deep: "#132416",
  onDeep: "#F7FFE8",
  onDeepSoft: "#CFE2C8",
  gold: "#F3D179",
  danger: "#D64545",
  disabled: "#E9E3D8",
  disabledText: "#A49C8E",
  scrim: "rgba(19,36,22,0.45)",
} as const;

export const wasfaRadius = {
  sm: 14,
  md: 18,
  lg: 22,
  xl: 28,
  hero: 36,
  pill: 999,
} as const;

// The floating tab bar is 60pt tall and sits 22pt above the bottom edge.
export const TAB_BAR_HEIGHT = 60;
export const TAB_BAR_BOTTOM_GAP = 22;

/** Bottom padding a tab screen's scroll content needs to clear the floating tab bar. */
export function getTabBarClearance(bottomInset: number) {
  return TAB_BAR_HEIGHT + Math.max(bottomInset, TAB_BAR_BOTTOM_GAP) + 38;
}

export const wasfaShadow = {
  cta: {
    shadowColor: wasfaColors.cta,
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  floating: {
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
} as const;
