import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { PhotoScrim } from "@/components/wasfa/PhotoScrim";
import { MascotBadge } from "@/components/onboarding/MascotBadge";
import { OnboardingFooter } from "@/components/onboarding/OnboardingFooter";
import { eyebrowStyle, headingStyle } from "@/components/onboarding/text-styles";
import { CtaButton } from "@/components/wasfa/CtaButton";
import { FoodEmojiTile } from "@/components/wasfa/FoodEmojiTile";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { getOnboardingAnswers, type HouseholdSize } from "@/lib/onboarding/answers";
import { demoKabsa, demoReel } from "@/lib/onboarding/demo-data";
import { getHouseholdOption, getStepIndex, scaleDemoQuantity } from "@/lib/onboarding/flow";
import { setQuestionnaireComplete, setQuestionnaireStep } from "@/lib/onboarding/storage";
import { toArabicIndicDigits } from "@/lib/recipes/numerals";
import { onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors } from "@/lib/theme/wasfa";

// reel -> share sheet -> working -> saved recipe
type DemoPhase = 0 | 1 | 2 | 3;

const TITLE_KEYS: TranslationKey[] = ["obDemoTitle0", "obDemoTitle1", "obDemoTitle2", "obDemoTitle3"];
const HINT_KEYS: TranslationKey[] = ["obDemoHint0", "obDemoHint1", "obDemoHint2", "obDemoHint3"];
const STAGE_KEYS: TranslationKey[] = ["obStage1", "obStage2", "obStage3", "obStage4"];
const STAGE_MS = 700;
const WORKING_MS = 3300;

// Stand-in for the dark gradient at the foot of the reel (no gradient library in the app).
const SCRIM_MAX_OPACITY = 0.65;

const SHARE_APPS: { labelKey: TranslationKey; color: string }[] = [
  { labelKey: "obShareMessages", color: "#34C759" },
  { labelKey: "obShareWhatsApp", color: "#25D366" },
  { labelKey: "obShareWasfa", color: wasfaColors.primarySoft },
  { labelKey: "obShareNotes", color: "#FFD60A" },
];

