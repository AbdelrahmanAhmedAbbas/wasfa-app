import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors } from "@/lib/theme/onboarding";
import { saveOnboardingAnswers } from "@/lib/onboarding/answers";
import { setOnboardingStep } from "@/lib/onboarding/storage";

const SOURCE_OPTIONS = [
  { id: "invite_code" as const },
  { id: "instagram" as const },
  { id: "facebook" as const },
  { id: "app_store" as const },
  { id: "tiktok" as const },
  { id: "friend" as const },
];

export default function SourceScreen() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);

  const handleSelect = (id: string) => {
    setSelected(id);
    if (id === "invite_code") {
      setShowCodeInput(true);
    } else {
      setShowCodeInput(false);
      setInviteCode("");
    }
  };

  const handleContinue = async () => {
    await saveOnboardingAnswers({
      referralSource: selected as any,
      inviteCode: selected === "invite_code" ? inviteCode || null : null,
    });
    await setOnboardingStep(5);
    router.push("/(onboarding)/age");
  };

  const getOptionLabel = (id: string) => {
    switch (id) {
      case "invite_code": return t("sourceInviteCode");
      case "instagram": return t("sourceInstagram");
      case "facebook": return t("sourceFacebook");
      case "app_store": return t("sourceAppStore");
      case "tiktok": return t("sourceTikTok");
      case "friend": return t("sourceFriend");
      default: return id;
    }
  };

  return (
    <OnboardingScaffold
      title={t("onStep5Title")}
      onBack={() => router.back()}
      onContinue={handleContinue}
      continueDisabled={false}
    >
      <View style={styles.container}>
        {SOURCE_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          return (
            <View key={option.id}>
              <Pressable
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => handleSelect(option.id)}
              >
                <View style={styles.optionContent}>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {getOptionLabel(option.id)}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkmark}>
                      <FontAwesome name="check" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>
              </Pressable>
              {option.id === "invite_code" && isSelected && showCodeInput && (
                <TextInput
                  style={styles.codeInput}
                  placeholder={t("sourceInviteCodePlaceholder")}
                  placeholderTextColor={onboardingColors.textPlaceholder}
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  autoCapitalize="characters"
                />
              )}
            </View>
          );
        })}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    gap: 10,
  },
  optionCard: {
    backgroundColor: onboardingColors.card,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: onboardingColors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionCardSelected: {
    borderColor: "#F5A623",
    backgroundColor: onboardingColors.accent,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: onboardingColors.text,
    flex: 1,
  },
  optionLabelSelected: {
    color: onboardingColors.primaryDark,
  },
  checkmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#F5A623",
    alignItems: "center",
    justifyContent: "center",
  },
  codeInput: {
    marginTop: 8,
    marginHorizontal: 4,
    backgroundColor: onboardingColors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: onboardingColors.text,
  },
});
