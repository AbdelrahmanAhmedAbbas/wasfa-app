import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors } from "@/lib/theme/onboarding";

export default function GetStartedOnboardingScreen() {
  const { completeOnboarding } = useAuth();
  const { isRTL, t } = useLanguage();
  const textAlign = isRTL ? "right" : "left";

  async function finishOnboarding() {
    await completeOnboarding();
    router.replace("/(tabs)");
  }

  return (
    <OnboardingScaffold
      progress={1}
      title={t("onGetStartedTitle")}
      onBack={() => router.back()}
      onContinue={() => void finishOnboarding()}
      continueLabel={t("onGetStartedPrimaryCta")}
      footerContent={
        <Pressable style={styles.secondaryButton} onPress={() => void finishOnboarding()}>
          <Text style={styles.secondaryButtonText}>{t("onGetStartedSecondaryCta")}</Text>
        </Pressable>
      }
    >
      <View style={styles.timelineCard}>
        <StepRow
          rtl={isRTL}
          title={t("onGetStartedStepOneTitle")}
          body={t("onGetStartedStepOneBody")}
          index={1}
          textAlign={textAlign}
        />
        <StepRow
          rtl={isRTL}
          title={t("onGetStartedStepTwoTitle")}
          body={t("onGetStartedStepTwoBody")}
          index={2}
          textAlign={textAlign}
        />
        <StepRow
          rtl={isRTL}
          title={t("onGetStartedStepThreeTitle")}
          body={t("onGetStartedStepThreeBody")}
          index={3}
          textAlign={textAlign}
          isLast
        />
      </View>
    </OnboardingScaffold>
  );
}

function StepRow({
  rtl,
  title,
  body,
  index,
  textAlign,
  isLast,
}: {
  rtl: boolean;
  title: string;
  body: string;
  index: number;
  textAlign: "left" | "right";
  isLast?: boolean;
}) {
  return (
    <View style={[styles.stepRow, isLast && styles.stepRowLast]}>
      <View style={[styles.stepRowInner, rtl && styles.stepRowInnerRtl]}>
        <View style={styles.dotWrap}>
          <View style={styles.dot}>
            <Text style={styles.dotLabel}>{index}</Text>
          </View>
          {!isLast ? <View style={styles.dotLine} /> : null}
        </View>

        <View style={styles.stepTextWrap}>
          <Text style={[styles.stepTitle, { textAlign }]}>{title}</Text>
          <Text style={[styles.stepBody, { textAlign }]}>{body}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timelineCard: {
    marginTop: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    padding: 16,
  },
  stepRow: {
    paddingBottom: 12,
  },
  stepRowLast: {
    paddingBottom: 0,
  },
  stepRowInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepRowInnerRtl: {
    flexDirection: "row-reverse",
  },
  dotWrap: {
    alignItems: "center",
    width: 24,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: onboardingColors.primaryAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  dotLabel: {
    color: onboardingColors.textOnDark,
    fontSize: 11,
    fontWeight: "700",
  },
  dotLine: {
    marginTop: 4,
    width: 2,
    flex: 1,
    minHeight: 30,
    backgroundColor: "#D7CFBF",
  },
  stepTextWrap: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: onboardingColors.text,
  },
  stepBody: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: onboardingColors.textMuted,
    fontWeight: "500",
  },
  secondaryButton: {
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: onboardingColors.textMuted,
    textDecorationLine: "underline",
  },
});
