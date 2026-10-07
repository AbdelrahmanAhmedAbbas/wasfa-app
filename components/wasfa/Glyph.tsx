import { Image, StyleSheet, View, type ImageStyle, type StyleProp } from "react-native";

import { glyphSources } from "@/lib/theme/glyph-sources";
import { getFoodGlyph, type GlyphName } from "@/lib/theme/glyphs";
import { wasfaColors } from "@/lib/theme/wasfa";

type GlyphProps = {
  name: GlyphName;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** One full-colour pictogram from the app's set. */
export function Glyph({ name, size = 20, style }: GlyphProps) {
  return (
    <Image
      source={glyphSources[name]}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
    />
  );
}

type FoodIconTileProps = {
  /** Ingredient name used to pick the glyph. */
  name: string;
  size?: number;
};

/** Framed tile with an ingredient's glyph, used on ingredient and grocery rows. */
export function FoodIconTile({ name, size = 46 }: FoodIconTileProps) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size * 0.3) }]}>
      <Glyph name={getFoodGlyph(name)} size={Math.round(size * 0.6)} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderWidth: 1,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.soft,
    alignItems: "center",
    justifyContent: "center",
  },
});
