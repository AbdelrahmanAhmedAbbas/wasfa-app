import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { wasfaColors, wasfaShadow } from "@/lib/theme/wasfa";

type CtaButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Rendered before the label (e.g. an icon). */
  leading?: ReactNode;
  /** Rendered after the label (e.g. a directional arrow). */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** The orange pill used for every primary action in the redesign. */
export function CtaButton({ label, onPress, disabled, loading, leading, trailing, style }: CtaButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.buttonDisabled : wasfaShadow.cta,
        pressed && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          {leading}
          <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
          {trailing}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 999,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: wasfaColors.cta,
  },
  buttonDisabled: {
    backgroundColor: wasfaColors.disabled,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  labelDisabled: {
    color: wasfaColors.disabledText,
  },
});
