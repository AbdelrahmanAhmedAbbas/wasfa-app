// Timeline for the onboarding import explainer: one 12s loop in which every
// value is a pure function of the clock, so nothing mounts or unmounts between
// sections. Ported from the "Wasfa Import Explainer" motion design.
//
// Positions are in stage units: the stage is 390 wide and is scaled to fit the
// screen, with y measured from the top of the stage.

export const EXPLAINER_STAGE = { width: 390, height: 520 } as const;
export const EXPLAINER_VIDEO = { x: 80, y: 83, width: 230, height: 400 } as const;
export const EXPLAINER_RECIPE_TOP = 108;
export const EXPLAINER_PILL_TOP = 260;
/** Height the mascot images are laid out at; `MascotFrame.scale` is relative to it. */
export const EXPLAINER_MASCOT_HEIGHT = 170;

// Section starts in seconds: watch 0, share 3, extract 5, saved 8.5.
const SHARE = 3;
const EXTRACT = 5;
const SAVED = 8.5;
const END = 12;
// The last stretch of the loop puts everything back where it started.
const RESET = END - 0.45;

export const EXPLAINER_LOOP_SECONDS = END;
/** Frame shown when the system asks for reduced motion: the saved recipe. */
export const EXPLAINER_STILL_SECONDS = SAVED + 2.6;
export const EXPLAINER_SHARE_TAP = { x: 284, y: 413, at: SHARE + 0.25 } as const;
export const EXPLAINER_WASFA_TAP_AT = SHARE + 1.35;

export const MASCOT_POSE = { base: 0, reading: 1, typing: 2 } as const;

type Ease = (t: number) => number;

// The only three curves the piece uses.
function easeOut(t: number): number {
  "worklet";
  const u = t - 1;
  return u * u * u + 1;
}

function easeIn(t: number): number {
  "worklet";
  return t * t * t;
}

/** Springy overshoot, standing in for a spring. */
function pop(t: number): number {
  "worklet";
  const c1 = 1.70158;
  const u = t - 1;
  return 1 + (c1 + 1) * u * u * u + c1 * u * u;
}

function clamp01(value: number): number {
  "worklet";
  return Math.max(0, Math.min(1, value));
}

/** `from` before `start`, `to` after `end`, eased in between. */
function tween(T: number, start: number, end: number, from: number, to: number, ease?: Ease): number {
  "worklet";
  if (T <= start) return from;
  if (T >= end) return to;
  const local = (T - start) / (end - start);
  return from + (to - from) * (ease ? ease(local) : easeOut(local));
}

/** A 0 → 1 → 0 pulse centred on `at`, `width` seconds to each side. */
function bump(T: number, at: number, width: number): number {
  "worklet";
  const distance = Math.abs(T - at);
  return distance < width ? easeOut(1 - distance / width) : 0;
}

function resetProgress(T: number): number {
  "worklet";
  return tween(T, RESET, END - 0.05, 0, 1);
}

export function videoCardAt(T: number) {
  "worklet";
  const reset = resetProgress(T);
  const scale =
    T < EXTRACT ? 1 : T < RESET ? tween(T, EXTRACT, EXTRACT + 0.4, 1, 0.94, pop) : 0.94 + 0.06 * reset;
  const opacity =
    T < EXTRACT
      ? 1
      : T < SAVED - 0.2
        ? tween(T, EXTRACT, EXTRACT + 0.32, 1, 0.42)
        : T < RESET
          ? tween(T, SAVED - 0.2, SAVED + 0.22, 0.42, 0)
          : reset;
  const sharePress =
    T < SHARE + 0.25
      ? tween(T, SHARE + 0.17, SHARE + 0.25, 1, 0.82)
      : tween(T, SHARE + 0.25, SHARE + 0.45, 0.82, 1, pop);

  return {
    scale,
    opacity,
    zoom: T < EXTRACT ? 1 + 0.08 * (T / EXTRACT) : 1.08 - 0.08 * reset,
    progress: T < EXTRACT ? T / EXTRACT : 1 - reset,
    sharePress,
  };
}

