import { Pressable, StyleSheet, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { onboardingColors } from "@/lib/theme/onboarding";

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: string;
  emoji?: string;
  subtitle?: string;
  children?: React.ReactNode;
};

export function SelectionCard({ label, selected, onPress, icon, emoji, subtitle, children }: Props) {
  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
    >
      <View style={styles.content}>
        {emoji ? (
          <Text style={styles.emoji}>{emoji}</Text>
        ) : icon ? (
          <Text style={styles.icon}>{icon}</Text>
        ) : null}
        <View style={styles.textContainer}>
          <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          {children}
        </View>
      </View>
      {selected && (
        <View style={styles.checkmarkBadge}>
          <FontAwesome name="check" size={12} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: onboardingColors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: onboardingColors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  cardSelected: {
    borderColor: "#F5A623",
    backgroundColor: onboardingColors.accent,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  emoji: {
    fontSize: 24,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: onboardingColors.text,
  },
  labelSelected: {
    color: onboardingColors.primaryDark,
  },
  subtitle: {
    fontSize: 13,
    color: onboardingColors.textSecondary,
    marginTop: 2,
  },
  checkmarkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#F5A623",
    alignItems: "center",
    justifyContent: "center",
  },
});
