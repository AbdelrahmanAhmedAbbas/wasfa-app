import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocalizedText as Text } from "@/components/LocalizedText";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors } from "@/lib/theme/onboarding";

type BottomDrawerProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  bottomOffset?: number;
  sideInset?: number;
  backdropOpacity?: number;
  showCloseButton?: boolean;
  showHandle?: boolean;
  dockToBottom?: boolean;
  /** Lift the sheet above the keyboard. Only needed by sheets that contain a text field. */
  avoidKeyboard?: boolean;
  sheetStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

const ANIMATION_DURATION = 240;

export function BottomDrawer({
  visible,
  onClose,
  title,
  children,
  bottomOffset = 0,
  sideInset = 14,
  backdropOpacity = 0.34,
  showCloseButton = false,
  showHandle = true,
  dockToBottom = false,
  avoidKeyboard = false,
  sheetStyle,
  contentStyle,
}: BottomDrawerProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { isRTL } = useLanguage();
  const direction = isRTL ? "rtl" : "ltr";
  const textAlign = "left";
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: ANIMATION_DURATION - 40,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setMounted(false);
      }
    });
  }, [progress, visible]);

  const backdropAnimatedStyle = useMemo(
    () => ({
      opacity: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, backdropOpacity],
      }),
    }),
    [backdropOpacity, progress]
  );

  const sheetAnimatedStyle = useMemo(
    () => ({
      opacity: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.92, 1],
      }),
      transform: [
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [windowHeight, 0],
          }),
        },
      ],
    }),
    [progress, windowHeight]
  );

  if (!mounted) return null;

  const body = (
    <>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View
            pointerEvents="none"
            style={[styles.backdrop, backdropAnimatedStyle]}
          />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            sheetAnimatedStyle,
            {
              marginHorizontal: sideInset,
              marginBottom: dockToBottom ? 0 : Math.max(insets.bottom, 8) + bottomOffset,
              paddingBottom: Math.max(insets.bottom, 18),
            },
            dockToBottom && styles.dockedSheet,
            sheetStyle,
          ]}
        >
          {showHandle ? <View style={styles.handle} /> : null}

          {title || showCloseButton ? (
            <View style={styles.header}>
              <Text style={[styles.title, { textAlign }]}>{title ?? ""}</Text>
              {showCloseButton ? (
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <FontAwesome name="times" size={18} color={onboardingColors.textMuted} />
                </Pressable>
              ) : (
                <View style={styles.closeButtonSpacer} />
              )}
            </View>
          ) : null}

          <View style={contentStyle}>{children}</View>
        </Animated.View>
    </>
  );

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {avoidKeyboard ? (
        <KeyboardAvoidingView behavior="padding" style={[styles.root, { direction }]}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.root, { direction }]}>{body}</View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#182014",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: "#1F281D",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 14,
  },
  dockedSheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  handle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D5D7CE",
    alignSelf: "center",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: onboardingColors.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F3ED",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonSpacer: {
    width: 36,
    height: 36,
  },
});