export function shareSheetAt(T: number) {
  "worklet";
  const open =
    T < SHARE + 1.62
      ? tween(T, SHARE + 0.35, SHARE + 0.59, 0, 1)
      : tween(T, SHARE + 1.62, SHARE + 1.86, 1, 0);
  const wasfaPress =
    T < SHARE + 1.35
      ? tween(T, SHARE + 1.1, SHARE + 1.35, 1, 0.9)
      : tween(T, SHARE + 1.35, SHARE + 1.6, 0.9, 1, pop);

  return { open, wasfaPress };
}

/** The teal band sweeping down the video card. */
export function scanAt(T: number) {
  "worklet";
  return {
    y: tween(T, EXTRACT + 0.1, EXTRACT + 2.9, -220, 260),
    opacity:
      T < EXTRACT + 2.9
        ? tween(T, EXTRACT + 0.1, EXTRACT + 0.3, 0, 1)
        : tween(T, EXTRACT + 2.9, EXTRACT + 3.1, 1, 0),
  };
}

/** The "extracting" pill; `index` is which of the four stage labels is showing. */
export function pillAt(T: number) {
  "worklet";
  const index = Math.max(0, Math.min(3, Math.floor((T - EXTRACT - 0.1) / 0.7)));

  return {
    index,
    opacity:
      T < EXTRACT + 3.0
        ? tween(T, EXTRACT + 0.1, EXTRACT + 0.3, 0, 1)
        : tween(T, EXTRACT + 3.0, EXTRACT + 3.25, 1, 0),
    scale: 1 + 0.06 * bump(T, EXTRACT + 0.1 + 0.7 * index + 0.08, 0.1),
  };
}

export function recipeCardAt(T: number) {
  "worklet";
  return {
    opacity: T < RESET ? tween(T, SAVED - 0.02, SAVED + 0.4, 0, 1) : 1 - resetProgress(T),
    y: tween(T, SAVED - 0.02, SAVED + 0.6, 80, 0, pop),
    badge: tween(T, SAVED + 0.45, SAVED + 0.8, 0.6, 1, pop),
  };
}

/** Ingredient and step lines fade up one after another once the card lands. */
export function recipeLineAt(T: number, index: number) {
  "worklet";
  const at = SAVED + 0.6 + index * 0.1;

  return {
    opacity: T < RESET ? tween(T, at, at + 0.25, 0, 1) : 1,
    y: tween(T, at, at + 0.25, 6, 0),
  };
}

const CHIP_STARTS = [EXTRACT + 0.7, EXTRACT + 1.4, EXTRACT + 2.0];
const CHIP_FLIGHT = 0.7;

/** Ingredient chips arc from the video into the mascot's book, then its clipboard. */
export function chipAt(T: number, index: number) {
  "worklet";
  const start = CHIP_STARTS[index];
  const p = clamp01((T - start) / CHIP_FLIGHT);
  const fromX = 195 + (index - 1) * 50;
  const fromY = 278;
  // The first chip lands while the mascot is still reading.
  const toBook = start + CHIP_FLIGHT < EXTRACT + 1.5;
  const toX = toBook ? 102 : 119;
  const toY = toBook ? 448 : 421;
  const e = easeOut(p);

  return {
    x: fromX + (toX - fromX) * e,
    y: fromY + (toY - fromY) * e - 50 * Math.sin(Math.PI * p),
    opacity: T < start || p >= 1 ? 0 : p < 0.15 ? p / 0.15 : p > 0.75 ? (1 - p) / 0.25 : 1,
    scale: 1 - 0.55 * easeIn(p),
  };
}

export type MascotFrame = {
  /** Bottom-centre of the mascot. */
  x: number;
  y: number;
  rotation: number;
  /** Relative to EXPLAINER_MASCOT_HEIGHT. */
  scale: number;
  stretchX: number;
  stretchY: number;
  pose: number;
  /** True while the mascot sits behind the recipe card, peeking over its top edge. */
  behindCard: boolean;
};

const MASCOT_GROUND = 458;
const MASCOT_PERCH = EXPLAINER_RECIPE_TOP + 34;

/**
 * The mascot peeks in from the right edge, hops over to read the video and
 * take notes, then jumps onto the saved recipe and celebrates. `offscreenX`
 * is where it waits out of view, which depends on how wide the screen is.
 */
