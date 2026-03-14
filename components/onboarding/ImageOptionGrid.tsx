import { Image, Pressable, StyleSheet, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { onboardingColors } from "@/lib/theme/onboarding";

type Option = {
  id: string;
  label: string;
  image: number;
};

type Props = {
  options: Option[];
  selected: string[];
  onToggle: (id: string) => void;
  maxSelect?: number;
};

export function ImageOptionGrid({ options, selected, onToggle, maxSelect }: Props) {
  const isAtLimit = maxSelect !== undefined && selected.length >= maxSelect;

  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        const isDisabled = !isSelected && isAtLimit;

        return (
          <Pressable
            key={option.id}
            style={[
              styles.optionCard,
              isSelected && styles.optionCardSelected,
              isDisabled && styles.optionCardDisabled,
            ]}
            onPress={() => !isDisabled && onToggle(option.id)}
            disabled={isDisabled}
          >
            <Image source={option.image} style={styles.optionImage} resizeMode="cover" />
            <View style={styles.optionLabelContainer}>
              <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                {option.label}
              </Text>
            </View>
            {isSelected && (
              <View style={styles.checkmarkBadge}>
                <FontAwesome name="check" size={10} color={onboardingColors.textOnDark} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
  },
  optionCard: {
    width: "47%",
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: onboardingColors.border,
    overflow: "hidden",
    backgroundColor: onboardingColors.card,
  },
  optionCardSelected: {
    borderColor: "#F5A623",
  },
  optionCardDisabled: {
    opacity: 0.5,
  },
  optionImage: {
    width: "100%",
    height: "70%",
  },
  optionLabelContainer: {
    padding: 8,
    alignItems: "center",
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: onboardingColors.text,
  },
  optionLabelSelected: {
    color: onboardingColors.primaryDark,
  },
  checkmarkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F5A623",
    alignItems: "center",
    justifyContent: "center",
  },
});
