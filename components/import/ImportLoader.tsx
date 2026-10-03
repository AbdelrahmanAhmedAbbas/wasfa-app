import FontAwesome from "@expo/vector-icons/FontAwesome";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from "react-native-reanimated";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { useLoopClock } from "@/lib/animation/useLoopClock";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import {
  LOADER_LOOP_SECONDS,
  LOADER_PAGE,
  LOADER_PEN,
  LOADER_READING,
  LOADER_READING_SCALE,
  LOADER_ROWS,
  LOADER_SIZE,
  LOADER_SPARKS,
  LOADER_SPINE,
  LOADER_STILL_SECONDS,
  LOADER_TYPING,
  LOADER_TYPING_SCALE,
  loaderBeatAt,
  loaderBodyAt,
  loaderChipAt,
  loaderPageAt,
  loaderPenAt,
  loaderRowAt,
  loaderShadowAt,
  loaderSparkAt,
  type LoaderBody,
} from "@/lib/import/loader-motion";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";

type Clock = SharedValue<number>;
type Body = SharedValue<LoaderBody>;

const CHIP_KEYS: TranslationKey[] = ["importLoaderChip1", "importLoaderChip2", "importLoaderChip3"];
const SPARK_COLORS = ["#F5A623", "#F3D179", "#7BAD6E", "#2BA88A", "#F5A623", "#7BAD6E"];
const SPARK_SIZE = 11;
const SHADOW_HEIGHT = 14;
const SHADOW_WIDTH = 110;
const LINE_WIDTHS = { first: 35, second: 31 };
const PAGE_COLOR = [253, 241, 222];

/**
 * The import loader: the mascot reads the recipe and turns pages, ingredient
 * chips float out of the book, then it writes each one onto its clipboard.
 * A fixed 250pt square that loops on its own; chips drift a little outside it.
 */
export function ImportLoader({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useLanguage();
  const clock = useLoopClock(LOADER_LOOP_SECONDS, LOADER_STILL_SECONDS);
  const body = useDerivedValue(() => loaderBodyAt(clock.value));

  const shadowStyle = useAnimatedStyle(() => {
    const shadow = loaderShadowAt(body.value);

    return {
      opacity: shadow.opacity,
      transform: [{ scaleX: (SHADOW_WIDTH / SHADOW_HEIGHT) * shadow.scale }, { scaleY: shadow.scale }],
    };
  });
  const bodyStyle = useAnimatedStyle(() => {
    const { y, rotation, stretchX, stretchY } = body.value;

    return {
      transform: [{ translateY: y }, { rotate: `${rotation}deg` }, { scaleX: stretchX }, { scaleY: stretchY }],
    };
  });
  // Both poses stay mounted and swap at the top of the hop between beats.
  const readingStyle = useAnimatedStyle(() => ({ opacity: loaderBeatAt(clock.value) === 0 ? 1 : 0 }));
  const typingStyle = useAnimatedStyle(() => ({ opacity: loaderBeatAt(clock.value) === 1 ? 1 : 0 }));

  return (
    <View
      style={[styles.box, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.shadow, shadowStyle]} />

      <Animated.View style={[styles.bodyAnchor, bodyStyle]}>
        <Animated.View style={[styles.pose, styles.readingPose, readingStyle]}>
          <Animated.Image source={onboardingImages.mascotReading} style={styles.poseImage} />
          <TurningPage clock={clock} />
        </Animated.View>
        <Animated.View style={[styles.pose, styles.typingPose, typingStyle]}>
          <Animated.Image source={onboardingImages.mascotTypingBase} style={styles.poseImage} />
          {LOADER_ROWS.map((_, index) => (
            <ChecklistRow key={index} clock={clock} index={index} />
          ))}
          <Pen clock={clock} />
        </Animated.View>
      </Animated.View>

      {Array.from({ length: LOADER_SPARKS }, (_, index) => (
        <Spark key={index} clock={clock} body={body} index={index} />
      ))}
      {CHIP_KEYS.map((key, index) => (
        <Chip key={key} clock={clock} body={body} index={index} label={t(key)} />
      ))}
    </View>
  );
}

function TurningPage({ clock }: { clock: Clock }) {
  const style = useAnimatedStyle(() => {
    const page = loaderPageAt(clock.value);
    const [r, g, b] = PAGE_COLOR;

    return {
      opacity: page.visible ? 1 : 0,
      backgroundColor: `rgb(${Math.round(r * page.shade)},${Math.round(g * page.shade)},${Math.round(b * page.shade)})`,
      transform: [{ rotate: `${page.angle}rad` }, { scaleX: page.length / LOADER_PAGE.width }],
    };
  });

  return <Animated.View style={[styles.page, style]} />;
}

function ChecklistRow({ clock, index }: { clock: Clock; index: number }) {
  const row = LOADER_ROWS[index];
  const firstLineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: loaderRowAt(clock.value, index).firstLine }],
  }));
  const secondLineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: loaderRowAt(clock.value, index).secondLine }],
  }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: loaderRowAt(clock.value, index).check }] }));

  return (
    <>
      <Animated.View
        style={[styles.line, { left: row.x + 20, top: row.y - 8, width: LINE_WIDTHS.first }, firstLineStyle]}
      />
      <Animated.View
        style={[styles.line, { left: row.x + 20, top: row.y + 1, width: LINE_WIDTHS.second }, secondLineStyle]}
      />
      <Animated.View style={[styles.check, { left: row.x - 11, top: row.y - 11 }, checkStyle]}>
        <FontAwesome name="check" size={11} color={onboardingColors.primary} />
      </Animated.View>
    </>
  );
}

