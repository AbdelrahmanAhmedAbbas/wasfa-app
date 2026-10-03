// Mock content for the hands-on import demo in the onboarding flow.
export const demoReel = {
  handle: "@gulf.kitchen",
  sourceUrl: "instagram.com/reel/…",
} as const;

type DemoIngredient = {
  quantity: number;
  unit: { en: string; ar: string };
  name: { en: string; ar: string };
};

// Amounts are for `baseServings`; the demo scales them to the household answer.
export const demoKabsa: { baseServings: number; ingredients: DemoIngredient[] } = {
  baseServings: 4,
  ingredients: [
    { quantity: 2, unit: { en: "cups", ar: "كوب" }, name: { en: "basmati rice", ar: "أرز بسمتي" } },
    { quantity: 4, unit: { en: "pieces", ar: "قطع" }, name: { en: "chicken", ar: "دجاج" } },
    { quantity: 2, unit: { en: "", ar: "" }, name: { en: "tomatoes", ar: "طماطم" } },
    { quantity: 1, unit: { en: "", ar: "" }, name: { en: "onion", ar: "بصلة" } },
  ],
};
