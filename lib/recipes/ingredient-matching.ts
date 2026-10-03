import type { AllergyOption, DislikeOption } from "../onboarding/answers";

// Keyword matching for ingredient names, in English and Arabic. It backs up the
// tags the import AI writes, so a recipe is still flagged when a tag is missing.

type KeywordRule = {
  keywords: string[];
  /** Phrases that contain a keyword but mean something else ("coconut milk"). */
  excludes?: string[];
  /** When one of these appears, the whole ingredient is skipped ("gluten free"). */
  negators?: string[];
};

type CompiledRule = {
  keywords: RegExp[];
  excludes: RegExp[];
  negators: RegExp[];
};

const ARABIC_LETTER = /[ء-ي]/;

/**
 * Lowercases, strips accents and Arabic vowel marks, unifies Arabic letter
 * variants, and pads with spaces so patterns can anchor on word edges.
 */
export function normalizeForMatch(text: string): string {
  const cleaned = text
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .toLowerCase()
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^a-z0-9ء-ي]+/g, " ")
    .trim();
  return ` ${cleaned} `;
}

function buildPattern(keyword: string, flags = ""): RegExp | null {
  const words = normalizeForMatch(keyword).trim().split(" ").filter(Boolean);
  if (words.length === 0) return null;

  if (ARABIC_LETTER.test(words[0])) {
    // Arabic words pick up joined prefixes (و، ب، ال) and a few endings.
    const body = words
      .map((word, index) => `${index === 0 ? "(?:و|ب|ل|ف)?" : ""}(?:ال|لل)?${word}`)
      .join(" ");
    return new RegExp(` ${body}(?:ات|ه|ي|ين)?(?= )`, flags);
  }

  return new RegExp(` ${words.join(" ")}(?:s|es)?(?= )`, flags);
}

function compilePatterns(keywords: string[] | undefined, flags = ""): RegExp[] {
  return (keywords ?? [])
    .map((keyword) => buildPattern(keyword, flags))
    .filter((pattern): pattern is RegExp => pattern !== null);
}

function compileRule(rule: KeywordRule): CompiledRule {
  return {
    keywords: compilePatterns(rule.keywords),
    excludes: compilePatterns(rule.excludes, "g"),
    negators: compilePatterns(rule.negators),
  };
}

function matchesRule(normalizedText: string, rule: CompiledRule): boolean {
  if (rule.negators.some((pattern) => pattern.test(normalizedText))) return false;

  let text = normalizedText;
  for (const pattern of rule.excludes) {
    text = text.replace(pattern, " ");
  }

  return rule.keywords.some((pattern) => pattern.test(text));
}

const GLUTEN_FREE = ["gluten free", "خالي من الغلوتين", "خالي من الجلوتين", "خال من الغلوتين"];

const WHEAT_KEYWORDS = [
  "flour", "wheat", "bread", "breadcrumb", "bread crumb", "panko", "pasta", "spaghetti", "macaroni",
  "lasagna", "lasagne", "noodle", "vermicelli", "couscous", "bulgur", "semolina", "freekeh", "farro",
  "tortilla", "pita", "dough", "puff pastry", "phyllo", "filo", "cracker", "seitan", "toast",
  "طحين", "دقيق", "قمح", "خبز", "توست", "معكرونه", "مكرونه", "باستا", "سباغيتي", "اسباغيتي",
  "لازانيا", "نودلز", "شعيريه", "برغل", "سميد", "كسكس", "بقسماط", "فريكه", "عجين", "تورتيلا",
];

const WHEAT_EXCLUDES = [
  "rice flour", "almond flour", "corn flour", "coconut flour", "chickpea flour", "oat flour",
  "tapioca flour", "rice noodle", "glass noodle", "corn tortilla",
  "دقيق الارز", "دقيق اللوز", "دقيق الذره", "دقيق جوز الهند", "دقيق الحمص", "دقيق الشوفان",
  "طحين الارز", "طحين اللوز", "طحين الذره", "طحين الحمص", "نودلز الارز",
];

const SHELLFISH_KEYWORDS = [
  "shrimp", "prawn", "crab", "lobster", "crayfish", "crawfish", "clam", "mussel", "oyster", "scallop",
  "squid", "calamari", "octopus", "langoustine", "shellfish",
  "روبيان", "ربيان", "جمبري", "قريدس", "سلطعون", "كابوريا", "قبقب", "استاكوزا", "لوبستر", "كركند",
  "محار", "بلح البحر", "حبار", "كاليماري", "اخطبوط", "سكالوب",
];

const FISH_KEYWORDS = [
  "fish", "salmon", "tuna", "cod", "tilapia", "sardine", "anchovy", "anchovies", "mackerel", "trout",
  "halibut", "sea bass", "seabass", "sea bream", "snapper", "hammour", "grouper", "haddock", "herring",
  "kingfish", "caviar", "seafood",
  "سمك", "اسماك", "سلمون", "تونه", "تونا", "هامور", "سردين", "انشوجه", "انشوفي", "ماكريل", "بلطي",
  "كنعد", "شعري", "ثمار البحر", "ماكولات بحريه",
];

