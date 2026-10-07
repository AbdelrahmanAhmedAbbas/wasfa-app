import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { RecipeDetail } from "@/lib/recipes/client";
import { getCookStepAfterTap } from "@/lib/recipes/cook-mode";
import { toArabicIndicDigits } from "@/lib/recipes/numerals";
import { formatStepMetaItems, getSafeStepTitle } from "@/lib/recipes/rich-step-display";
import type { MeasurementSystem } from "@/lib/recipes/units";
import { wasfaColors, wasfaRadius } from "@/lib/theme/wasfa";

type RecipeStep = RecipeDetail["steps_json"][number];

// One bar per step up to this many; a longer recipe is drawn as a single bar.
const MAX_PROGRESS_SEGMENTS = 14;

type CookModeScreenProps = {
  steps: RecipeStep[];
  index: number;
  measurementSystem: MeasurementSystem | null;
  tipsExpanded: boolean;
  onToggleTips: () => void;
  onChangeIndex: (index: number) => void;
  onClose: () => void;
  onDone: () => void;
};

/**
 * Cook mode: one step at a time over the whole screen, which stays awake while it is
 * open. Tapping the side the language reads toward moves on a step and the other side
 * goes back; the buttons along the bottom do the same.
 *
 * It is drawn over the recipe screen rather than in a Modal, so it keeps the app's
 * text direction and the keep-awake flag stays on the window that is showing.
 */
