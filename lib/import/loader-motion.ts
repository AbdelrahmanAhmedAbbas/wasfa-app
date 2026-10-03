// Timeline for the import loader: an 8s seamless loop in two beats. The mascot
// reads, and each page it turns reveals an ingredient chip that floats up and
// waits; then it writes a line per ingredient on its clipboard, each chip drops
// onto its row and a check pops. Ported from the "Wasfa Import Loader" motion
// design, with every value a pure function of the clock.
//
// The loader is a 250pt box with the mascot standing on its bottom edge. Chips
// and sparks are placed in box units; the page, pen and checklist are placed in
// the pixels of the pose image they are drawn on.

export const LOADER_SIZE = 250;
export const LOADER_LOOP_SECONDS = 8;
/** Frame shown when the system asks for reduced motion: reading, chips out. */
export const LOADER_STILL_SECONDS = 3.6;
export const LOADER_CHIPS = 3;
export const LOADER_SPARKS = 6;

export const LOADER_READING = { width: 341, height: 612 } as const;
export const LOADER_TYPING = { width: 414, height: 611 } as const;
export const LOADER_READING_SCALE = LOADER_SIZE / LOADER_READING.height;
export const LOADER_TYPING_SCALE = LOADER_SIZE / LOADER_TYPING.height;

/** Top of the book's spine, in reading-image pixels; pages turn about it. */
export const LOADER_SPINE = { x: 196, y: 350 } as const;
export const LOADER_PAGE = { width: 110, height: 13 } as const;
/** Centres of the three checklist boxes, in typing-image pixels. */
export const LOADER_ROWS = [
  { x: 258, y: 298 },
  { x: 250, y: 330 },
  { x: 242, y: 361 },
] as const;
/** Where the pen layer sits on the typing image, and the grip it pivots about. */
export const LOADER_PEN = { x: 84, y: 234, width: 97, height: 151, pivotX: 26, pivotY: 91 } as const;

const HALF = LOADER_LOOP_SECONDS / 2;
// Seconds into the reading beat at which each ingredient is found.
const FOUND = [HALF * 0.3, HALF * 0.52, HALF * 0.74];
// Seconds into the writing beat at which each chip leaves for the clipboard.
const COLLECT = [HALF * 0.14, HALF * 0.41, HALF * 0.68];
const FLIGHT = 0.7;
const SPARK_SECONDS = 0.45;

const READING_LEFT = LOADER_SIZE / 2 - (LOADER_READING.width * LOADER_READING_SCALE) / 2;
const TYPING_LEFT = LOADER_SIZE / 2 - (LOADER_TYPING.width * LOADER_TYPING_SCALE) / 2;
// The open book, in box units: chips rise out of it.
const BOOK = {
  x: READING_LEFT + LOADER_SPINE.x * LOADER_READING_SCALE,
  y: (LOADER_SPINE.y - 14) * LOADER_READING_SCALE,
};
// Where each chip waits between being found and being written down.
const PARKED = [
  { x: 2, y: 40 },
  { x: 240, y: 52 },
  { x: -4, y: 146 },
];

type Ease = (t: number) => number;

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

/** Rises from 0 to `peak` between `start` and `mid`, then settles back by `end`. */
function swing(T: number, start: number, mid: number, end: number, peak: number): number {
  "worklet";
  return T < mid ? tween(T, start, mid, 0, peak) : tween(T, mid, end, peak, 0);
}

/** A 0 → 1 → 0 pulse centred on `at`, `width` seconds to each side. */
function bump(T: number, at: number, width: number): number {
  "worklet";
  const distance = Math.abs(T - at);
  return distance < width ? easeOut(1 - distance / width) : 0;
}

/** How hard the pen is scribbling at `local` seconds into the writing beat, 0 to 1. */
function writing(local: number, ramp: number): number {
  "worklet";
  let active = 0;
  for (let i = 0; i < LOADER_CHIPS; i++) {
    const start = COLLECT[i] + FLIGHT - 0.85;
    const end = COLLECT[i] + FLIGHT - 0.1;
    active = Math.max(active, clamp01((local - start) / ramp) * clamp01((end - local) / ramp));
  }
  return active;
}

/** 0 while the mascot reads, 1 while it writes. */
export function loaderBeatAt(t: number): number {
  "worklet";
  return t < HALF ? 0 : 1;
}

