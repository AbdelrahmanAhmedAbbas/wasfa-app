import { ReactNode } from "react";
import { Image, ImageSourcePropType, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors } from "@/lib/theme/onboarding";

type Props = {
  title: string;
  subtitle?: string;
  heroImage?: ImageSourcePropType;
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
  title,
  subtitle,
  heroImage,
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

      {heroImage && (
        <Image source={heroImage} style={styles.heroImage} resizeMode="cover" />
      )}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          heroImage ? styles.contentNoTopPadding : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
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
        <View style={styles.footerButtonsRow}>
          {onBack ? (
            <Pressable onPress={onBack} style={styles.footerBackButton}>
              <FontAwesome
                name={isRTL ? "chevron-right" : "chevron-left"}
                size={18}
                style={styles.backIcon}
              />
            </Pressable>
          ) : null}
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: onboardingColors.backgroundBase,
  },
  footerBackButton: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  backIcon: {
    color: onboardingColors.textMuted,
  },
  heroImage: {
    width: "100%",
    height: 200,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  contentNoTopPadding: {
    paddingTop: 16,
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
  },
  footerButtonsRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  continueButton: {
    flex: 1,
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
