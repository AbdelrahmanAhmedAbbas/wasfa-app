import * as ExpoFont from "expo-font";
import { Text as RNText, TextProps } from "react-native";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { brandFontFamily } from "@/lib/theme/fonts";

export function LocalizedText({ style, ...props }: TextProps) {
  const { language } = useLanguage();
  const fontStyle =
    language === "ar" && ExpoFont.isLoaded(brandFontFamily.arabic)
      ? { fontFamily: brandFontFamily.arabic }
      : null;

  return <RNText style={[fontStyle, style]} {...props} />;
}
