// Maps an ingredient name (English or Arabic) to a food emoji for the round
// icon tiles on ingredient and grocery rows. First matching keyword wins, so
// more specific entries come before broader ones.
const FOOD_EMOJI: Array<[emoji: string, keywords: string[]]> = [
  ["🥥", ["coconut", "جوز الهند"]],
  ["🥜", ["peanut", "فول سوداني"]],
  ["🧄", ["garlic", "ثوم"]],
  ["🧅", ["onion", "shallot", "scallion", "بصل"]],
  ["🍅", ["tomato", "طماطم", "بندورة"]],
  ["🍋", ["lemon", "lime", "ليمون"]],
  ["🌶️", ["chili", "chilli", "jalape", "cayenne", "paprika", "فلفل حار", "شطة"]],
  ["🫑", ["bell pepper", "capsicum", "فلفل رومي", "فليفلة"]],
  ["🥕", ["carrot", "جزر"]],
  ["🥔", ["potato", "بطاطس", "بطاطا"]],
  ["🍆", ["eggplant", "aubergine", "باذنجان"]],
  ["🥒", ["cucumber", "zucchini", "courgette", "خيار", "كوسا"]],
  ["🥬", ["kale", "spinach", "lettuce", "cabbage", "greens", "سبانخ", "خس", "كرنب", "ملفوف"]],
  ["🥦", ["broccoli", "cauliflower", "بروكلي", "قرنبيط"]],
  ["🍄", ["mushroom", "فطر", "مشروم"]],
  ["🌽", ["corn", "ذرة"]],
  ["🥑", ["avocado", "أفوكادو"]],
  ["🫒", ["olive", "oil", "زيتون", "زيت"]],
  ["🌿", ["parsley", "cilantro", "coriander", "mint", "basil", "thyme", "dill", "herb", "بقدونس", "كزبرة", "نعناع", "ريحان", "زعتر", "شبت"]],
  ["🫚", ["ginger", "turmeric", "زنجبيل", "كركم"]],
  ["🍤", ["shrimp", "prawn", "روبيان", "جمبري"]],
  ["🐟", ["fish", "salmon", "tuna", "hammour", "سمك", "سلمون", "تونة", "هامور"]],
  ["🍗", ["chicken", "poultry", "turkey", "دجاج", "فراخ", "ديك"]],
  ["🥩", ["beef", "lamb", "meat", "steak", "mutton", "veal", "لحم", "ضأن", "غنم", "خروف"]],
  ["🥚", ["egg", "بيض"]],
  ["🧈", ["butter", "ghee", "زبد", "سمن"]],
  ["🧀", ["cheese", "parmesan", "mozzarella", "feta", "halloumi", "جبن", "حلوم"]],
  ["🥛", ["milk", "cream", "yogurt", "yoghurt", "laban", "حليب", "قشطة", "كريمة", "زبادي", "لبن"]],
  ["🍚", ["rice", "أرز", "رز"]],
  ["🍝", ["pasta", "spaghetti", "noodle", "macaroni", "معكرونة", "باستا", "سباغيتي", "شعيرية"]],
  ["🍞", ["bread", "flour", "pita", "toast", "tortilla", "dough", "خبز", "طحين", "دقيق", "تورتيلا", "عجين"]],
  ["🫘", ["bean", "lentil", "chickpea", "hummus", "فاصوليا", "عدس", "حمص", "فول"]],
  ["🥜", ["almond", "cashew", "walnut", "pistachio", "nut", "لوز", "كاجو", "جوز", "فستق", "مكسرات"]],
  ["🍯", ["honey", "syrup", "molasses", "عسل", "دبس"]],
  ["🍬", ["sugar", "سكر"]],
  ["🧂", ["salt", "pepper", "spice", "cumin", "cinnamon", "cardamom", "saffron", "seasoning", "ملح", "فلفل", "بهار", "كمون", "قرفة", "هيل", "زعفران"]],
  ["🌴", ["date", "تمر"]],
  ["🍎", ["apple", "تفاح"]],
  ["🍌", ["banana", "موز"]],
  ["🍫", ["chocolate", "cocoa", "شوكولا", "كاكاو"]],
  ["🥫", ["sauce", "mayo", "ketchup", "paste", "صلصة", "صوص", "مايونيز", "كاتشب", "معجون"]],
  ["💧", ["water", "stock", "broth", "ماء", "مرق"]],
];

export const DEFAULT_FOOD_EMOJI = "🥄";

export function getFoodEmoji(name: string | null | undefined): string {
  const normalized = (name ?? "").trim().toLowerCase();
  if (!normalized) return DEFAULT_FOOD_EMOJI;

  for (const [emoji, keywords] of FOOD_EMOJI) {
    if (keywords.some((keyword) => normalized.includes(keyword))) return emoji;
  }

  return DEFAULT_FOOD_EMOJI;
}
