// Pure grocery-list merging. Kept free of React Native imports so it runs under
// `node --test`. A saved line is read back as an amount, a unit and the thing to
// buy; the same ingredient coming from several recipes becomes one row whose
// amounts are added together.

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
  { unit: "tsp", family: "tsp", factor: 1, aliases: ["tsp", "tsps", "teaspoon", "teaspoons", "ملعقة صغيرة", "ملاعق صغيرة", "معلقة صغيرة"] },
  { unit: "tbsp", family: "tbsp", factor: 1, aliases: ["tbsp", "tbsps", "tbs", "tablespoon", "tablespoons", "ملعقة كبيرة", "ملاعق كبيرة", "معلقة كبيرة"] },
  { unit: "cup", family: "cup", factor: 1, aliases: ["cup", "cups", "كوب", "أكواب", "كأس", "كاسة"] },
  { unit: "clove", family: "clove", factor: 1, aliases: ["clove", "cloves", "فص", "فصوص"] },
  { unit: "piece", family: "piece", factor: 1, aliases: ["piece", "pieces", "pc", "pcs", "قطعة", "قطع"] },
  { unit: "whole", family: "whole", factor: 1, aliases: ["whole", "حبة", "حبات"] },
  { unit: "slice", family: "slice", factor: 1, aliases: ["slice", "slices", "شريحة", "شرائح"] },
  { unit: "can", family: "can", factor: 1, aliases: ["can", "cans", "tin", "tins", "علبة", "علب"] },
  { unit: "pack", family: "pack", factor: 1, aliases: ["pack", "packs", "packet", "packets", "package", "packages", "عبوة", "عبوات", "كيس"] },
  { unit: "bunch", family: "bunch", factor: 1, aliases: ["bunch", "bunches", "حزمة", "حزم", "ربطة"] },
  { unit: "pinch", family: "pinch", factor: 1, aliases: ["pinch", "pinches", "رشة", "رشات"] },
  { unit: "dash", family: "dash", factor: 1, aliases: ["dash", "dashes"] },
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
  dash: "dashes",
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

/** Normalized word lists, matched against the start or end of a name. */
function phrases(list: string[]): string[][] {
  return list.map((phrase) => normalizeToken(phrase).split(" "));
}

// Amounts written as words. "a" and "an" only count when a unit follows ("a pinch of salt").
const WORD_AMOUNTS = new Map<string, number>(
  Object.entries({
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5,
    "واحد": 1, "واحدة": 1, "اثنين": 2, "اثنان": 2, "ثلاث": 3, "ثلاثة": 3,
    "أربع": 4, "أربعة": 4, "خمس": 5, "خمسة": 5, "نصف": 0.5, "نص": 0.5, "ربع": 0.25, "ثلث": 1 / 3,
  }).map(([word, amount]) => [normalizeToken(word), amount])
);
const ARTICLES = new Set(["a", "an"]);

// Words that say how much without a number, or what the ingredient is for. They are
// not part of what to buy, wherever the recipe put them.
const NOT_TO_BUY = phrases([
  "to taste", "or to taste", "as needed", "as required", "if needed", "optional", "divided",
  "for garnish", "for garnishing", "for serving", "for decoration", "for frying", "for greasing",
  "some", "a little", "a few", "a bit of",
  "حسب الرغبة", "حسب الذوق", "حسب الحاجة", "حسب الطلب", "اختياري", "للتزيين", "للزينة", "للتقديم",
  "للقلي", "للدهن", "قليل من", "قليل", "بعض", "كمية قليلة من", "كمية قليلة",
]);

// Words that describe the size or the cut of an ingredient but not a different thing
// to buy. They are left out of the matching key so "2 large eggs" and "3 eggs" add up.
// Cuts that are their own product ("crushed tomatoes") are kept, and so is minced
// meat ("لحم مفروم"), which is bought minced, unlike minced garlic or onion.
const MINCED = new Set(["مفروم", "مفرومة"].map(normalizeToken));
const MEAT = new Set(["لحم", "لحمة", "اللحم"].map(normalizeToken));
const KEY_IGNORED_WORDS = new Set(
  [
    "large", "medium", "small", "big", "fresh", "chopped", "finely", "roughly", "coarsely", "thinly",
    "diced", "sliced", "cubed", "peeled", "halved", "quartered", "washed", "rinsed", "trimmed",
    "كبيرة", "كبير", "متوسطة", "متوسط", "صغيرة", "صغير", "طازج", "طازجة", "مقطع", "مقطعة", "مكعبات",
    "مغسول", "مغسولة", "مقشر", "مقشرة",
  ].map(normalizeToken)
);

// A clause after one of these is a description or a cooking step, not what to buy:
// "chicken breast, cut into cubes", "rice - washed and soaked".
const CLAUSE_BREAK = /\s*[,،;؛:]\s*|\s+[-–—]\s+/;

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