export function CookModeScreen({
  steps,
  index,
  measurementSystem,
  tipsExpanded,
  onToggleTips,
  onChangeIndex,
  onClose,
  onDone,
}: CookModeScreenProps) {
  const { t, isRTL, language } = useLanguage();
  const digits = (value: string) => (language === "ar" ? toArabicIndicDigits(value) : value);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  useKeepAwake("cook-mode");

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);

  const total = steps.length;
  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index >= total - 1;
  const text = { textAlign: "left", writingDirection: isRTL ? "rtl" : "ltr" } as const;

  const duration =
    typeof step.duration_minutes === "number" && Number.isFinite(step.duration_minutes)
      ? digits(t("durationMinutes").replace("{count}", String(Math.round(step.duration_minutes))))
      : null;
  // The duration gets its own timer pill, so leave it out of the plain meta pills.
  const metaItems = formatStepMetaItems({ ...step, duration_minutes: undefined }, measurementSystem, t("homeMinuteShort"));
  const tips = step.tips?.filter((tip) => tip.trim()) ?? [];

  const handleTap = (event: GestureResponderEvent) => {
    const target = getCookStepAfterTap({ x: event.nativeEvent.pageX, screenWidth, isRTL, index, total });
    if (target !== index) onChangeIndex(target);
  };

  // Which way each edge of the screen leads, and whether there is a step that way.
  const leftLeads = isRTL ? !isLast : !isFirst;
  const rightLeads = isRTL ? !isFirst : !isLast;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(140)}
      accessibilityViewIsModal
      style={[styles.screen, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
    >
      <StatusBar style="light" />

      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("recipeCookClose")}
          hitSlop={10}
          onPress={onClose}
          style={styles.closeButton}
        >
          <Feather name="x" size={20} color={wasfaColors.onDeep} />
        </Pressable>
        <Text style={[styles.eyebrow, !isRTL && styles.latinCaps]}>
          {digits(t("recipeStepOf").replace("{current}", String(index + 1)).replace("{total}", String(total)))}
        </Text>
        <View style={styles.topBarBalance} />
      </View>

      <View style={styles.progress}>
        {total <= MAX_PROGRESS_SEGMENTS ? (
          steps.map((_, stepIndex) => (
            <View key={stepIndex} style={[styles.progressSegment, stepIndex <= index && styles.progressSegmentDone]} />
          ))
        ) : (
          <View style={styles.progressSegment}>
            <View style={[styles.progressFill, { width: `${((index + 1) / total) * 100}%` }]} />
          </View>
        )}
      </View>

      <ScrollView
        key={index}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable accessible={false} style={styles.body} onPress={handleTap}>
          <Text style={[styles.title, text]}>
            {getSafeStepTitle(step, index, t("stepN").replace("{order}", String(step.order || index + 1)))}
          </Text>
          <Text style={[styles.text, text]}>{step.text}</Text>

          {duration || metaItems.length ? (
            <View style={styles.metaWrap}>
              {duration ? (
                <View style={styles.timerPill}>
                  <MaterialCommunityIcons name="timer-outline" size={19} color={wasfaColors.gold} />
                  <Text style={styles.timerText}>{duration}</Text>
                </View>
              ) : null}
              {metaItems.map((meta) => (
                <View key={meta} style={styles.metaPill}>
                  <Text style={[styles.metaPillText, { writingDirection: text.writingDirection }]}>{meta}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {tips.length ? (
            <View style={styles.tipSection}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: tipsExpanded }}
                hitSlop={8}
                onPress={onToggleTips}
                style={styles.tipToggle}
              >
                <Feather name="zap" size={14} color={wasfaColors.gold} />
                <Text style={styles.tipToggleText}>{t("tipLabel")}</Text>
                <Feather name={tipsExpanded ? "chevron-up" : "chevron-down"} size={16} color={wasfaColors.gold} />
              </Pressable>
              {tipsExpanded ? (
                <View style={styles.tipBlock}>
                  {tips.map((tip, tipIndex) => (
                    <Text key={`${tip}-${tipIndex}`} style={[styles.tipText, text]}>
                      {tip}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </ScrollView>

      {/* Left and right here are the screen's own edges, in both languages. */}
      <View pointerEvents="none" style={[styles.edgeHint, styles.edgeHintLeft, !leftLeads && styles.edgeHintOff]}>
        <Feather name="chevron-left" size={26} color={wasfaColors.onDeep} />
      </View>
      <View pointerEvents="none" style={[styles.edgeHint, styles.edgeHintRight, !rightLeads && styles.edgeHintOff]}>
        <Feather name="chevron-right" size={26} color={wasfaColors.onDeep} />
      </View>

      <Text style={styles.tapHint}>{t("recipeCookTapHint")}</Text>

      <View style={styles.actions}>
        {isFirst ? null : (
          <Pressable accessibilityRole="button" onPress={() => onChangeIndex(index - 1)} style={styles.backButton}>
            <Text style={styles.backText}>{t("back")}</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={isLast ? onDone : () => onChangeIndex(index + 1)}
          style={styles.nextButton}
        >
          <Text style={styles.nextText} numberOfLines={1}>
            {isLast ? t("recipeDoneCooking") : t("recipeNextStep")}
          </Text>
          <Feather
            name={isLast ? "check" : isRTL ? "arrow-left" : "arrow-right"}
            size={18}
            color={wasfaColors.deep}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const onDeepLine = "rgba(255,255,255,0.28)";
const onDeepFill = "rgba(255,255,255,0.12)";

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
    backgroundColor: wasfaColors.deep,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: onDeepFill,
    alignItems: "center",
    justifyContent: "center",
  },
  // Same width as the close button, so the step count sits in the middle.
  topBarBalance: {
    width: 40,
  },
  eyebrow: {
    color: wasfaColors.onDeepSoft,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "800",
  },
  latinCaps: {
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  progress: {
    marginTop: 14,
    flexDirection: "row",
    gap: 4,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: onDeepFill,
  },
  progressSegmentDone: {
    backgroundColor: wasfaColors.gold,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: wasfaColors.gold,
  },
  scroll: {
    flex: 1,
    // The tap area reaches the screen's edges, past the padding the text keeps.
    marginHorizontal: -24,
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 24,
    gap: 18,
  },
  title: {
    color: wasfaColors.onDeep,
    fontSize: 30,
    lineHeight: 40,
    fontWeight: "800",
  },
  text: {
    color: wasfaColors.onDeepSoft,
    fontSize: 22,
    lineHeight: 35,
  },
  metaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: wasfaRadius.pill,
    backgroundColor: onDeepFill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  timerText: {
    color: wasfaColors.onDeep,
    fontSize: 16,
    fontWeight: "800",
  },
  metaPill: {
    justifyContent: "center",
    borderRadius: wasfaRadius.pill,
    borderWidth: 1,
    borderColor: onDeepLine,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  metaPillText: {
    color: wasfaColors.onDeepSoft,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  tipSection: {
    gap: 8,
  },
  tipToggle: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: wasfaRadius.pill,
    backgroundColor: onDeepFill,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  tipToggleText: {
    color: wasfaColors.gold,
    fontSize: 14,
    fontWeight: "800",
  },
  tipBlock: {
    borderRadius: wasfaRadius.sm,
    backgroundColor: onDeepFill,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  tipText: {
    color: wasfaColors.onDeep,
    fontSize: 17,
    lineHeight: 26,
  },
  edgeHint: {
    position: "absolute",
    top: "50%",
    opacity: 0.4,
  },
  edgeHintLeft: {
    left: 6,
  },
  edgeHintRight: {
    right: 6,
  },
  edgeHintOff: {
    opacity: 0.1,
  },
  tapHint: {
    color: wasfaColors.onDeepSoft,
    opacity: 0.75,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    paddingBottom: 12,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: wasfaRadius.pill,
    borderWidth: 1.5,
    borderColor: onDeepLine,
    paddingHorizontal: 24,
  },
  backText: {
    color: wasfaColors.onDeep,
    fontSize: 16,
    fontWeight: "800",
  },
  nextButton: {
    flex: 1,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: wasfaRadius.pill,
    backgroundColor: wasfaColors.gold,
    paddingHorizontal: 18,
  },
  nextText: {
    flexShrink: 1,
    color: wasfaColors.deep,
    fontSize: 16,
    fontWeight: "800",
  },
});