export type LoaderBody = {
  /** Vertical offset of the mascot's feet; negative is up. */
  y: number;
  rotation: number;
  stretchX: number;
  stretchY: number;
};

/** The mascot's sway, nods and scribble shake, with a squash-and-hop on every beat change. */
export function loaderBodyAt(t: number): LoaderBody {
  "worklet";
  const beat = loaderBeatAt(t);
  const local = t - beat * HALF;
  // Fades the idle motion out around each beat change so the hop reads cleanly.
  const calm = clamp01((Math.min(t, Math.abs(t - HALF), LOADER_LOOP_SECONDS - t) - 0.15) / 0.35);
  let y = 0;
  let rotation = 0;
  let stretchX = 1;
  let stretchY = 1;

  if (beat === 0) {
    rotation = 2 + 1.8 * Math.sin((2 * Math.PI * local) / 1.3);
    for (let i = 0; i < LOADER_CHIPS; i++) {
      const found = FOUND[i];
      rotation += swing(local, found - 0.55, found - 0.25, found + 0.1, -4);
      const lift = bump(local, found + 0.05, 0.22);
      y -= 6 * lift;
      stretchY += 0.03 * lift;
      stretchX -= 0.015 * lift;
    }
  } else {
    const active = writing(local, 0.12);
    rotation = -2 + 1.2 * Math.sin(2 * Math.PI * 3 * local) * active;
    y = 1.2 * Math.abs(Math.sin(2 * Math.PI * 6 * local)) * active;
    for (let i = 0; i < LOADER_CHIPS; i++) {
      const landed = COLLECT[i] + FLIGHT;
      rotation += swing(local, landed - 0.05, landed + 0.12, landed + 0.4, 5);
      const squash = bump(local, landed + 0.06, 0.14);
      stretchY -= 0.05 * squash;
      stretchX += 0.03 * squash;
    }
  }

  rotation *= calm;
  y *= calm;
  stretchY += 0.012 * Math.sin((2 * Math.PI * t) / HALF) * calm;

  // Crouch, hop and land around each beat change; the pose swaps at the top of the hop.
  const fromChange = t - Math.round(t / HALF) * HALF;
  if (Math.abs(fromChange) < 0.3) {
    if (fromChange < -0.15) {
      const crouch = tween(fromChange, -0.3, -0.15, 0, 1);
      stretchX += 0.05 * crouch;
      stretchY -= 0.07 * crouch;
    } else if (fromChange < 0.15) {
      const air = Math.sin(Math.PI * ((fromChange + 0.15) / 0.3));
      y -= 16 * air;
      stretchY += 0.04 * air;
    } else {
      const land =
        fromChange < 0.2 ? tween(fromChange, 0.15, 0.2, 0, 1) : tween(fromChange, 0.2, 0.3, 1, 0, pop);
      stretchX += 0.05 * land;
      stretchY -= 0.07 * land;
    }
  }

  return { y, rotation, stretchX, stretchY };
}

/** The ground shadow shrinks and fades as the mascot leaves the floor. */
export function loaderShadowAt(body: LoaderBody) {
  "worklet";
  const closeness = 1 + body.y / 70;
  return { scale: closeness * body.stretchX, opacity: 0.12 * (0.5 + 0.5 * closeness) };
}

/**
 * The page turning over the top of the book, as a strip hinged on the spine.
 * `angle` is in radians and `length` in reading-image pixels.
 */
export function loaderPageAt(t: number) {
  "worklet";
  const local = loaderBeatAt(t) === 0 ? t : 0;
  let turn = 0;
  for (let i = 0; i < LOADER_CHIPS; i++) {
    const found = FOUND[i];
    if (local >= found - 0.5 && local <= found + 0.05) {
      turn = Math.PI * easeOut((local - found + 0.5) / 0.55);
    }
  }

  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const dx = LOADER_PAGE.width * cos;
  const dy = -(0.18 * LOADER_PAGE.width * Math.abs(cos) + 92 * sin) + 4.5;

  return {
    visible: turn > 0.001 && turn < Math.PI - 0.001,
    angle: Math.atan2(dy, dx),
    length: Math.sqrt(dx * dx + dy * dy),
    // The page darkens slightly as it stands upright.
    shade: 1 - 0.12 * sin,
  };
}