/** The unit at the start of `words`, in one or two words, and how many words it took. */
function readUnit(words: string[]): { unit: UnitDefinition; length: number } | null {
  const twoWords = words.length > 2 ? UNIT_BY_ALIAS.get(normalizeToken(words.slice(0, 2).join(" "))) : undefined;
  if (twoWords) return { unit: twoWords, length: 2 };
  const oneWord = words.length > 1 ? UNIT_BY_ALIAS.get(normalizeToken(words[0])) : undefined;
  return oneWord ? { unit: oneWord, length: 1 } : null;
}

function startsWith(words: string[], phrase: string[]): boolean {
  return phrase.length <= words.length && phrase.every((word, index) => normalizeToken(words[index]) === word);
}

function endsWith(words: string[], phrase: string[]): boolean {
  const offset = words.length - phrase.length;
  return offset >= 0 && phrase.every((word, index) => normalizeToken(words[offset + index]) === word);
}

/** Takes the not-to-buy words off both ends of a name, however many there are. */
function trimNotToBuy(words: string[]): string[] {
  let trimmed = words;
  for (let changed = true; changed && trimmed.length > 0; ) {
    changed = false;
    for (const phrase of NOT_TO_BUY) {
      if (startsWith(trimmed, phrase)) trimmed = trimmed.slice(phrase.length);
      else if (endsWith(trimmed, phrase)) trimmed = trimmed.slice(0, trimmed.length - phrase.length);
      else continue;
      changed = true;
      break;
    }
  }
  return trimmed;
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
  /** What to buy, without amount, unit, notes or description. */
  name: string;
  /** What two rows must share to be the same ingredient. */
  key: string;
};

export function parseShoppingText(text: string): ParsedShoppingText {
  // Notes in brackets ("(finely chopped)") describe the ingredient, not what to buy;
  // an unclosed bracket runs to the end of the line.
  const cleaned = toPlainNumbers(text.replace(/\([^)]*\)?/g, " ").replace(/\[[^\]]*\]?/g, " ")).replace(/\s+/g, " ");
  let amount: number | null = null;
  let unit: UnitDefinition | null = null;

  const read = readAmount(cleaned);
  let rest = read ? read.rest : cleaned;
  if (read) amount = read.amount;

  let words = trimNotToBuy(rest.split(" ").filter(Boolean));
  if (amount === null && words.length > 1) {
    const word = normalizeToken(words[0]);
    const spelled = WORD_AMOUNTS.get(word);
    if (spelled !== undefined) {
      amount = spelled;
      words = words.slice(1);
      // "half a cup", "نصف كوب"
      if (words.length > 1 && ARTICLES.has(normalizeToken(words[0]))) words = words.slice(1);
    } else if (ARTICLES.has(word) && readUnit(words.slice(1))) {
      amount = 1;
      words = words.slice(1);
    }
  }

  const leadingUnit = readUnit(words);
  if (leadingUnit) {
    unit = leadingUnit.unit;
    // "pinch salt", "رشة ملح": a unit with no number is one of it.
    amount ??= 1;
    words = words.slice(leadingUnit.length);
    if (words.length > 1 && ["of", "من"].includes(normalizeToken(words[0]))) words = words.slice(1);
  }

  // The first clause that names something to buy; the rest is description or method.
  rest = words.join(" ");
  let nameWords: string[] = [];
  for (const clause of rest.split(CLAUSE_BREAK)) {
    nameWords = trimNotToBuy(clause.split(" ").filter(Boolean));
    if (nameWords.length > 0) break;
  }

  const name = nameWords.join(" ").replace(/[\s.\-–—]+$/, "").trim() || text.trim();
  const tokens = normalizeToken(name).split(" ").filter(Boolean);
  const isMeat = tokens.some((token) => MEAT.has(token));
  const kept = tokens.filter((token) => !KEY_IGNORED_WORDS.has(token) && (isMeat || !MINCED.has(token)));
  const key = (kept.length > 0 ? kept : tokens).map(nameKeyToken).join(" ") || name.toLowerCase();

  return { amount, unit, name, key };
}

const FRACTION_GLYPHS: Array<[number, string]> = [
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
];

/** A kitchen amount as people write it: "1½", "⅓", "250", "1.25". */
function formatAmount(value: number, unit: string | null): string {
  if (unit === "g" || unit === "ml") return String(value < 10 ? Math.round(value * 10) / 10 : Math.round(value));
  if (unit === "kg" || unit === "l") return String(Math.round(value * 100) / 100);

  const whole = Math.floor(value);
  const part = value - whole;
  if (part < 0.04) return String(whole);
  if (part > 0.96) return String(whole + 1);
  const glyph = FRACTION_GLYPHS.find(([fraction]) => Math.abs(part - fraction) < 0.04)?.[1];
  if (glyph) return whole > 0 ? `${whole}${glyph}` : glyph;
  return String(Math.round(value * 100) / 100);
}