const ALLERGEN_RULES: Record<AllergyOption, CompiledRule> = {
  dairy: compileRule({
    keywords: [
      "milk", "butter", "cheese", "cream", "yogurt", "yoghurt", "ghee", "labneh", "halloumi",
      "mozzarella", "parmesan", "cheddar", "feta", "ricotta", "mascarpone", "paneer", "whey",
      "buttermilk", "custard", "kefir", "kashta",
      "حليب", "زبده", "جبن", "قشطه", "كريمه", "لبن", "زبادي", "روب", "سمن", "حلوم", "موزاريلا",
      "بارميزان", "شيدر", "ريكوتا", "ماسكاربوني",
    ],
    excludes: [
      "coconut milk", "almond milk", "oat milk", "soy milk", "rice milk", "coconut cream",
      "cream of tartar", "peanut butter", "almond butter", "cocoa butter", "nut butter", "apple butter",
      "butter bean", "butter lettuce",
      "حليب جوز الهند", "حليب اللوز", "حليب الشوفان", "حليب الصويا", "كريمه جوز الهند",
      "زبده الفول السوداني", "زبده اللوز", "زبده الكاكاو", "سمن نباتي",
    ],
  }),
  egg: compileRule({
    keywords: ["egg", "mayonnaise", "mayo", "meringue", "aioli", "بيض", "مايونيز"],
  }),
  gluten: compileRule({
    keywords: [...WHEAT_KEYWORDS, "barley", "rye", "malt", "soy sauce", "شعير", "صلصه الصويا", "صويا صوص"],
    excludes: WHEAT_EXCLUDES,
    negators: GLUTEN_FREE,
  }),
  wheat: compileRule({
    keywords: WHEAT_KEYWORDS,
    excludes: WHEAT_EXCLUDES,
    negators: GLUTEN_FREE,
  }),
  peanut: compileRule({
    keywords: ["peanut", "groundnut", "فول سوداني", "فستق سوداني", "فستق عبيد"],
  }),
  tree_nut: compileRule({
    keywords: [
      "almond", "walnut", "cashew", "pistachio", "hazelnut", "pecan", "macadamia", "chestnut",
      "pine nut", "brazil nut", "nut", "marzipan", "praline",
      "لوز", "جوز", "عين الجمل", "كاجو", "فستق", "بندق", "صنوبر", "مكسرات", "بيكان", "كستناء",
    ],
    excludes: [
      "water chestnut", "جوز الهند", "جوزه الطيب", "جوز الطيب", "فستق سوداني", "فستق عبيد",
    ],
  }),
  shellfish: compileRule({
    keywords: SHELLFISH_KEYWORDS,
    excludes: ["oyster mushroom", "فطر المحار"],
  }),
  seafood: compileRule({
    keywords: [...FISH_KEYWORDS, ...SHELLFISH_KEYWORDS],
    excludes: ["oyster mushroom", "فطر المحار"],
  }),
};

// What the import AI may write in `allergen_hints`, mapped to our allergy ids.
const ALLERGEN_HINT_ALIASES: Record<string, AllergyOption> = {
  dairy: "dairy",
  milk: "dairy",
  lactose: "dairy",
  egg: "egg",
  eggs: "egg",
  gluten: "gluten",
  wheat: "wheat",
  peanut: "peanut",
  peanuts: "peanut",
  tree_nut: "tree_nut",
  tree_nuts: "tree_nut",
  treenut: "tree_nut",
  treenuts: "tree_nut",
  nut: "tree_nut",
  nuts: "tree_nut",
  seafood: "seafood",
  fish: "seafood",
  shellfish: "shellfish",
  crustacean: "shellfish",
  crustaceans: "shellfish",
  mollusc: "shellfish",
  molluscs: "shellfish",
  mollusk: "shellfish",
  mollusks: "shellfish",
};

/**
 * Every allergen an ingredient contains, from its AI tags and its names.
 * `names` holds the ingredient name in each language we have it in.
 */
export function detectAllergens(names: string[], hints: string[] = []): Set<AllergyOption> {
  const found = new Set<AllergyOption>();

  for (const hint of hints) {
    const alias = ALLERGEN_HINT_ALIASES[hint.trim().toLowerCase().replace(/[\s-]+/g, "_")];
    if (alias) found.add(alias);
  }

  const texts = names.map(normalizeForMatch);
  for (const allergy of Object.keys(ALLERGEN_RULES) as AllergyOption[]) {
    if (texts.some((text) => matchesRule(text, ALLERGEN_RULES[allergy]))) found.add(allergy);
  }

  // Wheat always carries gluten, and shellfish is seafood.
  if (found.has("wheat")) found.add("gluten");
  if (found.has("shellfish")) found.add("seafood");

  return found;
}

