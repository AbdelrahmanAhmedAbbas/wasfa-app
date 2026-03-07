export const brandFontFamily = {
  english: "System",
  arabic: "Vazirmatn",
} as const;

export const brandFontSources = {
  [brandFontFamily.arabic]: {
    uri: "https://raw.githubusercontent.com/google/fonts/main/ofl/vazirmatn/Vazirmatn%5Bwght%5D.ttf",
  },
} as const;
