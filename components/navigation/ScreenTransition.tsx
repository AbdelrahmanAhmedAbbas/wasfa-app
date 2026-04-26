import { useEffect, type ReactNode } from "react";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { StyleProp, ViewStyle } from "react-native";

type ScreenTransitionProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const ENTER_EASING = Easing.bezier(0.22, 1, 0.36, 1);

export function ScreenTransition({ children, style }: ScreenTransitionProps) {
  const isFocused = useIsFocused();
  const reduceMotionEnabled = useReducedMotion();
  const progress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isFocused ? 1 : 0, {
      duration: reduceMotionEnabled ? 0 : 280,
      easing: ENTER_EASING,
      reduceMotion: ReduceMotion.System,
    });
  }, [isFocused, progress, reduceMotionEnabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotionEnabled
      ? [{ scale: 1 }]
      : [
          { translateY: (1 - progress.value) * 12 },
          { scale: 0.985 + progress.value * 0.015 },
        ],
  }));

  return <Animated.View style={[{ flex: 1 }, style, animatedStyle]}>{children}</Animated.View>;
}
