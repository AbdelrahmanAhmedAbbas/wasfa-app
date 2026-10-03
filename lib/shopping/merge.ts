// Pure grocery-list merging. Kept free of React Native imports so it runs under
// `node --test`. The same ingredient coming from several recipes becomes one
// row whose amounts are added together.

import { normalizeForMatch } from "../recipes/ingredient-matching.ts";
import { getLocalizedUnitLabel } from "../recipes/units.ts";

type UnitDefinition = {
  unit: string;
  /** Units of one family convert into each other and are added together. */
  family: string;
  /** How many of the family's smallest unit one of this unit is. */
  factor: number;
  aliases: string[];
};

const UNIT_DEFINITIONS: UnitDefinition[] = [
  { unit: "g", family: "mass", factor: 1, aliases: ["g", "gm", "gr", "gram", "grams", "جم", "غ", "غم", "جرام", "غرام", "جرامات", "غرامات"] },
  { unit: "kg", family: "mass", factor: 1000, aliases: ["kg", "kilo", "kilos", "kilogram", "kilograms", "كجم", "كغ", "كغم", "كيلو", "كيلوجرام", "كيلوغرام"] },
  { unit: "ml", family: "volume", factor: 1, aliases: ["ml", "milliliter", "milliliters", "millilitre", "millilitres", "مل", "ملل", "مليلتر", "ملليلتر"] },
  { unit: "l", family: "volume", factor: 1000, aliases: ["l", "liter", "liters", "litre", "litres", "لتر", "ليتر"] },
  { unit: "oz", family: "imperial", factor: 1, aliases: ["oz", "ounce", "ounces", "أونصة", "أوقية"] },
  { unit: "lb", family: "imperial", factor: 16, aliases: ["lb", "lbs", "pound", "pounds", "رطل"] },
  { unit: "tsp", family: "tsp", factor: 1, aliases: ["tsp", "teaspoon", "teaspoons", "ملعقة صغيرة", "ملاعق صغيرة", "معلقة صغيرة"] },
  { unit: "tbsp", family: "tbsp", factor: 1, aliases: ["tbsp", "tablespoon", "tablespoons", "ملعقة كبيرة", "ملاعق كبيرة", "معلقة كبيرة"] },
  { unit: "cup", family: "cup", factor: 1, aliases: ["cup", "cups", "كوب", "أكواب", "كأس", "كاسة"] },
  { unit: "clove", family: "clove", factor: 1, aliases: ["clove", "cloves", "فص", "فصوص"] },
  { unit: "piece", family: "piece", factor: 1, aliases: ["piece", "pieces", "pc", "pcs", "قطعة", "قطع"] },
  { unit: "whole", family: "whole", factor: 1, aliases: ["whole", "حبة", "حبات"] },
  { unit: "slice", family: "slice", factor: 1, aliases: ["slice", "slices", "شريحة", "شرائح"] },
  { unit: "can", family: "can", factor: 1, aliases: ["can", "cans", "علبة", "علب"] },
  { unit: "pack", family: "pack", factor: 1, aliases: ["pack", "packs", "packet", "packets", "package", "packages", "عبوة", "عبوات", "كيس"] },
  { unit: "bunch", family: "bunch", factor: 1, aliases: ["bunch", "bunches", "حزمة", "حزم", "ربطة"] },
  { unit: "pinch", family: "pinch", factor: 1, aliases: ["pinch", "pinches", "رشة", "رشات"] },
  { unit: "handful", family: "handful", factor: 1, aliases: ["handful", "handfuls", "حفنة", "حفنات"] },
  { unit: "stick", family: "stick", factor: 1, aliases: ["stick", "sticks", "عود", "أعواد"] },
  { unit: "head", family: "head", factor: 1, aliases: ["head", "heads", "رأس", "رؤوس"] },
  { unit: "sprig", family: "sprig", factor: 1, aliases: ["sprig", "sprigs", "غصن", "أغصان"] },
  { unit: "leaf", family: "leaf", factor: 1, aliases: ["leaf", "leaves", "ورقة", "أوراق"] },
];

const ENGLISH_PLURALS: Record<string, string> = {
  cup: "cups",
  clove: "cloves",
  piece: "pieces",
  slice: "slices",
  can: "cans",
  pack: "packs",
  bunch: "bunches",
  pinch: "pinches",
  handful: "handfuls",
  stick: "sticks",
  head: "heads",
  sprig: "sprigs",
  leaf: "leaves",
};

/** The family's units from largest to smallest, for writing a total back out. */
const FAMILY_UNITS = new Map<string, UnitDefinition[]>();
const UNIT_BY_ALIAS = new Map<string, UnitDefinition>();

function normalizeToken(value: string): string {
  return normalizeForMatch(value).trim();
}

for (const definition of UNIT_DEFINITIONS) {
  const family = FAMILY_UNITS.get(definition.family) ?? [];
  family.push(definition);
  family.sort((a, b) => b.factor - a.factor);
  FAMILY_UNITS.set(definition.family, family);
  for (const alias of definition.aliases) UNIT_BY_ALIAS.set(normalizeToken(alias), definition);
}

const UNICODE_FRACTIONS: Record<string, string> = {
  "½": "1/2",
  "⅓": "1/3",
  "⅔": "2/3",
  "¼": "1/4",
  "¾": "3/4",
  "⅛": "1/8",
};

