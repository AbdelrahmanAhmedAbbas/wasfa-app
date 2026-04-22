export const demoRecipe = {
  source: {
    platform: "Instagram",
    username: "@bayt_kitchen",
    avatarInitials: "BK",
    caption:
      "Weeknight chicken kabsa with warm spices, fluffy rice, and one pot cleanup. Save this for family dinner.",
  },
  title: {
    en: "Chicken Kabsa",
    ar: "كبسة دجاج",
  },
  description: {
    en: "A fragrant Gulf-style rice dish with tender chicken, tomato, and warm kabsa spices.",
    ar: "طبق أرز خليجي عطري بالدجاج الطري والطماطم وبهارات الكبسة الدافئة.",
  },
  prepMinutes: 15,
  cookMinutes: 45,
  servings: 4,
  calories: 520,
  ingredients: [
    { en: "1 whole chicken, cut into pieces", ar: "دجاجة كاملة مقطعة" },
    { en: "2 cups basmati rice, rinsed", ar: "٢ كوب أرز بسمتي مغسول" },
    { en: "1 onion, finely chopped", ar: "بصلة مفرومة ناعمًا" },
    { en: "2 tomatoes, grated", ar: "٢ طماطم مبشورة" },
    { en: "2 tbsp kabsa spice", ar: "٢ ملعقة كبيرة بهارات كبسة" },
    { en: "3 cups chicken stock", ar: "٣ أكواب مرق دجاج" },
  ],
  steps: [
    { en: "Saute onion until golden.", ar: "شوّح البصل حتى يصبح ذهبيًا." },
    { en: "Add chicken, tomatoes, and kabsa spice.", ar: "أضف الدجاج والطماطم وبهارات الكبسة." },
    { en: "Pour in stock and simmer until chicken is tender.", ar: "أضف المرق واتركه حتى ينضج الدجاج." },
    { en: "Add rice, cover, and cook on low heat.", ar: "أضف الأرز وغطّ القدر واطبخ على نار هادئة." },
    { en: "Rest for 10 minutes, then fluff and serve.", ar: "اتركه يرتاح ١٠ دقائق ثم قدّمه." },
  ],
} as const;
