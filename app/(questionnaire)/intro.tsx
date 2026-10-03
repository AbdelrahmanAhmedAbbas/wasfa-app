import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { OnboardingFooter } from "@/components/onboarding/OnboardingFooter";
import { headingStyle } from "@/components/onboarding/text-styles";
import { CheckBox } from "@/components/wasfa/CheckBox";
import { CtaButton } from "@/components/wasfa/CtaButton";
import { Glyph } from "@/components/wasfa/Glyph";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { demoReel } from "@/lib/onboarding/demo-data";
import { getStepIndex } from "@/lib/onboarding/flow";
import { setQuestionnaireStep } from "@/lib/onboarding/storage";
import { toArabicIndicDigits } from "@/lib/recipes/numerals";
import type { GlyphName } from "@/lib/theme/glyphs";
import { onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors } from "@/lib/theme/wasfa";

const PAGES: { titleKey: TranslationKey; bodyKey: TranslationKey }[] = [
  { titleKey: "obIntro1Title", bodyKey: "obIntro1Body" },
  { titleKey: "obIntro2Title", bodyKey: "obIntro2Body" },
  { titleKey: "obIntro3Title", bodyKey: "obIntro3Body" },
];

const WEEK_DAYS: { labelKey: TranslationKey; date: number }[] = [
  { labelKey: "obDaySun", date: 27 },
  { labelKey: "obDayMon", date: 28 },
  { labelKey: "obDayTue", date: 29 },
  { labelKey: "obDayWed", date: 30 },
  { labelKey: "obDayThu", date: 1 },
  { labelKey: "obDayFri", date: 2 },
  { labelKey: "obDaySat", date: 3 },
];
// Days with a planned meal; Friday is the highlighted one.
const PLANNED_DAYS = [1, 3, 5];
const HIGHLIGHT_DAY = 5;

const RECIPE_GLYPHS: GlyphName[] = ["cooked-rice", "poultry-leg", "tomato", "onion"];
const GROCERY_ROWS: { labelKey: TranslationKey; icon: GlyphName; checked: boolean }[] = [
  { labelKey: "obListRice", icon: "cooked-rice", checked: true },
  { labelKey: "obListChicken", icon: "poultry-leg", checked: true },
  { labelKey: "obListTomatoes", icon: "tomato", checked: false },
  { labelKey: "obListOnion", icon: "onion", checked: false },
  { labelKey: "obListGarlic", icon: "garlic", checked: false },
];

// The artwork is drawn for a 396pt-tall stage and scaled down on short screens.
const STAGE_HEIGHT = 396;
const MIN_STAGE_HEIGHT = 260;
// Room kept below the hero for the copy and the footer.
const COPY_AND_FOOTER_HEIGHT = 360;

