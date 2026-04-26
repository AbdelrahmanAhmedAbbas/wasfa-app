import * as ExpoFont from "expo-font";
import { Text as RNText, TextProps, TextStyle } from "react-native";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { brandFontFamily } from "@/lib/theme/fonts";

export function LocalizedText({ style, ...props }: TextProps) {
  const { language } = useLanguage();
  const fontStyle: TextStyle | null =
    language === "ar"
      ? ExpoFont.isLoaded(brandFontFamily.arabic)
        ? { fontFamily: brandFontFamily.arabic }
        : null
      : ExpoFont.isLoaded(brandFontFamily.english)
        ? { fontFamily: brandFontFamily.english }
        : null;

  return <RNText style={[fontStyle, style]} {...props} />;
}