function formatFamilyTotal(family: string, total: number, language: "en" | "ar"): string {
  if (family === "count") return formatAmount(total, null);

  // The largest unit that keeps the number at one or more: 1500 g reads as 1.5 kg.
  const units = FAMILY_UNITS.get(family) ?? [];
  const definition = units.find((candidate) => total >= candidate.factor) ?? units[units.length - 1];
  const amount = total / definition.factor;
  const label = amount > 1 ? ENGLISH_PLURALS[definition.unit] ?? definition.unit : definition.unit;
  return `${formatAmount(amount, definition.unit)} ${getLocalizedUnitLabel(label, language)}`;
}

// Counted on their own ("2 garlic" is two bulbs) but never written in the plural.
const UNCOUNTABLE = new Set([
  "rice", "garlic", "salt", "pepper", "flour", "sugar", "water", "milk", "oil", "butter", "cheese", "bread",
  "meat", "chicken", "beef", "lamb", "fish", "lettuce", "parsley", "cilantro", "coriander", "dill", "mint",
  "spinach", "broccoli", "celery", "cabbage", "cauliflower", "ginger", "honey", "yogurt", "cream", "pasta", "corn",
]);

/** "onion" to "onions" for a counted English ingredient; Arabic names are left as written. */
function pluralizeEnglish(name: string): string {
  const last = name.split(" ").pop()?.toLowerCase() ?? "";
  if (ARABIC_SCRIPT.test(name) || /s$/i.test(name) || UNCOUNTABLE.has(last)) return name;
  if (/[^aeiou]y$/i.test(name)) return `${name.slice(0, -1)}ies`;
  if (/(ch|sh|x|z)$/i.test(name) || /(tomato|potato)$/i.test(name)) return `${name}es`;
  return `${name}s`;
}

export type MergedShoppingGroup<T> = {
  key: string;
  /** What to buy, without amounts: "onions", "basmati rice". */
  name: string;
  /** The added-up amounts, or "" when no recipe gave one: "3", "1½ cups", "2 cups + 500 g". */
  amount: string;
  /** The amount and the name together, as one line. */
  text: string;
  items: T[];
};

type MergeOptions<T> = {
  /** How many times each item's recipe is planned; its amount counts that many times. */
  timesPlanned?: (item: T) => number;
};

/**
 * Groups shopping items by ingredient and adds their amounts. Amounts in units
 * that convert (g and kg, ml and l, oz and lb) become one number; amounts that
 * do not ("2 cups" and "500 g" of rice) are listed side by side on the one row.
 */
export function mergeShoppingItems<T extends { ingredient_text: string }>(
  items: T[],
  options: MergeOptions<T> = {}
): MergedShoppingGroup<T>[] {
  type Group = { names: Array<{ name: string; amount: number | null }>; items: T[]; totals: Map<string, number> };
  const groups = new Map<string, Group>();

  for (const item of items) {
    const parsed = parseShoppingText(item.ingredient_text);
    const group: Group = groups.get(parsed.key) ?? { names: [], items: [], totals: new Map() };
    groups.set(parsed.key, group);
    group.items.push(item);
    group.names.push({ name: parsed.name, amount: parsed.amount });

    if (parsed.amount === null) continue;
    const times = Math.max(1, options.timesPlanned?.(item) ?? 1);
    const family = parsed.unit?.family ?? "count";
    const inSmallestUnit = parsed.amount * (parsed.unit?.factor ?? 1) * times;
    group.totals.set(family, (group.totals.get(family) ?? 0) + inSmallestUnit);
  }

  return Array.from(groups, ([key, group]) => {
    const counted = group.totals.get("count") ?? 0;
    // The plainest way the recipes wrote it: "eggs" over "large eggs".
    const plainest = [...group.names].sort((a, b) => a.name.length - b.name.length)[0].name;
    const written = counted > 1 ? pluralizeEnglish(plainest) : plainest;
    const name = written.charAt(0).toUpperCase() + written.slice(1);
    const language = ARABIC_SCRIPT.test(name) ? "ar" : "en";
    const amount = Array.from(group.totals, ([family, total]) => formatFamilyTotal(family, total, language)).join(" + ");
    return { key, name, amount, text: amount ? `${amount} ${name}` : name, items: group.items };
  });
}

/** How many merged rows still have something to buy. */
export function countItemsToBuy(items: Array<{ ingredient_text: string; checked: boolean }>): number {
  return mergeShoppingItems(items).filter((group) => !group.items.every((item) => item.checked)).length;
}
