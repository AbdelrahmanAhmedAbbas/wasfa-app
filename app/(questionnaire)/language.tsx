import * as ExpoFont from "expo-font";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocalizedText } from "@/components/LocalizedText";
import { MascotBadge } from "@/components/onboarding/MascotBadge";
import { OnboardingFooter } from "@/components/onboarding/OnboardingFooter";
import { CtaButton } from "@/components/wasfa/CtaButton";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { t as translate, type AppLanguage } from "@/lib/i18n/translations";
import { getStepIndex } from "@/lib/onboarding/flow";
import { setQuestionnaireStep } from "@/lib/onboarding/storage";
import { brandFontFamily } from "@/lib/theme/fonts";
import { wasfaColors } from "@/lib/theme/wasfa";

const LANGUAGES: AppLanguage[] = ["en", "ar"];

// Both languages are on screen at once, so each label picks its own brand font
// instead of following the active language like LocalizedText does.
function fontFor(lang: AppLanguage) {
  const family = lang === "ar" ? brandFontFamily.arabic : brandFontFamily.english;
  return ExpoFont.isLoaded(family) ? { fontFamily: family } : null;
}

export default function LanguageQuestionnaireScreen() {
  const { language, setLanguage, t } = useLanguage();
  const insets = useSafeAreaInsets();

  const handleContinue = async () => {
    await setQuestionnaireStep(getStepIndex("intro"));
    router.push("/(questionnaire)/intro");
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <MascotBadge size={150} imageHeight={160} offset={36} style={styles.mascot} />

        <View style={styles.titles}>
          <Text style={[styles.titleEn, fontFor("en")]}>{translate("en", "obLangTitle")}</Text>
          <Text style={[styles.titleAr, fontFor("ar")]}>{translate("ar", "obLangTitle")}</Text>
        </View>

        {LANGUAGES.map((lang) => {
          const selected = language === lang;
          const font = fontFor(lang);
          const writingDirection = lang === "ar" ? "rtl" : "ltr";

          return (
            <Pressable
              key={lang}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.card, selected && styles.cardSelected]}
              onPress={() => void setLanguage(lang)}
            >
              <View style={styles.glyphTile}>
                <Text style={[styles.glyph, lang === "ar" && styles.glyphAr, font]}>
                  {translate(lang, "obLangGlyph")}
                </Text>
              </View>
              {/* Each card reads in its own language's direction, whatever the app direction is. */}
              <View style={[styles.cardCopy, { direction: writingDirection }]}>
                <Text style={[styles.cardTitle, font, { writingDirection }]}>
                  {translate(lang, "obLangName")}
                </Text>
                <Text style={[styles.cardBody, font, { writingDirection }]}>
                  {translate(lang, "obLangDesc")}
                </Text>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]} />
            </Pressable>
          );
        })}

        <LocalizedText style={styles.note}>{t("obLangNote")}</LocalizedText>
      </ScrollView>

      <OnboardingFooter>
        <CtaButton label={t("commonContinue")} onPress={handleContinue} />
      </OnboardingFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: wasfaColors.background,
  },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    gap: 14,
  },
  mascot: {
    alignSelf: "center",
  },
  titles: {
    alignItems: "center",
    gap: 2,
    marginTop: 10,
    marginBottom: 14,
  },
  titleEn: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: -0.56,
    color: wasfaColors.ink,
    textAlign: "center",
  },
  titleAr: {
    fontSize: 24,
    lineHeight: 36,
    fontWeight: "700",
    color: wasfaColors.muted,
    textAlign: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
  },
  cardSelected: {
    borderColor: wasfaColors.cta,
    backgroundColor: wasfaColors.ctaSoft,
  },
  glyphTile: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: wasfaColors.warm,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    fontSize: 26,
    fontWeight: "800",
    color: wasfaColors.ink,
  },
  glyphAr: {
    fontSize: 28,
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  cardBody: {
    fontSize: 13,
    fontWeight: "500",
    color: wasfaColors.muted,
    textAlign: "left",
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: wasfaColors.checkBorder,
    backgroundColor: wasfaColors.surface,
  },
  radioSelected: {
    borderWidth: 7,
    borderColor: wasfaColors.cta,
  },
  note: {
    marginTop: 6,
    fontSize: 12,
    color: wasfaColors.muted,
    textAlign: "center",
  },
});
