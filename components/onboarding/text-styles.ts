import type { TextStyle } from "react-native";

/**
 * Display headings are set tight with negative tracking in English. Arabic
 * needs taller lines for its marks, and letter spacing would break joined letters.
 */
export function headingStyle(size: number, isRTL: boolean): TextStyle {
  return isRTL
    ? { fontSize: size, lineHeight: Math.round(size * 1.4) }
    : { fontSize: size, lineHeight: Math.round(size * 1.1), letterSpacing: -0.02 * size };
}

/** Small uppercase label above a heading. */
export function eyebrowStyle(isRTL: boolean): TextStyle {
  return isRTL ? {} : { letterSpacing: 1, textTransform: "uppercase" };
}
