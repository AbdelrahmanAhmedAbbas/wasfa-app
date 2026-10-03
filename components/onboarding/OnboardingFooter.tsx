import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { wasfaColors } from "@/lib/theme/wasfa";

type OnboardingFooterProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Pinned bottom area that holds the primary CTA of an onboarding step. */
export function OnboardingFooter({ children, style }: OnboardingFooterProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 8, 30) }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 8,
    backgroundColor: wasfaColors.background,
  },
});