export function mascotAt(T: number, offscreenX: number): MascotFrame {
  "worklet";
  let x = offscreenX;
  let y = MASCOT_GROUND;
  let rotation = 10;
  let height = 150;
  let pose: number = MASCOT_POSE.base;
  let squash = 0;
  let behindCard = false;

  if (T >= 1 && T < EXTRACT) {
    const p = tween(T, 1, 1.5, 0, 1, pop);
    x = offscreenX + (338 - offscreenX) * p;
    y = MASCOT_GROUND - 10 * p;
    rotation = 10 - 2 * p;
    if (T > 1.5) {
      rotation += 3 * Math.sin(((T - 1.5) / 1.5) * 2 * Math.PI) * tween(T, EXTRACT - 0.6, EXTRACT - 0.2, 1, 0);
    }
  } else if (T >= EXTRACT && T < SAVED + 0.1) {
    const p = clamp01((T - EXTRACT) / 0.5);
    const e = easeOut(p);
    x = 338 + (95 - 338) * e;
    y = 448 + 60 * e - 90 * Math.sin(Math.PI * p);
    rotation = 8 - 12 * e;
    height = 150 + 20 * e;
    pose = p < 0.5 ? MASCOT_POSE.base : T < EXTRACT + 1.5 ? MASCOT_POSE.reading : MASCOT_POSE.typing;
    if (T > EXTRACT + 0.5) {
      y -= 3 * Math.sin(((T - EXTRACT - 0.5) / 1.2) * 2 * Math.PI);
    }
    squash = bump(T, EXTRACT + 0.5, 0.16) + bump(T, EXTRACT + 1.5, 0.16);
  } else if (T >= SAVED + 0.1 && T < RESET) {
    const p = clamp01((T - SAVED - 0.1) / 0.5);
    const e = easeOut(p);
    const fromY = 508 - 3 * Math.sin(((SAVED + 0.1 - EXTRACT - 0.5) / 1.2) * 2 * Math.PI);
    x = 95 + (318 - 95) * e;
    y = fromY + (MASCOT_PERCH - fromY) * e - 80 * Math.sin(Math.PI * p);
    rotation = -4 + 10 * e;
    height = 170 - 50 * e;
    pose = p < 0.5 ? MASCOT_POSE.typing : MASCOT_POSE.base;
    // A little celebratory hop and wiggle once the recipe has filled in.
    y -= 14 * Math.sin(Math.PI * clamp01((T - SAVED - 1.7) / 0.4));
    rotation +=
      T < SAVED + 1.9
        ? tween(T, SAVED + 1.7, SAVED + 1.9, 0, -8)
        : T < SAVED + 2.1
          ? tween(T, SAVED + 1.9, SAVED + 2.1, -8, 5)
          : tween(T, SAVED + 2.1, SAVED + 2.3, 5, 0);
    squash = bump(T, SAVED + 0.6, 0.16) + bump(T, SAVED + 2.1, 0.12);
    behindCard = T - SAVED - 0.1 > 0.25;
  } else if (T >= RESET) {
    const p = resetProgress(T);
    x = 318 + (offscreenX - 318) * p;
    y = MASCOT_PERCH + (MASCOT_GROUND - MASCOT_PERCH) * p;
    rotation = 6 + 4 * p;
    height = 120 + 30 * p;
  }

  return {
    x,
    y,
    rotation,
    scale: height / EXPLAINER_MASCOT_HEIGHT,
    stretchX: 1 + 0.05 * squash,
    stretchY: 1 - 0.08 * squash,
    pose,
    behindCard,
  };
}

/** A fingertip that presses at `at`, then ripples out. */
export function tapAt(T: number, at: number) {
  "worklet";
  const ripple = tween(T, at, at + 0.45, 0, 1);

  return {
    opacity: T < at ? tween(T, at - 0.25, at - 0.1, 0, 1) : tween(T, at + 0.1, at + 0.3, 1, 0),
    scale: T < at ? tween(T, at - 0.25, at, 1.3, 0.9) : tween(T, at, at + 0.2, 0.9, 1, pop),
    rippleOpacity: T < at ? 0 : 0.6 * (1 - ripple),
    rippleScale: 1 + 1.4 * ripple,
  };
}
