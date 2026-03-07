import { ReactNode } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors } from "@/lib/theme/onboarding";

type Props = {
  progress: number;
  progressStyle?: "bar" | "dots";
  totalSteps?: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  showContinueButton?: boolean;
  titleVariant?: "hero" | "normal";
  footerContent?: ReactNode;
  children: ReactNode;
};

export function OnboardingScaffold({
  progress,
  progressStyle = "bar",
  totalSteps = 5,
  title,
  subtitle,
  onBack,
  onContinue,
  continueLabel,
  continueDisabled,
  showContinueButton = true,
  titleVariant = "normal",
  footerContent,
  children,
}: Props) {
  const { isRTL, t } = useLanguage();
  const textAlign = isRTL ? "right" : "left";
  const align = isRTL ? "flex-end" : "flex-start";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onBack} disabled={!onBack} style={styles.backButton}>
          <FontAwesome
            name={isRTL ? "chevron-right" : "chevron-left"}
            size={18}
            style={[styles.backIcon, !onBack && styles.backDisabled]}
          />
        </Pressable>
        {progressStyle === "dots" ? (
          <View style={styles.dotsWrap}>
            {Array.from({ length: totalSteps }).map((_, index) => {
              const isActive = index <= Math.round(Math.max(0, Math.min(progress, 1)) * (totalSteps - 1));
              return <View key={index} style={[styles.dot, isActive && styles.dotActive]} />;
            })}
          </View>
        ) : (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(0, Math.min(progress, 1)) * 100}%` },
              ]}
            />
          </View>
        )}
        <View style={styles.rightSpace} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {title ? (
          <Text
            style={[
              styles.title,
              titleVariant === "hero" ? styles.titleHero : styles.titleNormal,
              { textAlign, alignSelf: align },
            ]}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[styles.subtitle, { textAlign, alignSelf: align }]}>{subtitle}</Text>
        ) : null}

        {children}
      </ScrollView>

      <View style={styles.footer}>
        {footerContent}
        {showContinueButton ? (
          <Pressable
            style={[styles.continueButton, continueDisabled && styles.continueButtonDisabled]}
            onPress={onContinue}
            disabled={continueDisabled}
          >
            <Text style={styles.continueText}>{continueLabel ?? t("commonContinue")}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: onboardingColors.backgroundBase,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  backIcon: {
    color: onboardingColors.textMuted,
  },
  backDisabled: {
    opacity: 0.45,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E6DFD3",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: onboardingColors.primaryAccent,
    borderRadius: 999,
  },
  dotsWrap: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#D2CBC1",
  },
  dotActive: {
    backgroundColor: onboardingColors.primary,
  },
  rightSpace: {
    width: 36,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  title: {
    color: onboardingColors.primaryDark,
  },
  titleHero: {
    fontSize: 52,
    lineHeight: 56,
    fontWeight: "900",
    letterSpacing: -1,
  },
  titleNormal: {
    fontSize: 45,
    lineHeight: 47,
    fontWeight: "900",
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 19,
    lineHeight: 25,
    color: onboardingColors.textMuted,
    fontWeight: "500",
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  continueButton: {
    borderRadius: 26,
    backgroundColor: onboardingColors.primary,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueText: {
    fontSize: 19,
    fontWeight: "700",
    color: onboardingColors.textOnDark,
    letterSpacing: 0,
  },
});
