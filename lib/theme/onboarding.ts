export const onboardingColors = {
  backgroundBase: "#FAFDF7",
  backgroundTop: "#FAFDF7",
  backgroundBottom: "#FAFDF7",
  card: "#FFFFFF",
  cardSoft: "#F4FAEF",
  border: "#E0EDD8",
  divider: "#E0EDD8",
  primary: "#5A8A5A",
  primaryDark: "#3D6B3D",
  primaryLight: "#7BAD6E",
  primaryAccent: "#5A8A5A",
  accent: "#E8F5E0",
  accentWarm: "#D9EFCC",
  accentBorder: "#7BAD6E",
  text: "#1C2B1C",
  textMuted: "#6B7C6B",
  textSecondary: "#6B7C6B",
  textPlaceholder: "#9AAD9A",
  textOnDark: "#FFFFFF",
  shadow: "rgba(90,138,90,0.15)",
  teal: "#2BA88A",
};

export const launchScreenColors = {
  primaryDark: "#3D6B3D",
  primary: "#5A8A5A",
  primaryLight: "#7BAD6E",
  accent: "#E8F5E0",
  accentWarm: "#D9EFCC",
  bgLight: "#FAFDF7",
  bgWarm: "#FDF9F4",
  surface: "#FFFFFF",
  text: "#1C2B1C",
  textSecondary: "#6B7C6B",
  textMuted: "#9AAD9A",
  divider: "#E0EDD8",
  shadow: "rgba(90,138,90,0.15)",
} as const;

export const onboardingImages = {
  logo: require("../../assets/images/logo.png"),
  mascot: require("../../assets/images/mascot.png"),
  mascotReading: require("../../assets/images/mascot-reading.png"),
  mascotTyping: require("../../assets/images/mascot-typing.png"),
  demoKabsaSocial: require("../../assets/images/demo-kabsa-social.png"),
};

export const dietImages: Record<string, number> = {
  halal: require("../../assets/images/diet-halal.png"),
  omnivore: require("../../assets/images/diet-omnivore.png"),
  vegetarian: require("../../assets/images/diet-vegetarian.png"),
  vegan: require("../../assets/images/diet-vegan.png"),
  keto: require("../../assets/images/diet-keto.png"),
  pescatarian: require("../../assets/images/diet-pescatarian.png"),
};