/** The pen scribbles while a line is being written and flicks away as each chip lands. */
export function loaderPenAt(t: number) {
  "worklet";
  const local = loaderBeatAt(t) === 1 ? t - HALF : 0;
  const active = writing(local, 0.1);
  let flick = 0;
  for (let i = 0; i < LOADER_CHIPS; i++) {
    const landed = COLLECT[i] + FLIGHT;
    flick += swing(local, landed - 0.05, landed + 0.08, landed + 0.35, -12);
  }

  return {
    x: 2.2 * Math.sin(2 * Math.PI * 3.25 * local) * active,
    y: 1.6 * Math.cos(2 * Math.PI * 6.5 * local) * active,
    rotation: 5 * Math.sin(2 * Math.PI * 6.5 * local) * active + flick,
  };
}

/** One checklist row: two lines drawn in turn (0 to 1 of their length), then the check. */
export function loaderRowAt(t: number, index: number) {
  "worklet";
  const local = loaderBeatAt(t) === 1 ? t - HALF : 0;
  const landed = COLLECT[index] + FLIGHT;
  const start = landed - 0.85;
  const end = landed - 0.1;
  const middle = start + (end - start) * 0.55;

  return {
    firstLine: tween(local, start, middle, 0, 1),
    secondLine: tween(local, middle, end, 0, 1),
    check: tween(local, landed, landed + 0.35, 0, 1, pop),
  };
}

/** A chip rises out of the book to its parking spot, then drops onto its checklist row. */
export function loaderChipAt(t: number, index: number, bodyY: number) {
  "worklet";
  const beat = loaderBeatAt(t);
  const local = t - beat * HALF;
  const parked = PARKED[index];
  const bob = 3 * Math.sin(2 * Math.PI * (t / 1.6 + index * 0.33));
  const odd = index % 2 === 1;

  if (beat === 0) {
    const p = clamp01((local - FOUND[index]) / 0.9);
    const e = easeOut(p);

    return {
      x: BOOK.x + (parked.x - BOOK.x) * e,
      y: BOOK.y + bodyY * (1 - e) + (parked.y - BOOK.y) * e - 24 * Math.sin(Math.PI * e) + bob * e,
      scale: 0.3 + 0.7 * pop(Math.min(1, p * 2)),
      opacity: local < FOUND[index] ? 0 : clamp01(p / 0.15),
      rotation: (odd ? 4 : -4) * (1 - e),
    };
  }

  const p = clamp01((local - COLLECT[index]) / FLIGHT);
  const e = easeOut(p);
  const row = LOADER_ROWS[index];
  const rowX = TYPING_LEFT + (row.x + 30) * LOADER_TYPING_SCALE;
  const rowY = row.y * LOADER_TYPING_SCALE + bodyY;

  return {
    x: parked.x + (rowX - parked.x) * e,
    y: parked.y + bob * (1 - e) + (rowY - parked.y) * e - 30 * Math.sin(Math.PI * e),
    scale: 1 - 0.75 * easeIn(p),
    opacity: p >= 1 ? 0 : p > 0.8 ? (1 - p) / 0.2 : 1,
    rotation: (odd ? -10 : 10) * e,
  };
}

/**
 * One of the sparks that burst out when an ingredient is found or checked off.
 * Bursts never overlap, so the same sparks are reused for every burst.
 */
export function loaderSparkAt(t: number, index: number, bodyY: number) {
  "worklet";
  const beat = loaderBeatAt(t);
  const local = t - beat * HALF;
  const count = beat === 0 ? 5 : LOADER_SPARKS;
  const radius = beat === 0 ? 26 : 22;

  for (let i = 0; i < LOADER_CHIPS; i++) {
    const p = (local - (beat === 0 ? FOUND[i] : COLLECT[i] + FLIGHT)) / SPARK_SECONDS;
    if (p < 0 || p > 1 || index >= count) continue;

    const row = LOADER_ROWS[i];
    const centerX = beat === 0 ? BOOK.x : TYPING_LEFT + row.x * LOADER_TYPING_SCALE;
    const centerY = (beat === 0 ? BOOK.y : row.y * LOADER_TYPING_SCALE) + bodyY;
    const angle = ((index / count) * 2 + i * (beat === 0 ? 0.3 : 0.25)) * Math.PI - Math.PI / 2;
    const distance = radius * easeOut(p);

    return {
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance,
      size: 9 * (1 - p) + 2,
      opacity: 1 - 0.6 * p,
    };
  }

  return { x: 0, y: 0, size: 0, opacity: 0 };
}
