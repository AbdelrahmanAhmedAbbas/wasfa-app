import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { PhotoScrim } from "@/components/wasfa/PhotoScrim";
import { useLoopClock } from "@/lib/animation/useLoopClock";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { demoKabsa, demoReel } from "@/lib/onboarding/demo-data";
import {
  chipAt,
  EXPLAINER_LOOP_SECONDS,
  EXPLAINER_MASCOT_HEIGHT,
  EXPLAINER_PILL_TOP,
  EXPLAINER_RECIPE_TOP,
  EXPLAINER_SHARE_TAP,
  EXPLAINER_STAGE,
  EXPLAINER_STILL_SECONDS,
  EXPLAINER_VIDEO,
  EXPLAINER_WASFA_TAP_AT,
  MASCOT_POSE,
  mascotAt,
  pillAt,
  recipeCardAt,
  recipeLineAt,
  scanAt,
  shareSheetAt,
  tapAt,
  videoCardAt,
  type MascotFrame,
} from "@/lib/onboarding/explainer-motion";
import { scaleDemoQuantity } from "@/lib/onboarding/flow";
import { toArabicIndicDigits } from "@/lib/recipes/numerals";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";

type Clock = SharedValue<number>;

const STAGE_KEYS: TranslationKey[] = ["obStage1", "obStage2", "obStage3", "obStage4"];
const STEP_KEYS: TranslationKey[] = ["obKabsaStep1", "obKabsaStep2"];
const FLYING_CHIPS = 3;
const MAX_STAGE_SCALE = 1.25;
// How far past the screen edge the mascot waits, in stage units.
const MASCOT_OFFSCREEN_MARGIN = 70;
const SHEET_HEIGHT = 262;
const TAP_SIZE = 44;

// mascot.png is 251x592 with the artwork ending 20px above the bottom edge; the
// other two poses fill their frames. Each is laid out so its feet sit on the anchor.
const MASCOT_SPRITES = [
  { pose: MASCOT_POSE.base, source: onboardingImages.mascot, aspect: 251 / 592, grow: 592 / 557, sink: 20 / 557 },
  { pose: MASCOT_POSE.reading, source: onboardingImages.mascotReading, aspect: 341 / 612, grow: 1, sink: 0 },
  { pose: MASCOT_POSE.typing, source: onboardingImages.mascotTyping, aspect: 414 / 611, grow: 1, sink: 0 },
].map(({ grow, sink, aspect, ...sprite }) => {
  const height = EXPLAINER_MASCOT_HEIGHT * grow;
  const width = height * aspect;

  return { ...sprite, frame: { width, height, left: -width / 2, top: EXPLAINER_MASCOT_HEIGHT * sink - height } };
});

/** Drives the explainer: seconds into the 12s loop, repeating forever. */
export function useImportExplainerClock(): Clock {
  return useLoopClock(EXPLAINER_LOOP_SECONDS, EXPLAINER_STILL_SECONDS);
}

type StageProps = {
  clock: Clock;
  /** Servings the demo recipe is scaled to. */
  servings: number;
};

/**
 * The looping "video becomes a recipe" animation. Fills the space it is given
 * and scales its 390-wide stage to fit. Purely illustrative, so it takes no touches.
 */
