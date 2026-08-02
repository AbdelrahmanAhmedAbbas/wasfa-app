export type MeasurementSystem = "metric" | "imperial";

type IngredientAmountInput = {
  quantity?: string;
  unit?: string;
  size?: string;
};

type DisplayLanguage = "en" | "ar";

const ARABIC_UNIT_LABELS: Record<string, string> = {
  g: "جم",
  gram: "جم",
  grams: "جم",
  kg: "كجم",
  ml: "مل",
  l: "لتر",
  liter: "لتر",
  liters: "لتر",
  litre: "لتر",
  litres: "لتر",
  tsp: "ملعقة صغيرة",
  teaspoon: "ملعقة صغيرة",
  teaspoons: "ملعقة صغيرة",
  tbsp: "ملعقة كبيرة",
  tablespoon: "ملعقة كبيرة",
  tablespoons: "ملعقة كبيرة",
  cup: "كوب",
  cups: "كوب",
  oz: "أونصة",
  ounce: "أونصة",
  ounces: "أونصة",
  lb: "رطل",
  lbs: "رطل",
  pound: "رطل",
  pounds: "رطل",
  slice: "شريحة",
  slices: "شرائح",
  piece: "قطعة",
  pieces: "قطع",
  whole: "حبة",
  can: "علبة",
  cans: "علب",
  pack: "عبوة",
  packs: "عبوات",
  clove: "فص",
  cloves: "فصوص",
  bunch: "حزمة",
  bunches: "حزم",
  pinch: "رشة",
  pinches: "رشات",
  dash: "قليل",
  dashes: "قليل",
  splash: "رشة",
  splashes: "رشات",
  drop: "قطرة",
  drops: "قطرات",
  handful: "حفنة",
  handfuls: "حفنات",
  stick: "عود",
  sticks: "أعواد",
  head: "رأس",
  heads: "رؤوس",
  sprig: "غصن",
  sprigs: "أغصان",
  leaf: "ورقة",
  leaves: "أوراق",
};

const KNOWN_UNIT_TOKENS = new Set<string>([
  ...Object.keys(ARABIC_UNIT_LABELS),
  ...Object.values(ARABIC_UNIT_LABELS),
  "ملعقة",
  "ملاعق",
  "صغيرة",
  "كبيرة",
  "حبات",
  "حبة",
]);

export function getLocalizedUnitLabel(unit: string | undefined, language: DisplayLanguage): string {
  const trimmed = unit?.trim();
  if (!trimmed) return "";
  if (language !== "ar") return trimmed;
  const key = trimmed.toLowerCase();
  return ARABIC_UNIT_LABELS[key] ?? trimmed;
}

export function cleanLocalizedIngredientName(rawName: string, quantity?: string): string {
  if (!rawName) return rawName;
  let out = rawName.trim();
  // Remove parentheticals containing digits (e.g. "(1135 جرام)" / "(335g)")
  out = out.replace(/\s*\([^)]*\d[^)]*\)/g, "").replace(/\s{2,}/g, " ").trim();
  // Strip leading "<digits> <unit-tokens>" prefix (up to 3 unit words)
  const leadingNumeric = out.match(/^([\d./,]+)\s+/);
  if (leadingNumeric) {
    const rest = out.slice(leadingNumeric[0].length).trimStart();
    const tokens = rest.split(/\s+/);
    let dropCount = 0;
    for (let i = 0; i < Math.min(3, tokens.length); i++) {
      const lower = tokens[i].toLowerCase();
      if (KNOWN_UNIT_TOKENS.has(lower) || KNOWN_UNIT_TOKENS.has(tokens[i])) {
        dropCount = i + 1;
      } else if (dropCount > 0) {
        break;
      } else {
        break;
      }
    }
    if (dropCount > 0) {
      const remainder = tokens.slice(dropCount).join(" ").trim();
      if (remainder.length > 0) return remainder;
    }
  }
  return out;
}

const COUNT_UNITS = new Set([
  "slice",
  "slices",
  "piece",
  "pieces",
  "whole",
  "can",
  "cans",
  "pack",
  "packs",
  "clove",
  "cloves",
  "bunch",
  "bunches",
]);

const TO_IMPERIAL: Record<string, { unit: string; factor: number }> = {
  ml: { unit: "cup", factor: 1 / 240 },
  l: { unit: "cup", factor: 1000 / 240 },
  g: { unit: "oz", factor: 1 / 28.3495 },
  kg: { unit: "lb", factor: 2.20462 },
};

const TO_METRIC: Record<string, { unit: string; factor: number }> = {
  cup: { unit: "ml", factor: 240 },
  cups: { unit: "ml", factor: 240 },
  oz: { unit: "g", factor: 28.3495 },
  ounce: { unit: "g", factor: 28.3495 },
  ounces: { unit: "g", factor: 28.3495 },
  lb: { unit: "kg", factor: 0.453592 },
  lbs: { unit: "kg", factor: 0.453592 },
  pound: { unit: "kg", factor: 0.453592 },
  pounds: { unit: "kg", factor: 0.453592 },
  "fl-oz": { unit: "ml", factor: 29.5735 },
  "fl oz": { unit: "ml", factor: 29.5735 },
};

function parseQuantity(value?: string) {
  if (!value) return null;
  const parts = value.trim().split(/\s+/);
  let total = 0;
  for (const part of parts) {
    if (part.includes("/")) {
      const [numerator, denominator] = part.split("/").map(Number);
      if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
      total += numerator / denominator;
      continue;
    }
    const parsed = Number(part);
    if (!Number.isFinite(parsed)) return null;
    total += parsed;
  }
  return total > 0 ? total : null;
}

function formatQuantity(value: number) {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
}

function normalizeUnit(unit?: string) {
  return unit?.trim().toLowerCase();
}

export function isCountBasedUnit(unit?: string) {
  const normalized = normalizeUnit(unit);
  return normalized ? COUNT_UNITS.has(normalized) : false;
}

export function convertIngredientAmount(
  item: IngredientAmountInput,
  system: MeasurementSystem | null
): { quantity?: string; unit?: string } {
  const quantity = item.quantity?.trim();
  const unit = item.unit?.trim();
  const normalizedUnit = normalizeUnit(unit);
  if (!system || !quantity || !unit || !normalizedUnit || isCountBasedUnit(normalizedUnit)) {
    return { quantity, unit: unit || item.size };
  }

  const numericQuantity = parseQuantity(quantity);
  if (!numericQuantity) return { quantity, unit };

  const conversion = system === "imperial" ? TO_IMPERIAL[normalizedUnit] : TO_METRIC[normalizedUnit];
  if (!conversion) return { quantity, unit };

  return {
    quantity: formatQuantity(numericQuantity * conversion.factor),
    unit: conversion.unit,
  };
}

export function convertTemperature(
  value: number,
  fromUnit: "C" | "F",
  toSystem: MeasurementSystem | null
) {
  const targetUnit = toSystem === "imperial" ? "F" : toSystem === "metric" ? "C" : fromUnit;
  if (fromUnit === targetUnit) return { value: Math.round(value), unit: fromUnit };
  return {
    value: Math.round(fromUnit === "C" ? value * 9 / 5 + 32 : (value - 32) * 5 / 9),
    unit: targetUnit,
  };
}
