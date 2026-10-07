/**
 * The step a tap on the cook mode screen leads to. "Next" is the side the reader's
 * language reads toward: the right half of the screen in English, the left half in
 * Arabic. A tap past the first or last step stays where it is.
 */
export function getCookStepAfterTap(tap: {
  /** Where the finger landed, measured from the screen's left edge. */
  x: number;
  screenWidth: number;
  isRTL: boolean;
  index: number;
  total: number;
}): number {
  const tappedRight = tap.x >= tap.screenWidth / 2;
  const forward = tappedRight !== tap.isRTL;
  const target = tap.index + (forward ? 1 : -1);
  return Math.min(Math.max(target, 0), Math.max(tap.total - 1, 0));
}