export function ImportExplainerStage({ clock, servings }: StageProps) {
  const { isRTL, language } = useLanguage();
  const [area, setArea] = useState({ width: 0, height: 0 });

  const scale = Math.min(
    area.width / EXPLAINER_STAGE.width,
    area.height / EXPLAINER_STAGE.height,
    MAX_STAGE_SCALE
  );
  const offscreenX =
    EXPLAINER_STAGE.width / 2 + (scale > 0 ? area.width / (2 * scale) : 0) + MASCOT_OFFSCREEN_MARGIN;
  const mascot = useDerivedValue(() => mascotAt(clock.value, offscreenX), [offscreenX]);

  const num = (value: number) => (isRTL ? toArabicIndicDigits(String(value)) : String(value));
  const ingredients = demoKabsa.ingredients.slice(0, FLYING_CHIPS).map((ingredient) => ({
    name: ingredient.name[language],
    line: [
      num(scaleDemoQuantity(ingredient.quantity, servings, demoKabsa.baseServings)),
      ingredient.unit[language],
      ingredient.name[language],
    ]
      .filter(Boolean)
      .join(" "),
  }));

  return (
    <View
      style={styles.area}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={({ nativeEvent }) =>
        setArea({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })
      }
    >
      {scale > 0 ? (
        <View
          style={[
            styles.stage,
            {
              left: (area.width - EXPLAINER_STAGE.width) / 2,
              top: (area.height - EXPLAINER_STAGE.height) / 2,
              transform: [{ scale }],
            },
          ]}
        >
          <VideoCard clock={clock} />
          <ScanBand clock={clock} />
          <MascotLayer frame={mascot} behindCard />
          <RecipeCard
            clock={clock}
            servings={num(servings)}
            ingredients={ingredients.map((ingredient) => ingredient.line)}
          />
          <MascotLayer frame={mascot} behindCard={false} />
          {ingredients.map((ingredient, index) => (
            <FlyingChip key={ingredient.name} clock={clock} index={index} label={ingredient.name} />
          ))}
          {STAGE_KEYS.map((key, index) => (
            <StagePill key={key} clock={clock} index={index} labelKey={key} />
          ))}
          <TapRing
            clock={clock}
            at={EXPLAINER_SHARE_TAP.at}
            style={{ left: EXPLAINER_SHARE_TAP.x - TAP_SIZE / 2, top: EXPLAINER_SHARE_TAP.y - TAP_SIZE / 2 }}
          />
        </View>
      ) : null}
    </View>
  );
}

const RAIL: { icon: "heart" | "comment" | "share"; count?: string; centerY: number }[] = [
  { icon: "heart", count: "12.4k", centerY: 220 },
  { icon: "comment", count: "318", centerY: 275 },
  { icon: "share", centerY: 330 },
];

function VideoCard({ clock }: { clock: Clock }) {
  const { isRTL, t } = useLanguage();

  const cardStyle = useAnimatedStyle(() => {
    const card = videoCardAt(clock.value);
    return { opacity: card.opacity, transform: [{ scale: card.scale }] };
  });
  const imageStyle = useAnimatedStyle(() => ({ transform: [{ scale: videoCardAt(clock.value).zoom }] }));
  const progressStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: videoCardAt(clock.value).progress }] }));
  const shareStyle = useAnimatedStyle(() => ({ transform: [{ scale: videoCardAt(clock.value).sharePress }] }));

  return (
    <Animated.View style={[styles.video, cardStyle]}>
      <Animated.Image source={onboardingImages.demoKabsaSocial} style={[styles.videoImage, imageStyle]} />
      <PhotoScrim maxOpacity={0.78} coverage={0.475} />
      <View style={styles.videoProgressTrack}>
        <Animated.View style={[styles.videoProgress, progressStyle]} />
      </View>

      {RAIL.map(({ icon, count, centerY }) => (
        <Animated.View
          key={icon}
          style={[styles.railItem, { top: centerY - 14 }, icon === "share" && shareStyle]}
        >
          <FontAwesome name={icon} size={22} color="#FFFFFF" />
          {count ? <Text style={styles.railCount}>{count}</Text> : null}
        </Animated.View>
      ))}

      <View style={[styles.videoCopy, { direction: isRTL ? "rtl" : "ltr" }]}>
        <View style={styles.videoAuthor}>
          <View style={styles.videoAvatar}>
            <Text style={styles.videoAvatarText}>{demoReel.initials}</Text>
          </View>
          <Text style={styles.videoHandle}>{demoReel.handle}</Text>
        </View>
        <Text style={styles.videoCaption} numberOfLines={2}>
          {t("obCaption")}
        </Text>
      </View>
    </Animated.View>
  );
}

function ScanBand({ clock }: { clock: Clock }) {
  const clipStyle = useAnimatedStyle(() => ({
    opacity: scanAt(clock.value).opacity,
    transform: [{ scale: videoCardAt(clock.value).scale }],
  }));
  const bandStyle = useAnimatedStyle(() => ({ transform: [{ translateY: scanAt(clock.value).y }] }));

  return (
    <Animated.View style={[styles.scanClip, clipStyle]}>
      <Animated.View style={[styles.scanBand, bandStyle]} />
    </Animated.View>
  );
}

type RecipeCardProps = {
  clock: Clock;
  servings: string;
  ingredients: string[];
};

