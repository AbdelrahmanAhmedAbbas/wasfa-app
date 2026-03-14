export const brandFontFamily = {
  english: "BricolageGrotesque",
  arabic: "Vazirmatn",
} as const;

export const brandFontSources = {
  [brandFontFamily.english]: {
    uri: "https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/BricolageGrotesque%5Bopsz%2Cwdth%2Cwght%5D.ttf",
  },
  [brandFontFamily.arabic]: {
    uri: "https://raw.githubusercontent.com/google/fonts/main/ofl/vazirmatn/Vazirmatn%5Bwght%5D.ttf",
  },
} as const;
