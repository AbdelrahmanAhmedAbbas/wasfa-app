import { useRef } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
  type SharedValue,
} from "react-native-reanimated";

import { useLoopClock } from "@/lib/animation/useLoopClock";
import { onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors } from "@/lib/theme/wasfa";

// The artwork is drawn for this stage and scaled down when the hero gets shorter
// (small phones, or the keyboard opening over the email form).
const STAGE_WIDTH = 320;
const STAGE_HEIGHT = 250;
const MIN_SCALE = 0.45;

// logo.png is 730x357.
const LOGO_WIDTH = 232;
const LOGO_HEIGHT = Math.round(LOGO_WIDTH * (357 / 730));

// Every drift is a whole number of cycles per loop, so the loop restarts unseen.
const LOOP_SECONDS = 12;

const glow = require("../../assets/images/splash-glow.png");
const tomato = require("../../assets/images/splash-tomato.png");
const carrot = require("../../assets/images/splash-carrot.png");
const basil = require("../../assets/images/splash-basil.png");
const rice = require("../../assets/images/splash-rice.png");

type Floater = {
  source: ImageSourcePropType;
  size: number;
  /** Centre of the piece on the stage. */
  x: number;
  y: number;
  /** Resting tilt in degrees. */
  tilt: number;
  /** How far it bobs, in points, and how far it rocks, in degrees. */
  drift: number;
  sway: number;
  cycles: number;
  /** Where in its cycle it starts, 0 to 1, so the pieces never move in step. */
  phase: number;
};

// The splash's ingredients, scattered around the wordmark.
const FLOATERS: Floater[] = [
  { source: carrot, size: 46, x: 42, y: 52, tilt: -18, drift: 7, sway: 7, cycles: 3, phase: 0 },
  { source: tomato, size: 42, x: 268, y: 40, tilt: 10, drift: 8, sway: 10, cycles: 2, phase: 0.3 },
  { source: basil, size: 36, x: 290, y: 188, tilt: 28, drift: 6, sway: 9, cycles: 3, phase: 0.55 },
  { source: basil, size: 26, x: 30, y: 192, tilt: -52, drift: 6, sway: 12, cycles: 4, phase: 0.8 },
  { source: rice, size: 13, x: 150, y: 20, tilt: 24, drift: 5, sway: 20, cycles: 4, phase: 0.15 },
  { source: rice, size: 11, x: 96, y: 226, tilt: -30, drift: 4, sway: 24, cycles: 3, phase: 0.45 },
  { source: rice, size: 12, x: 226, y: 230, tilt: 48, drift: 5, sway: 20, cycles: 2, phase: 0.7 },
  { source: rice, size: 10, x: 306, y: 112, tilt: -12, drift: 4, sway: 24, cycles: 4, phase: 0.9 },
  { source: rice, size: 10, x: 12, y: 122, tilt: 60, drift: 4, sway: 22, cycles: 3, phase: 0.25 },
];

function FloatingPiece({ piece, index, clock }: { piece: Floater; index: number; clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const angle = 2 * Math.PI * ((clock.value / LOOP_SECONDS) * piece.cycles + piece.phase);

    return {
      transform: [
        { translateY: Math.sin(angle) * piece.drift },
        { translateX: Math.cos(angle) * piece.drift * 0.4 },
        { rotate: `${piece.tilt + Math.sin(angle) * piece.sway}deg` },
      ],
    };
  });

  return (
    <Animated.View
      entering={ZoomIn.delay(220 + index * 70).springify().damping(11)}
      style={[
        styles.piece,
        { left: piece.x - piece.size / 2, top: piece.y - piece.size / 2, width: piece.size, height: piece.size },
      ]}
    >
      <Animated.Image source={piece.source} resizeMode="contain" style={[styles.fill, style]} />
    </Animated.View>
  );
}

/** The wordmark on a soft plate with the splash's ingredients drifting around it. */
export function LoginHero() {
  const clock = useLoopClock(LOOP_SECONDS, 0);
  const fit = useSharedValue(1);
  const measured = useRef(false);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const next = Math.max(MIN_SCALE, Math.min(1, height / STAGE_HEIGHT, width / STAGE_WIDTH));

    // The first measure snaps into place; later ones (the keyboard) ease.
    fit.value = measured.current ? withTiming(next, { duration: 220 }) : next;
    measured.current = true;
  };

  const stageStyle = useAnimatedStyle(() => ({ transform: [{ scale: fit.value }] }));

  const logoStyle = useAnimatedStyle(() => {
    const angle = (2 * Math.PI * clock.value) / LOOP_SECONDS;

    return {
      transform: [
        { translateY: Math.sin(angle * 3) * 4 },
        { rotate: `${Math.sin(angle * 2) * 1.5}deg` },
      ],
    };
  });

  return (
    <View
      style={styles.hero}
      onLayout={handleLayout}
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Wasfa"
    >
      {/* Artwork, not text: it keeps the same layout in both directions. */}
      <Animated.View style={[styles.stage, stageStyle]}>
        <Image source={glow} resizeMode="stretch" style={styles.glow} />
        <View style={styles.warmDot} />
        <View style={styles.plate} />

        {FLOATERS.map((piece, index) => (
          <FloatingPiece key={index} piece={piece} index={index} clock={clock} />
        ))}

        <Animated.View entering={ZoomIn.duration(420).springify().damping(12)} style={styles.logoSlot}>
          <Animated.Image
            source={onboardingImages.logo}
            resizeMode="contain"
            style={[styles.fill, logoStyle]}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    minHeight: STAGE_HEIGHT * MIN_SCALE,
    alignItems: "center",
    justifyContent: "center",
  },
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    direction: "ltr",
  },
  fill: {
    width: "100%",
    height: "100%",
  },
  glow: {
    position: "absolute",
    left: -30,
    top: -34,
    width: STAGE_WIDTH + 60,
    height: STAGE_HEIGHT + 68,
  },
  plate: {
    position: "absolute",
    left: 26,
    top: 40,
    width: 268,
    height: 170,
    borderRadius: 85,
    backgroundColor: wasfaColors.warm,
    transform: [{ rotate: "-7deg" }],
  },
  warmDot: {
    position: "absolute",
    left: 206,
    top: 16,
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: wasfaColors.primarySoft,
  },
  piece: {
    position: "absolute",
  },
  logoSlot: {
    position: "absolute",
    left: (STAGE_WIDTH - LOGO_WIDTH) / 2,
    top: (STAGE_HEIGHT - LOGO_HEIGHT) / 2,
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
});