const AMOUNT_PATTERN =
  /^(?:(\d+)\s+(\d+)\s*\/\s*(\d+)|(\d+)\s*\/\s*(\d+)|(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?)\s*/;

const ARABIC_SCRIPT = /[؀-ۿ]/;

/** Western digits and plain fractions, so one pattern reads every way an amount is written. */
function toPlainNumbers(text: string): string {
  return text
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/٫/g, ".")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[½⅓⅔¼¾⅛]/g, (fraction) => ` ${UNICODE_FRACTIONS[fraction]}`)
    .trim();
}

function readAmount(text: string): { amount: number; rest: string } | null {
  const match = text.match(AMOUNT_PATTERN);
  if (!match) return null;

  let amount: number;
  if (match[1]) amount = Number(match[1]) + Number(match[2]) / Number(match[3]);
  else if (match[4]) amount = Number(match[4]) / Number(match[5]);
  // "2-3 onions": buy enough for the larger number.
  else amount = Math.max(Number(match[6]), Number(match[7] ?? 0));

  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, rest: text.slice(match[0].length) };
}

/** One word of an ingredient name, reduced so plural and "ال" forms match. */
function nameKeyToken(token: string): string {
  if (ARABIC_SCRIPT.test(token)) {
    return token.length > 4 && token.startsWith("ال") ? token.slice(2) : token;
  }
  if (token.length <= 3 || token.endsWith("ss")) return token;
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.endsWith("oes")) return token.slice(0, -2);
  return token.endsWith("s") ? token.slice(0, -1) : token;
}

export type ParsedShoppingText = {
  amount: number | null;
  unit: UnitDefinition | null;
  /** The ingredient name as written, without amount, unit or notes. */
  name: string;
  /** What two rows must share to be the same ingredient. */
  key: string;
};

export function parseShoppingText(text: string): ParsedShoppingText {
  // Notes in brackets ("(finely chopped)") describe the ingredient, not what to buy.
  const cleaned = toPlainNumbers(text.replace(/\([^)]*\)/g, " ")).replace(/\s+/g, " ");
  const read = readAmount(cleaned);

  let words = (read ? read.rest : cleaned).split(" ").filter(Boolean);
  let unit: UnitDefinition | null = null;

  if (read) {
    const twoWords = words.length > 2 ? UNIT_BY_ALIAS.get(normalizeToken(words.slice(0, 2).join(" "))) : undefined;
    const oneWord = words.length > 1 ? UNIT_BY_ALIAS.get(normalizeToken(words[0])) : undefined;
    if (twoWords) {
      unit = twoWords;
      words = words.slice(2);
    } else if (oneWord) {
      unit = oneWord;
      words = words.slice(1);
    }
    if (unit && words.length > 1 && ["of", "من"].includes(normalizeToken(words[0]))) words = words.slice(1);
  }

  const name = words.join(" ").replace(/[\s,،.;:-]+$/, "").trim() || text.trim();
  const key = normalizeToken(name).split(" ").filter(Boolean).map(nameKeyToken).join(" ") || name.toLowerCase();

  return { amount: read?.amount ?? null, unit, name, key };
}

function formatAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function formatFamilyTotal(family: string, total: number, language: "en" | "ar"): string {
  if (family === "count") return formatAmount(total);

  // The largest unit that keeps the number at one or more: 1500 g reads as 1.5 kg.
  const units = FAMILY_UNITS.get(family) ?? [];
  const definition = units.find((candidate) => total >= candidate.factor) ?? units[units.length - 1];
  const amount = total / definition.factor;
  const label = amount > 1 ? ENGLISH_PLURALS[definition.unit] ?? definition.unit : definition.unit;
  return `${formatAmount(amount)} ${getLocalizedUnitLabel(label, language)}`;
}

export type MergedShoppingGroup<T> = {
  key: string;
  /** The row's text: the single item as written, or the summed amounts and the name. */
  text: string;
  name: string;
  items: T[];
};

/**
 * Groups shopping items by ingredient and adds their amounts. Amounts in units
 * that convert (g and kg, ml and l, oz and lb) become one number; amounts that
 * do not ("2 cups" and "500 g" of rice) are listed side by side on the one row.
 */
export function mergeShoppingItems<T extends { ingredient_text: string }>(
  items: T[]
): MergedShoppingGroup<T>[] {
  type Group = { name: string; items: T[]; totals: Map<string, number> };
  const groups = new Map<string, Group>();

  for (const item of items) {
    const parsed = parseShoppingText(item.ingredient_text);
    const group: Group = groups.get(parsed.key) ?? { name: parsed.name, items: [], totals: new Map() };
    groups.set(parsed.key, group);
    group.items.push(item);

    if (parsed.amount === null) continue;
    const family = parsed.unit?.family ?? "count";
    const inSmallestUnit = parsed.amount * (parsed.unit?.factor ?? 1);
    group.totals.set(family, (group.totals.get(family) ?? 0) + inSmallestUnit);
  }

  return Array.from(groups, ([key, group]) => {
    if (group.items.length === 1) {
      return { key, text: group.items[0].ingredient_text, name: group.name, items: group.items };
    }

    const language = ARABIC_SCRIPT.test(group.name) ? "ar" : "en";
    const amounts = Array.from(group.totals, ([family, total]) => formatFamilyTotal(family, total, language));
    const text = amounts.length > 0 ? `${amounts.join(" + ")} ${group.name}` : group.name;
    return { key, text, name: group.name, items: group.items };
  });
}

/** How many merged rows still have something to buy. */
export function countItemsToBuy(items: Array<{ ingredient_text: string; checked: boolean }>): number {
  return mergeShoppingItems(items).filter((group) => !group.items.every((item) => item.checked)).length;
}
