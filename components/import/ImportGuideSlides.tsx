import Feather from "@expo/vector-icons/Feather";
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Image,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { CtaButton } from "@/components/wasfa/CtaButton";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import {
  getGuideSlideAfterSwipe,
  getImportGuidePlatformLink,
  getImportGuideSlides,
  type ImportGuidePlatform,
  type ImportGuideScene,
} from "@/lib/import/guide";
import { toArabicIndicDigits } from "@/lib/recipes/numerals";
import { onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors, wasfaRadius, wasfaShadow } from "@/lib/theme/wasfa";

type FeatherName = ComponentProps<typeof Feather>["name"];

// How each app draws its own screen: the buttons down the side of the video, which one
// shares, and the last button of its share panel, the one that opens the phone's sheet.
const PLATFORM_LOOK: Record<
  ImportGuidePlatform,
  { rail: FeatherName[]; share: FeatherName; panelLast: FeatherName; panelLastKey: TranslationKey }
> = {
  tiktok: {
    rail: ["heart", "message-circle", "bookmark", "corner-up-right"],
    share: "corner-up-right",
    panelLast: "more-horizontal",
    panelLastKey: "importGuideMoreLabel",
  },
  instagram: {
    rail: ["heart", "message-circle", "send", "more-vertical"],
    share: "send",
    panelLast: "share",
    panelLastKey: "importGuideShareToLabel",
  },
  youtube: {
    rail: ["thumbs-up", "thumbs-down", "message-square", "corner-up-right"],
    share: "corner-up-right",
    panelLast: "more-horizontal",
    panelLastKey: "importGuideMoreLabel",
  },
};

type ImportGuideSlidesProps = {
  platform: ImportGuidePlatform;
  /** The platform's name, as the sheet already shows it. */
  platformName: string;
  /** Goes back to the sheet's link field, for a reader who would rather paste. */
  onPasteInstead: () => void;
};

/**
 * The step-by-step guide for one app: a picture of what to tap, one step to a slide.
 * Slides turn with the buttons or a sideways swipe, the way the language reads.
 */