const DISLIKE_RULES: Record<DislikeOption, CompiledRule> = {
  onion: compileRule({ keywords: ["onion", "shallot", "scallion", "بصل"] }),
  garlic: compileRule({ keywords: ["garlic", "ثوم"] }),
  mushroom: compileRule({ keywords: ["mushroom", "فطر", "مشروم", "عيش الغراب"] }),
  eggplant: compileRule({ keywords: ["eggplant", "aubergine", "باذنجان"] }),
  cilantro: compileRule({ keywords: ["cilantro", "coriander", "كزبره"] }),
  olives: compileRule({
    keywords: ["olive", "زيتون"],
    excludes: ["olive oil", "زيت الزيتون"],
  }),
  spicy: compileRule({
    keywords: [
      "chili", "chilli", "chile", "chilies", "chillies", "jalapeno", "cayenne", "habanero", "hot sauce",
      "hot pepper", "red pepper flake", "chili flake", "sriracha", "harissa",
      "فلفل حار", "شطه", "هريسه", "فلفل احمر حار", "صلصه حاره",
    ],
  }),
  okra: compileRule({ keywords: ["okra", "باميه", "باميا"] }),
  liver: compileRule({ keywords: ["liver", "كبد"] }),
  fish: compileRule({ keywords: FISH_KEYWORDS.filter((keyword) => keyword !== "seafood") }),
  coconut: compileRule({ keywords: ["coconut", "جوز الهند"] }),
  raisins: compileRule({ keywords: ["raisin", "sultana", "زبيب"] }),
};

/**
 * The entries of `dislikes` an ingredient matches. An entry is either one of
 * our DislikeOption ids or free text the user typed.
 */
export function detectDislikes(names: string[], dislikes: string[]): string[] {
  const texts = names.map(normalizeForMatch);

  return dislikes.filter((dislike) => {
    const rule = DISLIKE_RULES[dislike as DislikeOption];
    if (rule) return texts.some((text) => matchesRule(text, rule));

    const pattern = buildPattern(dislike);
    return pattern !== null && texts.some((text) => pattern.test(text));
  });
}

export type HalalConcernKind = "pork" | "alcohol";

type NonHalalRule = {
  kind: HalalConcernKind;
  rule: CompiledRule;
  alternative: { en: string; ar: string };
};

const PORK_NEGATORS = [
  "beef", "turkey", "chicken", "veal", "lamb", "halal", "vegan", "vegetarian", "plant based",
  "بقري", "ديك رومي", "دجاج", "حلال", "غنم", "نباتي",
];
const ALCOHOL_NEGATORS = [
  "non alcoholic", "alcohol free", "vinegar", "halal", "خالي من الكحول", "بدون كحول", "خل", "حلال",
];

function nonHalalRule(
  kind: HalalConcernKind,
  keywords: string[],
  alternative: { en: string; ar: string }
): NonHalalRule {
  return {
    kind,
    rule: compileRule({ keywords, negators: kind === "pork" ? PORK_NEGATORS : ALCOHOL_NEGATORS }),
    alternative,
  };
}

// Checked in order, so the specific cuts come before plain "pork".
const NON_HALAL_RULES: NonHalalRule[] = [
  nonHalalRule("pork", ["bacon", "بيكون"], { en: "beef bacon", ar: "لحم بقري مقدد" }),
  nonHalalRule("pork", ["ham"], { en: "smoked turkey", ar: "ديك رومي مدخن" }),
  nonHalalRule("pork", ["prosciutto", "pancetta", "guanciale"], { en: "beef bresaola", ar: "بريزاولا بقري" }),
  nonHalalRule("pork", ["chorizo", "pepperoni", "salami", "pork sausage"], {
    en: "halal beef sausage",
    ar: "سجق بقري حلال",
  }),
  nonHalalRule("pork", ["lard"], { en: "ghee or butter", ar: "سمن أو زبدة" }),
  nonHalalRule("pork", ["pork", "خنزير"], { en: "beef or lamb", ar: "لحم بقري أو غنم" }),
  nonHalalRule("alcohol", ["mirin", "ميرين"], {
    en: "rice vinegar with a pinch of sugar",
    ar: "خل أرز مع رشة سكر",
  }),
  nonHalalRule("alcohol", ["beer", "بيره"], { en: "stock or a malt drink", ar: "مرق أو شراب شعير" }),
  nonHalalRule(
    "alcohol",
    ["wine", "sherry", "marsala", "vermouth", "champagne", "sake", "نبيذ", "شمبانيا", "ساكي"],
    { en: "grape juice with a splash of vinegar", ar: "عصير عنب مع قليل من الخل" }
  ),
  nonHalalRule(
    "alcohol",
    [
      "rum", "vodka", "whiskey", "whisky", "brandy", "bourbon", "cognac", "tequila", "liqueur", "gin",
      "alcohol", "ويسكي", "فودكا", "براندي", "كحول", "خمر",
    ],
    { en: "fruit juice", ar: "عصير فواكه" }
  ),
];

/** A keyword-based guess for ingredients the import AI left untagged. */
export function detectNonHalal(
  names: string[]
): { kind: HalalConcernKind; alternative: { en: string; ar: string } } | null {
  const texts = names.map(normalizeForMatch);
  const match = NON_HALAL_RULES.find(({ rule }) => texts.some((text) => matchesRule(text, rule)));
  return match ? { kind: match.kind, alternative: match.alternative } : null;
}