function RecipeCard({ clock, servings, ingredients }: RecipeCardProps) {
  const { isRTL, t } = useLanguage();

  const cardStyle = useAnimatedStyle(() => {
    const card = recipeCardAt(clock.value);
    return { opacity: card.opacity, transform: [{ translateY: card.y }] };
  });
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: recipeCardAt(clock.value).badge }] }));

  const num = (value: number) => (isRTL ? toArabicIndicDigits(String(value)) : String(value));
  const meta: { icon: "clock-o" | "users" | "fire"; label: string }[] = [
    { icon: "clock-o", label: t("obKabsaTime") },
    { icon: "users", label: servings },
    { icon: "fire", label: num(520) },
  ];
  // `first` is where the section's lines start in the reveal order.
  const sections = [
    { title: t("ingredients"), first: 0, lines: ingredients.map((line) => `• ${line}`) },
    {
      title: t("steps"),
      first: ingredients.length,
      lines: STEP_KEYS.map((key, index) => `${num(index + 1)}. ${t(key)}`),
    },
  ];

  return (
    <Animated.View style={[styles.recipe, { direction: isRTL ? "rtl" : "ltr" }, cardStyle]}>
      <View style={styles.recipeBadgeRow}>
        <Animated.View
          style={[styles.savedBadge, { transformOrigin: isRTL ? "right center" : "left center" }, badgeStyle]}
        >
          <FontAwesome name="check" size={12} color="#FFFFFF" />
          <Text style={styles.savedBadgeText}>{t("obSaved")}</Text>
        </Animated.View>
      </View>
      <Text style={[styles.recipeTitle, isRTL && styles.recipeTitleArabic]}>{t("obKabsa")}</Text>
      <Text style={styles.recipeDescription} numberOfLines={2}>
        {t("obKabsaDesc")}
      </Text>
      <View style={styles.recipeMeta}>
        {meta.map(({ icon, label }) => (
          <View key={icon} style={styles.recipeMetaChip}>
            <FontAwesome name={icon} size={13} color={onboardingColors.primaryDark} />
            <Text style={styles.recipeMetaText}>{label}</Text>
          </View>
        ))}
      </View>
      {sections.map((section) => (
        <View key={section.title} style={styles.recipeSection}>
          <Text style={styles.recipeSectionTitle}>{section.title}</Text>
          {section.lines.map((line, index) => (
            <RecipeLine key={line} clock={clock} index={section.first + index} text={line} />
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

function RecipeLine({ clock, index, text }: { clock: Clock; index: number; text: string }) {
  const style = useAnimatedStyle(() => {
    const line = recipeLineAt(clock.value, index);
    return { opacity: line.opacity, transform: [{ translateY: line.y }] };
  });

  return (
    <Animated.View style={style}>
      <Text style={styles.recipeLine} numberOfLines={1}>
        {text}
      </Text>
    </Animated.View>
  );
}

type MascotLayerProps = {
  frame: SharedValue<MascotFrame>;
  /** The mascot is drawn twice, under and over the recipe card; each copy shows only on its side. */
  behindCard: boolean;
};

function MascotLayer({ frame, behindCard }: MascotLayerProps) {
  const style = useAnimatedStyle(() => {
    const mascot = frame.value;

    return {
      opacity: mascot.behindCard === behindCard ? 1 : 0,
      transform: [
        { translateX: mascot.x },
        { translateY: mascot.y },
        { rotate: `${mascot.rotation}deg` },
        { scaleX: mascot.scale * mascot.stretchX },
        { scaleY: mascot.scale * mascot.stretchY },
      ],
    };
  });

  // All three poses stay mounted and only the active one is visible, so a
  // pose change never waits on an image decode.
  return (
    <Animated.View style={[styles.mascotAnchor, style]}>
      {MASCOT_SPRITES.map((sprite) => (
        <MascotSprite key={sprite.pose} frame={frame} sprite={sprite} />
      ))}
    </Animated.View>
  );
}

function MascotSprite({
  frame,
  sprite,
}: {
  frame: SharedValue<MascotFrame>;
  sprite: (typeof MASCOT_SPRITES)[number];
}) {
  const { pose } = sprite;
  const style = useAnimatedStyle(() => ({ opacity: frame.value.pose === pose ? 1 : 0 }));

  return <Animated.Image source={sprite.source} style={[styles.mascotSprite, sprite.frame, style]} />;
}

function FlyingChip({ clock, index, label }: { clock: Clock; index: number; label: string }) {
  const style = useAnimatedStyle(() => {
    const chip = chipAt(clock.value, index);

    return {
      opacity: chip.opacity,
      transform: [{ translateX: chip.x }, { translateY: chip.y }, { scale: chip.scale }],
    };
  });

  return (
    <Animated.View style={[styles.chipAnchor, style]}>
      <View style={styles.chip}>
        <Text style={styles.chipText}>{label}</Text>
      </View>
    </Animated.View>
  );
}

function StagePill({ clock, index, labelKey }: { clock: Clock; index: number; labelKey: TranslationKey }) {
  const { isRTL, t } = useLanguage();
  const style = useAnimatedStyle(() => {
    const pill = pillAt(clock.value);
    return { opacity: pill.index === index ? pill.opacity : 0, transform: [{ scale: pill.scale }] };
  });

  return (
    <Animated.View style={[styles.pillRow, style]}>
      <View style={[styles.pill, { direction: isRTL ? "rtl" : "ltr" }]}>
        <FontAwesome name="magic" size={14} color="#FFFFFF" />
        <Text style={styles.pillText}>{`${t(labelKey)}…`}</Text>
      </View>
    </Animated.View>
  );
}

function TapRing({ clock, at, style }: { clock: Clock; at: number; style?: StyleProp<ViewStyle> }) {
  const dotStyle = useAnimatedStyle(() => {
    const tap = tapAt(clock.value, at);
    return { opacity: tap.opacity, transform: [{ scale: tap.scale }] };
  });
  const rippleStyle = useAnimatedStyle(() => {
    const tap = tapAt(clock.value, at);
    return { opacity: tap.rippleOpacity, transform: [{ scale: tap.rippleScale }] };
  });

  return (
    <View style={[styles.tap, style]}>
      <Animated.View style={[styles.tapRing, styles.tapDot, dotStyle]} />
      <Animated.View style={[styles.tapRing, styles.tapRipple, rippleStyle]} />
    </View>
  );
}

/**
 * The stand-in system share sheet. It covers the whole screen, footer
 * included, so it is rendered as the last child of the screen rather than
 * inside the stage.
 */
export function ImportExplainerShareSheet({ clock }: { clock: Clock }) {
  const { isRTL, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const height = SHEET_HEIGHT + insets.bottom;

  const backdropStyle = useAnimatedStyle(() => ({ opacity: 0.34 * shareSheetAt(clock.value).open }));
  const sheetStyle = useAnimatedStyle(() => {
    const { open } = shareSheetAt(clock.value);
    return { opacity: open > 0 ? 1 : 0, transform: [{ translateY: (1 - open) * height }] };
  });
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: shareSheetAt(clock.value).wasfaPress }] }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.sheetBackdrop, backdropStyle]} />
      <Animated.View style={[styles.sheet, { height, direction: isRTL ? "rtl" : "ltr" }, sheetStyle]}>
        <View style={styles.sheetGrabber} />
        <Text style={styles.sheetTitle}>{t("obShareTo")}</Text>
        <View style={styles.sheetApps}>
          <View style={styles.sheetApp}>
            <View>
              <Animated.Image source={onboardingImages.appIcon} style={[styles.sheetAppIcon, iconStyle]} />
              <TapRing clock={clock} at={EXPLAINER_WASFA_TAP_AT} style={styles.sheetAppTap} />
            </View>
            <Text style={styles.sheetAppLabel}>{t("obShareWasfa")}</Text>
          </View>
          {[0, 1, 2].map((index) => (
            <View key={index} style={styles.sheetApp}>
              <View style={styles.sheetAppPlaceholder} />
              <View style={styles.sheetLabelPlaceholder} />
            </View>
          ))}
        </View>
        <View style={styles.sheetRowPlaceholder} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
  },
  // Stage coordinates are physical, so the stage itself never mirrors; the
  // blocks of copy inside it set their own direction.
  stage: {
    position: "absolute",
    width: EXPLAINER_STAGE.width,
    height: EXPLAINER_STAGE.height,
    direction: "ltr",
  },

  video: {
    position: "absolute",
    left: EXPLAINER_VIDEO.x,
    top: EXPLAINER_VIDEO.y,
    width: EXPLAINER_VIDEO.width,
    height: EXPLAINER_VIDEO.height,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: onboardingColors.text,
  },
  // The photo is square; it is centred and cropped to the portrait card.
  videoImage: {
    position: "absolute",
    left: (EXPLAINER_VIDEO.width - EXPLAINER_VIDEO.height) / 2,
    top: 0,
    width: EXPLAINER_VIDEO.height,
    height: EXPLAINER_VIDEO.height,
  },
  videoProgressTrack: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 12,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  videoProgress: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
    transformOrigin: "left center",
  },
  railItem: {
    position: "absolute",
    left: EXPLAINER_VIDEO.width - 44,
    width: 36,
    alignItems: "center",
    gap: 2,
  },
  railCount: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  videoCopy: {
    position: "absolute",
    left: 14,
    right: 56,
    bottom: 16,
    gap: 6,
  },
  videoAuthor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  videoAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: onboardingColors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  videoAvatarText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  videoHandle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
    writingDirection: "ltr",
  },
  videoCaption: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "left",
  },

  scanClip: {
    position: "absolute",
    left: EXPLAINER_VIDEO.x,
    top: EXPLAINER_VIDEO.y,
    width: EXPLAINER_VIDEO.width,
    height: EXPLAINER_VIDEO.height,
    borderRadius: 24,
    overflow: "hidden",
  },
  scanBand: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 72,
    height: 70,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: onboardingColors.teal,
    backgroundColor: "rgba(43,168,138,0.24)",
  },

  recipe: {
    position: "absolute",
    left: 22,
    right: 22,
    top: EXPLAINER_RECIPE_TOP,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
  },
  recipeBadgeRow: {
    flexDirection: "row",
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: onboardingColors.teal,
  },
  savedBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  recipeTitle: {
    marginTop: 14,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    color: onboardingColors.text,
    textAlign: "left",
  },
  // Arabic needs taller lines for its marks.
  recipeTitleArabic: {
    lineHeight: 40,
  },
  recipeDescription: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: onboardingColors.textMuted,
    textAlign: "left",
  },
  recipeMeta: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  recipeMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: onboardingColors.accent,
  },
  recipeMetaText: {
    fontSize: 12,
    fontWeight: "900",
    color: onboardingColors.primaryDark,
  },
  recipeSection: {
    marginTop: 14,
  },
  recipeSectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: onboardingColors.text,
    textAlign: "left",
  },
  recipeLine: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: onboardingColors.textMuted,
    textAlign: "left",
  },

  // A zero-size anchor at the mascot's feet, so it turns and squashes about them.
  mascotAnchor: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  },
  mascotSprite: {
    position: "absolute",
  },

  // Centred on the stage origin; the chip is then moved by its centre.
  chipAnchor: {
    position: "absolute",
    left: -100,
    top: -20,
    width: 200,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: onboardingColors.accentWarm,
    backgroundColor: onboardingColors.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "800",
    color: onboardingColors.primaryDark,
  },

  pillRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: EXPLAINER_PILL_TOP,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: onboardingColors.primaryDark,
  },
  pillText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  tap: {
    position: "absolute",
    width: TAP_SIZE,
    height: TAP_SIZE,
  },
  tapRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAP_SIZE / 2,
    borderWidth: 2,
  },
  tapDot: {
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(28,43,28,0.28)",
  },
  tapRipple: {
    borderColor: onboardingColors.primaryLight,
  },

  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#182014",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#FFFFFF",
    shadowColor: "#1F281D",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 46,
    height: 5,
    marginBottom: 14,
    borderRadius: 999,
    backgroundColor: "#D5D7CE",
  },
  sheetTitle: {
    marginBottom: 16,
    fontSize: 18,
    fontWeight: "800",
    color: onboardingColors.text,
    textAlign: "left",
  },
  sheetApps: {
    flexDirection: "row",
    gap: 22,
  },
  sheetApp: {
    width: 60,
    alignItems: "center",
    gap: 8,
  },
  sheetAppIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  sheetAppTap: {
    left: (60 - TAP_SIZE) / 2,
    top: (60 - TAP_SIZE) / 2,
  },
  sheetAppLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: onboardingColors.text,
  },
  sheetAppPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#F5F3ED",
  },
  sheetLabelPlaceholder: {
    width: 40,
    height: 8,
    marginTop: 4,
    borderRadius: 4,
    backgroundColor: "#E9E5DB",
  },
  sheetRowPlaceholder: {
    height: 48,
    marginTop: 22,
    borderRadius: 14,
    backgroundColor: "#F5F3ED",
  },
});
