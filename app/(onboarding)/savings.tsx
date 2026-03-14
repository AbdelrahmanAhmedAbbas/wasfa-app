import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors } from "@/lib/theme/onboarding";
import { setOnboardingStep } from "@/lib/onboarding/storage";

const onboardingChartImage = require("../../assets/images/onboarding-chart.png");

export default function SavingsOnboardingScreen() {
  const { t } = useLanguage();

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    await setOnboardingStep(2);
    router.push("/(onboarding)/diet");
  };

  return (
    <OnboardingScaffold
      heroImage={onboardingChartImage}
      title={t("onStep2Title")}
      subtitle={t("onStep2Subtitle")}
      onBack={handleBack}
      onContinue={handleContinue}
    >
      <View style={styles.content} />
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
