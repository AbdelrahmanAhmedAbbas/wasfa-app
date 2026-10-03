import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors } from "@/lib/theme/wasfa";

// mascot.png is 251x592.
export const MASCOT_ASPECT = 251 / 592;

type MascotBadgeProps = {
  size: number;
  /** Corner radius; defaults to a full circle. */
  radius?: number;
  /** Height of the mascot image; it is taller than the badge so the legs are cropped. */
  imageHeight?: number;
  /** How far the mascot sinks below the bottom edge. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
};

/** The mascot peeking out of a soft-green badge (avatars, app tile, language header). */
export function MascotBadge({ size, radius, imageHeight, offset, style }: MascotBadgeProps) {
  const height = imageHeight ?? Math.round(size * 1.12);
  const sink = offset ?? Math.round(size * 0.3);

  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: radius ?? size / 2 },
        style,
      ]}
    >
      <Image
        source={onboardingImages.mascot}
        resizeMode="contain"
        style={{ height, width: height * MASCOT_ASPECT, marginBottom: -sink }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: wasfaColors.primarySoft,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
});
