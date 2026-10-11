// Ingredient amounts as a cook measures them. Scaling a recipe gives exact numbers
// ("0.35 onion", "1.67 tbsp"); these turn them into amounts a kitchen can measure:
// half an onion, whole eggs, quarter teaspoons, round grams. Pure, so the server
// that scales recipes and the app that shows them read amounts the same way.

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅛": 1 / 8,
};

/**
 * The number in an amount written "2", "0.5", "1/2", "1 1/2", "1½" or "٢", or null
 * for anything else ("2-3", "to taste"), which is left as written.
 */
export function parseAmount(text: string | undefined): number | null {
  if (!text) return null;
  const plain = text
    .trim()
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/٫/g, ".")
    .replace(/(\d)\s*([½⅓⅔¼¾⅛])/g, "$1 $2");
  if (!/^[\d\s./½⅓⅔¼¾⅛]+$/.test(plain)) return null;

  let total = 0;
  for (const part of plain.split(/\s+/)) {
    if (part in UNICODE_FRACTIONS) total += UNICODE_FRACTIONS[part];
    else if (/^\d+\/\d+$/.test(part)) {
      const [numerator, denominator] = part.split("/").map(Number);
      if (denominator === 0) return null;
      total += numerator / denominator;
    } else if (/^\d+(?:\.\d+)?$/.test(part)) total += Number(part);
    else return null;
  }
  return total > 0 && Number.isFinite(total) ? total : null;
}

/** Rounds to the nearest of `steps` (fractions of one), on top of the whole part. */
function nearestFraction(value: number, steps: number[]): number {
  const whole = Math.floor(value);
  const part = value - whole;
  const candidates = [0, ...steps, 1];
  const best = candidates.reduce((closest, step) => (Math.abs(step - part) < Math.abs(closest - part) ? step : closest));
  return whole + best;
}

const QUARTERS = [1 / 4, 1 / 2, 3 / 4];
const QUARTERS_AND_THIRDS = [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4];
const HALVES = [1 / 2];

// Things that only come whole: no one buys or cracks half of them.
const WHOLE_ONLY = /\b(eggs?|cloves?)\b|بيض|بيضة|بيضات|فص|فصوص/i;
// Units counted in whole pieces.
const WHOLE_UNITS = new Set(["clove", "slice", "piece", "pinch", "dash", "splash", "drop", "handful", "stick", "sprig", "leaf"]);
// Units that can sensibly be halved: half a can, half a bunch, half a lemon.
const HALVABLE_UNITS = new Set(["whole", "can", "pack", "bunch", "head", ""]);

export type KitchenAmount = { quantity: number; unit: string | undefined };

/**
 * The amount a cook would measure for `value` of `unit`. Small and large amounts
 * move to the unit that reads best: 0.1 cup is 1½ tbsp, 1250 g is 1.25 kg,
 * 0.35 kg is 350 g. Nothing rounds down to zero.
 */
export function roundForKitchen(value: number, unit: string | undefined, name: string): KitchenAmount {
  const key = unit?.trim().toLowerCase() ?? "";

  switch (key) {
    case "g":
    case "ml": {
      const big = key === "g" ? "kg" : "l";
      if (value >= 1000) return roundForKitchen(value / 1000, big, name);
      if (value < 10) return { quantity: Math.max(1, Math.round(value)), unit };
      if (value < 100) return { quantity: Math.round(value / 5) * 5, unit };
      return { quantity: Math.round(value / 25) * 25, unit };
    }
    case "kg":
    case "l": {
      const small = key === "kg" ? "g" : "ml";
      if (value < 1) return roundForKitchen(value * 1000, small, name);
      return { quantity: nearestFraction(value, QUARTERS), unit };
    }
    case "cup":
      // Less than a quarter cup is measured with a spoon.
      if (value < 0.22) return roundForKitchen(value * 16, "tbsp", name);
      return { quantity: value >= 4 ? nearestFraction(value, HALVES) : nearestFraction(value, QUARTERS_AND_THIRDS), unit };
    case "tbsp":
      if (value < 0.9) return roundForKitchen(value * 3, "tsp", name);
      if (value >= 16) return roundForKitchen(value / 16, "cup", name);
      return { quantity: nearestFraction(value, HALVES), unit };
    case "tsp":
      if (value >= 3) return roundForKitchen(value / 3, "tbsp", name);
      return { quantity: Math.max(1 / 4, value < 2 ? nearestFraction(value, QUARTERS) : nearestFraction(value, HALVES)), unit };
    case "oz":
      if (value >= 16) return roundForKitchen(value / 16, "lb", name);
      return { quantity: Math.max(1 / 2, nearestFraction(value, HALVES)), unit };
    case "lb":
      if (value < 0.5) return roundForKitchen(value * 16, "oz", name);
      return { quantity: nearestFraction(value, QUARTERS), unit };
  }

  if (WHOLE_UNITS.has(key) || WHOLE_ONLY.test(name)) {
    return { quantity: Math.max(1, Math.round(value)), unit };
  }
  if (HALVABLE_UNITS.has(key)) {
    // Half an onion, one and a half lemons; past a few, whole ones.
    if (value < 3) return { quantity: Math.max(1 / 2, nearestFraction(value, HALVES)), unit };
    return { quantity: Math.round(value), unit };
  }
  return { quantity: Math.max(1 / 4, value < 10 ? nearestFraction(value, QUARTERS) : Math.round(value)), unit };
}

const FRACTION_TEXT: Array<[number, string]> = [
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [1 / 2, "1/2"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
];

/** An amount as it is saved: "2", "1/2", "1 1/2", "1.25". */
export function formatAmount(value: number): string {
  const whole = Math.floor(value);
  const part = value - whole;
  if (part < 0.001) return String(whole);
  const fraction = FRACTION_TEXT.find(([fractionValue]) => Math.abs(part - fractionValue) < 0.001)?.[1];
  if (fraction) return whole > 0 ? `${whole} ${fraction}` : fraction;
  return String(Math.round(value * 100) / 100);
}

const FRACTION_GLYPHS: Array<[number, string]> = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
];

/**
 * An amount as a cook reads it: "0.5" and "1/2" read "½", "1 1/2" reads "1½". An
 * amount that is not a single number ("2-3", "to taste") is shown as written.
 */
export function displayAmount(text: string | undefined): string | undefined {
  const value = parseAmount(text);
  if (value === null) return text;
  const whole = Math.floor(value);
  const part = value - whole;
  if (part < 0.02) return String(whole);
  if (part > 0.98) return String(whole + 1);
  const glyph = FRACTION_GLYPHS.find(([fraction]) => Math.abs(part - fraction) < 0.02)?.[1];
  if (glyph) return whole > 0 ? `${whole}${glyph}` : glyph;
  return String(Math.round(value * 100) / 100);
}

/**
 * An ingredient's amount for `factor` times the recipe, rounded the way a cook
 * measures. An amount that is not a single number is kept as written.
 */
export function scaleAmount(
  ingredient: { quantity?: string; unit?: string; name: string },
  factor: number
): { quantity?: string; unit?: string } {
  const value = parseAmount(ingredient.quantity);
  if (value === null || !Number.isFinite(factor) || factor <= 0) {
    return { quantity: ingredient.quantity, unit: ingredient.unit };
  }
  const rounded = roundForKitchen(value * factor, ingredient.unit, ingredient.name);
  return { quantity: formatAmount(rounded.quantity), unit: rounded.unit };
}