export default function IntroQuestionnaireScreen() {
  const { isRTL, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [page, setPage] = useState(0);

  const stageHeight = Math.min(
    STAGE_HEIGHT,
    Math.max(MIN_STAGE_HEIGHT, windowHeight - insets.top - insets.bottom - COPY_AND_FOOTER_HEIGHT)
  );
  const stageScale = stageHeight / STAGE_HEIGHT;
  const isLastPage = page === PAGES.length - 1;
  const num = (value: number) => (isRTL ? toArabicIndicDigits(String(value)) : String(value));

  const startChat = async () => {
    await setQuestionnaireStep(getStepIndex("chat"));
    router.push("/(questionnaire)/chat");
  };

  // Replaces the questionnaire so no intro is left under the signed-in app;
  // the sign-up screen shows its own back button for this entry.
  const openSignIn = () => {
    router.replace({ pathname: "/(auth)/signup", params: { from: "intro" } });
  };

  const handleCta = () => {
    if (!isLastPage) {
      setPage(page + 1);
      return;
    }
    void startChat();
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View style={[styles.hero, { height: stageHeight + insets.top }]}>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          style={[styles.skip, { top: insets.top + 8 }]}
          onPress={() => void startChat()}
        >
          <Text style={styles.skipText}>{t("obSkip")}</Text>
        </Pressable>

        <View
          pointerEvents="none"
          style={[
            styles.stage,
            { top: insets.top, transform: [{ scale: stageScale }], transformOrigin: "top" },
          ]}
        >
          {page === 0 ? (
            <>
              <View style={styles.reelShadow}>
                <View style={styles.reel}>
                  <Image
                    source={onboardingImages.demoKabsaSocial}
                    style={styles.fill}
                    resizeMode="cover"
                  />
                  <Text style={styles.reelHandle}>{demoReel.handle}</Text>
                  <View style={styles.reelShareHalo}>
                    <View style={styles.reelShare}>
                      <Feather name="send" size={16} color="#FFFFFF" />
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.recipeCard}>
                <Text style={styles.recipeTitle}>{t("obKabsa")}</Text>
                <View style={styles.glyphRow}>
                  {RECIPE_GLYPHS.map((glyph) => (
                    <Glyph key={glyph} name={glyph} size={22} />
                  ))}
                </View>
                <View style={styles.recipeLines}>
                  <View style={styles.recipeLine}>
                    <View style={styles.recipeDot} />
                    <View style={[styles.recipeBar, styles.recipeBarFull]} />
                  </View>
                  <View style={styles.recipeLine}>
                    <View style={styles.recipeDot} />
                    <View style={[styles.recipeBar, styles.recipeBarShort]} />
                  </View>
                </View>
              </View>
            </>
          ) : null}

          {page === 1 ? (
            <>
              <View style={styles.planCard}>
                <View style={styles.weekRow}>
                  {WEEK_DAYS.map((day, index) => {
                    const highlighted = index === HIGHLIGHT_DAY;
                    const planned = PLANNED_DAYS.includes(index);

                    return (
                      <View key={day.labelKey} style={styles.weekDay}>
                        <Text style={styles.weekLabel}>{t(day.labelKey)}</Text>
                        <View
                          style={[
                            styles.weekDate,
                            planned && styles.weekDatePlanned,
                            highlighted && styles.weekDateHighlighted,
                          ]}
                        >
                          <Text style={[styles.weekDateText, planned && styles.weekDateTextOn]}>
                            {num(day.date)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.mealRow}>
                  <Image source={onboardingImages.demoKabsaSocial} style={styles.mealImage} />
                  <View style={styles.mealCopy}>
                    <Text style={styles.mealTitle}>{t("obKabsa")}</Text>
                    <Text style={styles.mealMeta}>{t("obFriDinner")}</Text>
                  </View>
                  <View style={styles.mealPill}>
                    <Text style={styles.mealPillText}>{t("obFourPpl")}</Text>
                  </View>
                </View>

                <View style={styles.addMeal}>
                  <Text style={styles.addMealText}>{t("obAddMeal")}</Text>
                </View>
              </View>

              <Image
                source={onboardingImages.mascotReading}
                style={styles.mascotReading}
                resizeMode="contain"
              />
            </>
          ) : null}

          {page === 2 ? (
            <View style={styles.listCard}>
              {GROCERY_ROWS.map((row) => (
                <View key={row.labelKey} style={styles.listRow}>
                  <Glyph name={row.icon} size={22} />
                  <Text style={[styles.listText, row.checked && styles.listTextChecked]}>
                    {t(row.labelKey)}
                  </Text>
                  <CheckBox checked={row.checked} variant="round" size={22} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.copyScroll}
        contentContainerStyle={styles.copy}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, headingStyle(32, isRTL)]}>{t(PAGES[page].titleKey)}</Text>
        <Text style={styles.body}>{t(PAGES[page].bodyKey)}</Text>
      </ScrollView>

      <OnboardingFooter>
        <View style={styles.dots}>
          {PAGES.map((item, index) => (
            <Pressable
              key={item.titleKey}
              accessibilityRole="button"
              hitSlop={8}
              style={[styles.dot, index === page && styles.dotActive]}
              onPress={() => setPage(index)}
            />
          ))}
        </View>
        <CtaButton label={isLastPage ? t("obStart") : t("onNext")} onPress={handleCta} />
        {isLastPage ? (
          <Pressable
            accessibilityRole="button"
            style={styles.secondary}
            onPress={openSignIn}
          >
            <Text style={styles.secondaryText}>{t("authAlreadyAccount")}</Text>
          </Pressable>
        ) : null}
      </OnboardingFooter>
    </View>
  );
}

const cardShadow = {
  shadowColor: "#000000",
  shadowOpacity: 0.2,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 18 },
  elevation: 8,
} as const;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: wasfaColors.background,
  },
  hero: {
    backgroundColor: wasfaColors.primary,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
  },
  skip: {
    position: "absolute",
    end: 18,
    zIndex: 2,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stage: {
    position: "absolute",
    left: 0,
    right: 0,
    height: STAGE_HEIGHT,
  },
  fill: {
    width: "100%",
    height: "100%",
  },

  // Page 1: a reel next to the recipe card it turns into.
  reelShadow: {
    position: "absolute",
    top: 56,
    start: 26,
    width: 150,
    height: 250,
    borderRadius: 24,
    backgroundColor: "#111111",
    transform: [{ rotate: "-7deg" }],
    ...cardShadow,
    shadowOpacity: 0.25,
  },
  reel: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#111111",
    overflow: "hidden",
  },
  reelHandle: {
    position: "absolute",
    bottom: 12,
    start: 10,
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    writingDirection: "ltr",
  },
  reelShareHalo: {
    position: "absolute",
    bottom: 34,
    end: 2,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(242,133,26,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  reelShare: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: wasfaColors.cta,
    alignItems: "center",
    justifyContent: "center",
  },
  recipeCard: {
    position: "absolute",
    top: 126,
    end: 22,
    width: 160,
    borderRadius: 24,
    backgroundColor: wasfaColors.surface,
    padding: 14,
    gap: 10,
    transform: [{ rotate: "5deg" }],
    ...cardShadow,
  },
  recipeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  glyphRow: {
    flexDirection: "row",
    gap: 6,
  },
  recipeLines: {
    gap: 6,
  },
  recipeLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recipeDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: wasfaColors.primary,
  },
  recipeBar: {
    height: 6,
    borderRadius: 9,
    backgroundColor: wasfaColors.primarySoft,
  },
  recipeBarFull: {
    flex: 1,
  },
  recipeBarShort: {
    width: "70%",
  },

  // Page 2: a week strip with one planned meal.
  planCard: {
    position: "absolute",
    top: 66,
    start: 22,
    end: 22,
    borderRadius: 26,
    backgroundColor: wasfaColors.surface,
    padding: 16,
    gap: 12,
    ...cardShadow,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekDay: {
    alignItems: "center",
    gap: 6,
  },
  weekLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: wasfaColors.muted,
  },
  weekDate: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: wasfaColors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDatePlanned: {
    borderWidth: 0,
    backgroundColor: wasfaColors.primary,
  },
  weekDateHighlighted: {
    backgroundColor: wasfaColors.cta,
  },
  weekDateText: {
    fontSize: 13,
    fontWeight: "800",
    color: wasfaColors.ink,
  },
  weekDateTextOn: {
    color: "#FFFFFF",
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: 16,
    backgroundColor: wasfaColors.soft,
  },
  mealImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  mealCopy: {
    flex: 1,
  },
  mealTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  mealMeta: {
    fontSize: 11,
    color: wasfaColors.muted,
    textAlign: "left",
  },
  mealPill: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: wasfaColors.ctaSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  mealPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: wasfaColors.cta,
  },
  addMeal: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: wasfaColors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  addMealText: {
    fontSize: 12,
    fontWeight: "700",
    color: wasfaColors.muted,
  },
  mascotReading: {
    position: "absolute",
    bottom: -30,
    end: 10,
    height: 150,
    // mascot-reading.png is 341x612.
    width: 150 * (341 / 612),
  },

  // Page 3: a grocery list with the first items ticked.
  listCard: {
    position: "absolute",
    top: 56,
    start: 30,
    end: 30,
    borderRadius: 26,
    backgroundColor: wasfaColors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...cardShadow,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  listTextChecked: {
    textDecorationLine: "line-through",
    opacity: 0.45,
  },

  copyScroll: {
    flex: 1,
  },
  copy: {
    paddingTop: 28,
    paddingHorizontal: 24,
    gap: 10,
  },
  title: {
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: wasfaColors.muted,
    textAlign: "left",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 9,
    backgroundColor: wasfaColors.line,
  },
  dotActive: {
    width: 22,
    backgroundColor: wasfaColors.primary,
  },
  secondary: {
    padding: 6,
    alignItems: "center",
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: wasfaColors.primaryDark,
  },
});
