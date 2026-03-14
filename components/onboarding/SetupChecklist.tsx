import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { onboardingColors } from "@/lib/theme/onboarding";

type ChecklistItem = {
  label: string;
  done: boolean;
};

type Props = {
  items: ChecklistItem[];
};

function ChecklistRow({ label, done }: { label: string; done: boolean }) {
  const opacity = useSharedValue(done ? 1 : 0);
  const scale = useSharedValue(done ? 1 : 0.5);

  useEffect(() => {
    opacity.value = withTiming(done ? 1 : 0, { duration: 300 });
    scale.value = withTiming(done ? 1 : 0.5, { duration: 300 });
  }, [done]);

  const checkmarkStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const textColor = done ? onboardingColors.teal : onboardingColors.textMuted;

  return (
    <View style={styles.row}>
      <View style={styles.checkContainer}>
        {done ? (
          <Animated.View style={[styles.checkmarkCircle, checkmarkStyle]}>
            <FontAwesome name="check" size={12} color="#FFFFFF" />
          </Animated.View>
        ) : (
          <View style={styles.emptyCircle} />
        )}
      </View>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

export function SetupChecklist({ items }: Props) {
  return (
    <View style={styles.container}>
      {items.map((item, index) => (
        <ChecklistRow key={index} label={item.label} done={item.done} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkContainer: {
    width: 28,
    height: 28,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: onboardingColors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: onboardingColors.border,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
});
