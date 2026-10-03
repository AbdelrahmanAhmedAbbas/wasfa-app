import { StyleSheet, Text, View } from "react-native";

import { getFoodEmoji } from "@/lib/theme/food-emoji";
import { wasfaColors } from "@/lib/theme/wasfa";

type FoodEmojiTileProps = {
  /** Ingredient name used to pick the emoji. */
  name: string;
  size?: number;
};

/** Round warm tile with a food emoji, used on ingredient and grocery rows. */
export function FoodEmojiTile({ name, size = 46 }: FoodEmojiTileProps) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontSize: Math.round(size * 0.52) }}>{getFoodEmoji(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: wasfaColors.warm,
    alignItems: "center",
    justifyContent: "center",
  },
});