export default function DemoQuestionnaireScreen() {
  const { isRTL, language, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<DemoPhase>(0);
  const [stagesDone, setStagesDone] = useState(0);
  const [householdSize, setHouseholdSize] = useState<HouseholdSize | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let isMounted = true;

    void getOnboardingAnswers().then((answers) => {
      if (isMounted) setHouseholdSize(answers.householdSize);
    });

    return () => {
      isMounted = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const household = getHouseholdOption(householdSize);
  const num = (value: number) => (isRTL ? toArabicIndicDigits(String(value)) : String(value));

  const startWorking = () => {
    setPhase(2);
    setStagesDone(0);
    timers.current.forEach(clearTimeout);
    timers.current = [
      ...STAGE_KEYS.map((_, index) =>
        setTimeout(() => setStagesDone(index + 1), (index + 1) * STAGE_MS)
      ),
      setTimeout(() => setPhase(3), WORKING_MS),
    ];
  };

  const finishQuestionnaire = async () => {
    setIsFinishing(true);
    try {
      await setQuestionnaireComplete(true);
      await setQuestionnaireStep(getStepIndex("ready"));
      router.replace("/(auth)/signup");
    } finally {
      setIsFinishing(false);
    }
  };

  const ingredientLines = demoKabsa.ingredients.map((ingredient) => ({
    name: ingredient.name.en,
    text: [
      num(scaleDemoQuantity(ingredient.quantity, household.servings, demoKabsa.baseServings)),
      ingredient.unit[language],
      ingredient.name[language],
    ]
      .filter(Boolean)
      .join(" "),
  }));

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 60 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.tag, eyebrowStyle(isRTL)]}>{t("obDemoTag")}</Text>
        <Text style={[styles.title, headingStyle(28, isRTL)]}>{t(TITLE_KEYS[phase])}</Text>
        <Text style={styles.hint}>{t(HINT_KEYS[phase])}</Text>

        {phase <= 1 ? (
          <View style={styles.reel}>
            <Image source={onboardingImages.demoKabsaSocial} style={styles.reelImage} resizeMode="cover" />
            <PhotoScrim maxOpacity={SCRIM_MAX_OPACITY} coverage={0.5} />

            <View style={styles.reelCopy}>
              <Text style={styles.reelHandle}>{demoReel.handle}</Text>
              <Text style={styles.reelCaption}>{t("obCaption")}</Text>
            </View>

            <View style={styles.reelActions}>
              <Feather name="heart" size={26} color="#FFFFFF" style={styles.reelActionIcon} />
              <Feather name="message-circle" size={26} color="#FFFFFF" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("obDemoTitle0")}
                style={styles.shareHaloOuter}
                onPress={() => setPhase(1)}
              >
                <View style={styles.shareHaloInner}>
                  <View style={styles.shareButton}>
                    <Feather name="send" size={22} color="#FFFFFF" />
                  </View>
                </View>
              </Pressable>
            </View>

            {phase === 1 ? (
              <>
                <Animated.View entering={FadeIn.duration(200)} style={styles.sheetBackdrop} />
                <Animated.View entering={FadeInDown.duration(260)} style={styles.sheet}>
                  <View style={styles.sheetGrabber} />
                  <Text style={styles.sheetTitle}>{t("obShareTo")}</Text>
                  <View style={styles.sheetApps}>
                    {SHARE_APPS.map((app) => {
                      const isWasfa = app.labelKey === "obShareWasfa";

                      if (!isWasfa) {
                        return (
                          <View key={app.labelKey} style={styles.sheetApp}>
                            <View style={[styles.sheetAppTile, { backgroundColor: app.color }]} />
                            <Text style={styles.sheetAppLabel}>{t(app.labelKey)}</Text>
                          </View>
                        );
                      }

                      return (
                        <Pressable
                          key={app.labelKey}
                          accessibilityRole="button"
                          style={styles.sheetApp}
                          onPress={startWorking}
                        >
                          <View style={styles.wasfaHalo}>
                            <View style={styles.wasfaRing}>
                              <MascotBadge size={52} radius={16} imageHeight={56} offset={16} />
                            </View>
                          </View>
                          <Text style={[styles.sheetAppLabel, styles.sheetAppLabelWasfa]}>
                            {t(app.labelKey)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Animated.View>
              </>
            ) : null}
          </View>
        ) : null}

        {phase === 2 ? (
          <Animated.View entering={FadeIn.duration(250)} style={styles.working}>
            <View style={styles.workingSource}>
              <Image source={onboardingImages.demoKabsaSocial} style={styles.workingThumb} />
              <Text style={styles.workingUrl}>{demoReel.sourceUrl}</Text>
            </View>
            <Image
              source={onboardingImages.mascotTyping}
              style={styles.workingMascot}
              resizeMode="contain"
            />
            {STAGE_KEYS.map((key, index) => {
              const done = stagesDone > index;

              return (
                <View key={key} style={[styles.stageRow, stagesDone < index && styles.stageRowPending]}>
                  <View style={[styles.stageBox, done && styles.stageBoxDone]}>
                    {done ? <Feather name="check" size={12} color={wasfaColors.deep} /> : null}
                  </View>
                  <Text style={styles.stageLabel}>{t(key)}</Text>
                </View>
              );
            })}
          </Animated.View>
        ) : null}

        {phase === 3 ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.recipeShadow}>
            <View style={styles.recipe}>
              <View>
                <Image
                  source={onboardingImages.demoKabsaSocial}
                  style={styles.recipeImage}
                  resizeMode="cover"
                />
                <View style={styles.savedBadge}>
                  <Feather name="check" size={14} color="#FFFFFF" />
                  <Text style={styles.savedBadgeText}>{t("obSaved")}</Text>
                </View>
              </View>
              <View style={styles.recipeBody}>
                <View style={styles.recipeHeading}>
                  <Text style={styles.recipeTitle}>{t("obKabsa")}</Text>
                  <Text style={styles.recipeMeta}>
                    {`${t("obKabsaMeta")} · ${t(household.labelKey)}`}
                  </Text>
                </View>
                <View style={styles.ingredients}>
                  {ingredientLines.map((line) => (
                    <View key={line.name} style={styles.ingredientRow}>
                      <FoodEmojiTile name={line.name} size={36} />
                      <Text style={styles.ingredientText}>{line.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      {phase === 3 ? (
        <OnboardingFooter>
          <CtaButton
            label={t("obKeepGoing")}
            onPress={() => void finishQuestionnaire()}
            loading={isFinishing}
          />
        </OnboardingFooter>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: wasfaColors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  tag: {
    fontSize: 13,
    fontWeight: "800",
    color: wasfaColors.primary,
    textAlign: "left",
  },
  title: {
    marginTop: -6,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  hint: {
    fontSize: 15,
    lineHeight: 22,
    color: wasfaColors.muted,
    textAlign: "left",
  },

  // Phase 0 and 1: the mock reel, then the share sheet over it.
  reel: {
    height: 420,
    marginTop: 4,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "#111111",
  },
  reelImage: {
    width: "100%",
    height: "100%",
    opacity: 0.92,
  },
  reelCopy: {
    position: "absolute",
    bottom: 16,
    start: 16,
    end: 70,
    gap: 6,
  },
  reelHandle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "left",
    writingDirection: "ltr",
  },
  reelCaption: {
    fontSize: 12,
    lineHeight: 17,
    color: "#FFFFFF",
    opacity: 0.9,
    textAlign: "left",
  },
  // The share button's halo adds 14pt on every side, hence the smaller offsets here.
  reelActions: {
    position: "absolute",
    bottom: 6,
    end: 0,
    alignItems: "center",
  },
  reelActionIcon: {
    marginBottom: 18,
  },
  shareHaloOuter: {
    marginTop: 4,
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "rgba(242,133,26,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  shareHaloInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(242,133,26,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  shareButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: wasfaColors.cta,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 18,
    gap: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#F4F2EE",
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 9,
    backgroundColor: "#D5D0C7",
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: wasfaColors.muted,
    textAlign: "left",
  },
  sheetApps: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sheetApp: {
    width: 62,
    alignItems: "center",
    gap: 6,
  },
  sheetAppTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
  },
  sheetAppLabel: {
    fontSize: 10,
    color: wasfaColors.muted,
  },
  sheetAppLabelWasfa: {
    fontWeight: "800",
    color: wasfaColors.ink,
  },
  // Orange ring plus a soft halo around the Wasfa tile; the negative margin
  // keeps the tile itself in line with its neighbours.
  wasfaHalo: {
    margin: -8,
    padding: 5,
    borderRadius: 24,
    backgroundColor: "rgba(242,133,26,0.25)",
  },
  wasfaRing: {
    padding: 3,
    borderRadius: 19,
    backgroundColor: wasfaColors.cta,
  },

  // Phase 2: the staged "working" card.
  working: {
    minHeight: 380,
    marginTop: 4,
    padding: 22,
    gap: 14,
    borderRadius: 30,
    backgroundColor: wasfaColors.deep,
  },
  workingSource: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  workingThumb: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  workingUrl: {
    flex: 1,
    fontSize: 13,
    color: "#FFFFFF",
    opacity: 0.8,
    textAlign: "left",
    writingDirection: "ltr",
  },
  workingMascot: {
    alignSelf: "center",
    height: 130,
    // mascot-typing.png is 414x611.
    width: 130 * (414 / 611),
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stageRowPending: {
    opacity: 0.35,
  },
  stageBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  stageBoxDone: {
    borderColor: wasfaColors.gold,
    backgroundColor: wasfaColors.gold,
  },
  stageLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "left",
  },

  // Phase 3: the saved recipe card.
  recipeShadow: {
    marginTop: 4,
    borderRadius: 30,
    backgroundColor: wasfaColors.surface,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  recipe: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    overflow: "hidden",
  },
  recipeImage: {
    width: "100%",
    height: 160,
  },
  savedBadge: {
    position: "absolute",
    top: 12,
    start: 12,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: wasfaColors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  savedBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  recipeBody: {
    padding: 16,
    gap: 12,
  },
  recipeHeading: {
    gap: 2,
  },
  recipeTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  recipeMeta: {
    fontSize: 13,
    fontWeight: "600",
    color: wasfaColors.muted,
    textAlign: "left",
  },
  ingredients: {
    gap: 6,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ingredientText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: wasfaColors.ink,
    textAlign: "left",
  },
});