function Pen({ clock }: { clock: Clock }) {
  const style = useAnimatedStyle(() => {
    const pen = loaderPenAt(clock.value);
    return { transform: [{ translateX: pen.x }, { translateY: pen.y }, { rotate: `${pen.rotation}deg` }] };
  });

  return <Animated.Image source={onboardingImages.mascotTypingPen} style={[styles.pen, style]} />;
}

function Spark({ clock, body, index }: { clock: Clock; body: Body; index: number }) {
  const diamond = index % 2 === 1;
  const style = useAnimatedStyle(() => {
    const spark = loaderSparkAt(clock.value, index, body.value.y);

    return {
      opacity: spark.opacity,
      transform: [
        { translateX: spark.x },
        { translateY: spark.y },
        { scale: spark.size / SPARK_SIZE },
        { rotate: diamond ? "45deg" : "0deg" },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.spark,
        { backgroundColor: SPARK_COLORS[index % SPARK_COLORS.length], borderRadius: diamond ? 2 : SPARK_SIZE / 2 },
        style,
      ]}
    />
  );
}

function Chip({ clock, body, index, label }: { clock: Clock; body: Body; index: number; label: string }) {
  const style = useAnimatedStyle(() => {
    const chip = loaderChipAt(clock.value, index, body.value.y);

    return {
      opacity: chip.opacity,
      transform: [
        { translateX: chip.x },
        { translateY: chip.y },
        { rotate: `${chip.rotation}deg` },
        { scale: chip.scale },
      ],
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

const styles = StyleSheet.create({
  // Everything inside is placed in physical coordinates, so the box never mirrors.
  box: {
    width: LOADER_SIZE,
    height: LOADER_SIZE,
    direction: "ltr",
  },
  // A small circle stretched sideways into an ellipse under the mascot's feet.
  shadow: {
    position: "absolute",
    left: (LOADER_SIZE - SHADOW_HEIGHT) / 2,
    top: LOADER_SIZE - 6,
    width: SHADOW_HEIGHT,
    height: SHADOW_HEIGHT,
    borderRadius: SHADOW_HEIGHT / 2,
    backgroundColor: onboardingColors.primaryDark,
  },
  // A zero-size anchor at the mascot's feet, so it leans and squashes about them.
  bodyAnchor: {
    position: "absolute",
    left: LOADER_SIZE / 2,
    top: LOADER_SIZE,
    width: 0,
    height: 0,
  },
  // Each pose is laid out at its image's pixel size, so the page, pen and
  // checklist can be placed in image pixels, then scaled down to the box.
  pose: {
    position: "absolute",
    transformOrigin: "bottom",
  },
  readingPose: {
    left: -LOADER_READING.width / 2,
    top: -LOADER_READING.height,
    width: LOADER_READING.width,
    height: LOADER_READING.height,
    transform: [{ scale: LOADER_READING_SCALE }],
  },
  typingPose: {
    left: -LOADER_TYPING.width / 2,
    top: -LOADER_TYPING.height,
    width: LOADER_TYPING.width,
    height: LOADER_TYPING.height,
    transform: [{ scale: LOADER_TYPING_SCALE }],
  },
  poseImage: {
    width: "100%",
    height: "100%",
  },
  page: {
    position: "absolute",
    left: LOADER_SPINE.x,
    top: LOADER_SPINE.y - 5 - LOADER_PAGE.height / 2,
    width: LOADER_PAGE.width,
    height: LOADER_PAGE.height,
    borderRadius: 6,
    borderWidth: 3.5,
    borderColor: "#F0C49B",
    transformOrigin: "left center",
  },
  line: {
    position: "absolute",
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CDBFA9",
    transformOrigin: "left center",
  },
  check: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: "#8DB97C",
    backgroundColor: "#EEF6E6",
    alignItems: "center",
    justifyContent: "center",
  },
  pen: {
    position: "absolute",
    left: LOADER_PEN.x,
    top: LOADER_PEN.y,
    width: LOADER_PEN.width,
    height: LOADER_PEN.height,
    transformOrigin: [LOADER_PEN.pivotX, LOADER_PEN.pivotY, 0],
  },

  spark: {
    position: "absolute",
    left: -SPARK_SIZE / 2,
    top: -SPARK_SIZE / 2,
    width: SPARK_SIZE,
    height: SPARK_SIZE,
  },
  // Centred on the box origin; the chip is then moved by its centre.
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
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: onboardingColors.accentWarm,
    backgroundColor: onboardingColors.accent,
    shadowColor: onboardingColors.text,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    color: onboardingColors.primaryDark,
  },
});
