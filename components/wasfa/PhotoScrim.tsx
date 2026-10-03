import { Image, StyleSheet } from "react-native";

type PhotoScrimProps = {
  /** Opacity reached at the bottom edge. */
  maxOpacity?: number;
  /** Fraction of the photo height the fade covers, from the bottom. */
  coverage?: number;
};

/**
 * Bottom-up dark fade for text over photos. The app has no gradient
 * dependency, so this stretches a small transparent-to-black image.
 */
export function PhotoScrim({ maxOpacity = 0.7, coverage = 0.55 }: PhotoScrimProps) {
  return (
    <Image
      source={require("../../assets/images/scrim-gradient.png")}
      resizeMode="stretch"
      style={[styles.scrim, { height: `${coverage * 100}%`, opacity: maxOpacity }]}
    />
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
  },
});
