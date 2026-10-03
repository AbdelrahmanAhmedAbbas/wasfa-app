import Feather from "@expo/vector-icons/Feather";
import { StyleSheet, View } from "react-native";

import { wasfaColors } from "@/lib/theme/wasfa";

type CheckBoxProps = {
  checked: boolean;
  /** "square" is the orange action check; "round" is the green progress check. */
  variant?: "square" | "round";
  size?: number;
};

export function CheckBox({ checked, variant = "square", size }: CheckBoxProps) {
  const isRound = variant === "round";
  const boxSize = size ?? (isRound ? 26 : 30);
  const activeColor = isRound ? wasfaColors.primary : wasfaColors.cta;

  return (
    <View
      style={[
        styles.box,
        {
          width: boxSize,
          height: boxSize,
          borderRadius: isRound ? boxSize / 2 : 10,
          borderColor: checked ? activeColor : isRound ? wasfaColors.line : wasfaColors.checkBorder,
          backgroundColor: checked ? activeColor : isRound ? "transparent" : wasfaColors.surface,
        },
      ]}
    >
      {checked ? <Feather name="check" size={Math.round(boxSize * 0.55)} color="#FFFFFF" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
