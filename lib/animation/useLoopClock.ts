import { useEffect } from "react";
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

/**
 * Seconds into a loop that repeats forever, for animations written as a pure
 * function of time. With reduced motion on it holds at `stillSeconds` instead.
 */
export function useLoopClock(loopSeconds: number, stillSeconds: number): SharedValue<number> {
  const reduceMotion = useReducedMotion();
  const clock = useSharedValue(reduceMotion ? stillSeconds : 0);

  useEffect(() => {
    if (reduceMotion) {
      clock.value = stillSeconds;
      return;
    }

    clock.value = 0;
    clock.value = withRepeat(
      withTiming(loopSeconds, { duration: loopSeconds * 1000, easing: Easing.linear }),
      -1
    );

    return () => cancelAnimation(clock);
  }, [clock, loopSeconds, reduceMotion, stillSeconds]);

  return clock;
}
