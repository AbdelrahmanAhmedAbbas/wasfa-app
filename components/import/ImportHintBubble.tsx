import Feather from "@expo/vector-icons/Feather";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { TAB_BAR_HEIGHT, wasfaColors, wasfaRadius, wasfaShadow } from "@/lib/theme/wasfa";

const ARROW_SIZE = 16;

type ImportHintBubbleProps = {
  /** Opens the import sheet, where the step-by-step guides are. */
  onOpen: () => void;
  onDismiss: () => void;
};

/**
 * The note that sits over the tab bar's add button until the reader has opened the
 * import sheet once: it says what the button is for and that the guides are behind it.
 * Lay it out at the end of the row the button closes, so its arrow lands on the button.
 */
export function ImportHintBubble({ onOpen, onDismiss }: ImportHintBubbleProps) {
  const { t, isRTL } = useLanguage();
  const text = { textAlign: "left", writingDirection: isRTL ? "rtl" : "ltr" } as const;

  return (
    <Animated.View entering={FadeInDown.duration(260).delay(500)} exiting={FadeOut.duration(140)} style={styles.wrap}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.bubble}>
        <View style={styles.copy}>
          <Text style={[styles.title, text]}>{t("importHintTitle")}</Text>
          <Text style={[styles.body, text]}>{t("importHintBody")}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("importSheetClose")}
          hitSlop={10}
          onPress={onDismiss}
          style={styles.close}
        >
          <Feather name="x" size={15} color={wasfaColors.onDeep} />
        </Pressable>
      </Pressable>
      <View style={styles.arrow} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: 290,
    marginBottom: 14,
  },
  bubble: {
    ...wasfaShadow.floating,
    borderRadius: wasfaRadius.lg,
    backgroundColor: wasfaColors.deep,
    paddingVertical: 12,
    paddingStart: 16,
    paddingEnd: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  copy: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: wasfaColors.onDeep,
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    color: wasfaColors.onDeepSoft,
  },
  close: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  // A square turned on its corner, half tucked under the bubble, over the middle of the add button.
  arrow: {
    position: "absolute",
    bottom: -ARROW_SIZE / 2 + 1,
    end: (TAB_BAR_HEIGHT - ARROW_SIZE) / 2,
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    borderRadius: 3,
    backgroundColor: wasfaColors.deep,
    transform: [{ rotate: "45deg" }],
  },
});