export function ImportGuideSlides({ platform, platformName, onPasteInstead }: ImportGuideSlidesProps) {
  const { t, isRTL, language } = useLanguage();
  const slides = getImportGuideSlides(platform, Platform.OS === "ios" ? "ios" : "android");
  const total = slides.length;
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const isLast = index === total - 1;
  const text = { textAlign: "left", writingDirection: isRTL ? "rtl" : "ltr" } as const;
  const digits = (value: string) => (language === "ar" ? toArabicIndicDigits(value) : value);

  // The swipe handler is made once, so it reads the slide it is on from here.
  const position = useRef({ index, total, isRTL });
  position.current = { index, total, isRTL };
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderRelease: (_, gesture) =>
          setIndex(getGuideSlideAfterSwipe({ dx: gesture.dx, ...position.current })),
      }),
    []
  );

  const appear = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [appear, index]);

  return (
    <View style={styles.guide}>
      <View {...panResponder.panHandlers}>
        <Animated.View style={[styles.stage, { opacity: appear }]}>
          <Scene scene={slide.scene} platform={platform} />
        </Animated.View>

        <Text style={[styles.stepLabel, !isRTL && styles.latinCaps, text]}>
          {digits(
            t("recipeStepOf").replace("{current}", String(index + 1)).replace("{total}", String(total))
          )}
        </Text>
        <Text style={[styles.title, text]}>{t(slide.titleKey)}</Text>
        <Text style={[styles.body, text]}>{t(slide.bodyKey)}</Text>
      </View>

      <View style={styles.dots}>
        {slides.map((_, dotIndex) => (
          <Pressable
            key={dotIndex}
            accessibilityRole="button"
            accessibilityState={{ selected: dotIndex === index }}
            hitSlop={8}
            onPress={() => setIndex(dotIndex)}
            style={[styles.dot, dotIndex === index && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.actions}>
        {index > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => setIndex(index - 1)} style={styles.backButton}>
            <Text style={styles.backText}>{t("commonBack")}</Text>
          </Pressable>
        ) : null}
        <CtaButton
          label={isLast ? t("importGuideOpenApp").replace("{app}", platformName) : t("importGuideNext")}
          onPress={
            isLast
              ? () => void Linking.openURL(getImportGuidePlatformLink(platform)).catch(() => {})
              : () => setIndex(index + 1)
          }
          trailing={
            <Feather
              name={isLast ? "external-link" : isRTL ? "arrow-left" : "arrow-right"}
              size={18}
              color="#FFFFFF"
            />
          }
          style={styles.nextButton}
        />
      </View>

      <Pressable accessibilityRole="button" hitSlop={6} onPress={onPasteInstead} style={styles.pasteLink}>
        <Feather name="link" size={14} color={wasfaColors.primaryDark} />
        <Text style={[styles.pasteText, text]}>{t("importGuidePasteInstead")}</Text>
      </Pressable>
    </View>
  );
}

function Scene({ scene, platform }: { scene: ImportGuideScene; platform: ImportGuidePlatform }) {
  const { t } = useLanguage();
  const look = PLATFORM_LOOK[platform];

  if (scene === "recipe") {
    return (
      <View style={styles.resultScene}>
        <Image source={onboardingImages.mascotReading} resizeMode="contain" style={styles.resultMascot} />
        <View style={styles.recipeCard}>
          <Image source={onboardingImages.demoKabsaSocial} resizeMode="cover" style={styles.recipePhoto} />
          <View style={styles.recipeTitleBar} />
          {[0.9, 0.7, 0.8].map((width, row) => (
            <View key={row} style={styles.recipeRow}>
              <Feather name="check-circle" size={13} color={wasfaColors.primary} />
              <View style={[styles.recipeLine, { width: `${width * 78}%` }]} />
            </View>
          ))}
          <View style={styles.savedBadge}>
            <Feather name="check" size={12} color="#FFFFFF" />
            <Text style={styles.savedText}>{t("importGuideSavedBadge")}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.phone}>
      <Image source={onboardingImages.demoKabsaSocial} resizeMode="cover" style={styles.phoneVideo} />

      {scene === "video" ? (
        // The side of the video the buttons sit on, in both languages.
        <View style={styles.rail}>
          {look.rail.map((icon) =>
            icon === look.share ? (
              <TapTarget key={icon} round>
                <View style={[styles.railButton, styles.railButtonShare]}>
                  <Feather name={icon} size={20} color="#FFFFFF" />
                </View>
              </TapTarget>
            ) : (
              <View key={icon} style={styles.railButton}>
                <Feather name={icon} size={19} color="#FFFFFF" />
              </View>
            )
          )}
        </View>
      ) : (
        <>
          <View style={styles.phoneDim} />
          <View style={styles.panel}>
            <View style={styles.panelHandle} />
            {scene === "sharePanel" ? (
              <View style={styles.panelRow}>
                {(["message-circle", "mail", "link"] as FeatherName[]).map((icon) => (
                  <PanelItem key={icon}>
                    <View style={styles.panelCircle}>
                      <Feather name={icon} size={19} color={wasfaColors.muted} />
                    </View>
                  </PanelItem>
                ))}
                <PanelItem label={t(look.panelLastKey)}>
                  <TapTarget round>
                    <View style={[styles.panelCircle, styles.panelCircleTarget]}>
                      <Feather name={look.panelLast} size={20} color="#FFFFFF" />
                    </View>
                  </TapTarget>
                </PanelItem>
              </View>
            ) : (
              <View style={styles.panelRow}>
                <PanelItem>
                  <View style={styles.panelApp} />
                </PanelItem>
                <PanelItem label={t("obShareWasfa")}>
                  <TapTarget>
                    <Image source={onboardingImages.appIcon} style={styles.panelAppIcon} />
                  </TapTarget>
                </PanelItem>
                <PanelItem>
                  <View style={styles.panelApp} />
                </PanelItem>
                <PanelItem>
                  <View style={styles.panelApp} />
                </PanelItem>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

/** One entry in a share row: its button and, under it, a name or a grey stand-in for one. */
function PanelItem({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View style={styles.panelItem}>
      {children}
      {label ? (
        <Text style={styles.panelLabel} numberOfLines={1} adjustsFontSizeToFit>
          {label}
        </Text>
      ) : (
        <View style={styles.panelLabelBar} />
      )}
    </View>
  );
}

/** Marks the thing to tap: an orange outline with a ring that keeps spreading out from it. */
function TapTarget({ round = false, children }: { round?: boolean; children: ReactNode }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const radius = round ? wasfaRadius.pill : 15;

  return (
    <View style={styles.tapTarget}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tapPulse,
          {
            borderRadius: radius,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
          },
        ]}
      />
      <View style={[styles.tapOutline, { borderRadius: radius }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  guide: {
    gap: 12,
  },
  stage: {
    height: 232,
    borderRadius: wasfaRadius.lg,
    backgroundColor: wasfaColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  stepLabel: {
    marginTop: 14,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    color: wasfaColors.cta,
  },
  latinCaps: {
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 2,
    fontSize: 21,
    lineHeight: 30,
    fontWeight: "800",
    color: wasfaColors.ink,
  },
  // Room for three lines, so the buttons below stay put from slide to slide.
  body: {
    marginTop: 4,
    minHeight: 66,
    fontSize: 15,
    lineHeight: 22,
    color: wasfaColors.muted,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: wasfaColors.line,
  },
  dotActive: {
    width: 24,
    backgroundColor: wasfaColors.primary,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    height: 54,
    borderRadius: wasfaRadius.pill,
    borderWidth: 1.5,
    borderColor: wasfaColors.line,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 16,
    fontWeight: "800",
    color: wasfaColors.ink,
  },
  nextButton: {
    flex: 1,
  },
  pasteLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
  },
  pasteText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    color: wasfaColors.primaryDark,
  },

  // The drawn phone. It is taller than the stage and stands on the stage's floor, so
  // its top is cut off and the lower half, where everything to tap is, shows large.
  phone: {
    position: "absolute",
    bottom: 14,
    width: 204,
    height: 290,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: wasfaColors.deep,
    backgroundColor: wasfaColors.deep,
    overflow: "hidden",
  },
  phoneVideo: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  phoneDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(19,36,22,0.45)",
  },
  rail: {
    position: "absolute",
    right: 14,
    bottom: 18,
    alignItems: "center",
    gap: 10,
  },
  railButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(19,36,22,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  railButtonShare: {
    backgroundColor: wasfaColors.cta,
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: wasfaColors.surface,
    paddingTop: 8,
    paddingBottom: 18,
    paddingHorizontal: 6,
    gap: 12,
  },
  panelHandle: {
    alignSelf: "center",
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: wasfaColors.line,
  },
  panelRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  panelItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  panelCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: wasfaColors.soft,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  panelCircleTarget: {
    backgroundColor: wasfaColors.cta,
    borderColor: wasfaColors.cta,
  },
  panelApp: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: wasfaColors.disabled,
  },
  panelAppIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
  },
  panelLabel: {
    maxWidth: 50,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "center",
  },
  panelLabelBar: {
    marginTop: 5,
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: wasfaColors.line,
  },
  tapTarget: {
    alignItems: "center",
    justifyContent: "center",
  },
  tapPulse: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: wasfaColors.cta,
  },
  tapOutline: {
    padding: 2,
    borderWidth: 2,
    borderColor: wasfaColors.cta,
    backgroundColor: wasfaColors.surface,
  },

  // The last slide: the mascot with the recipe it made.
  resultScene: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  resultMascot: {
    width: 104,
    height: 187,
  },
  recipeCard: {
    width: 168,
    borderRadius: 18,
    backgroundColor: wasfaColors.surface,
    padding: 10,
    gap: 7,
    ...wasfaShadow.card,
  },
  recipePhoto: {
    width: "100%",
    height: 70,
    borderRadius: 11,
  },
  recipeTitleBar: {
    width: "70%",
    height: 9,
    borderRadius: 5,
    backgroundColor: wasfaColors.ink,
    opacity: 0.85,
  },
  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recipeLine: {
    height: 6,
    borderRadius: 3,
    backgroundColor: wasfaColors.line,
  },
  savedBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: wasfaRadius.pill,
    backgroundColor: wasfaColors.primary,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  savedText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
