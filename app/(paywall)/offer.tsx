import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { track } from "@/lib/analytics/posthog";
import { LocalizedText as Text } from "@/components/LocalizedText";
import { MASCOT_ASPECT } from "@/components/onboarding/MascotBadge";
import { headingStyle } from "@/components/onboarding/text-styles";
import { CtaButton } from "@/components/wasfa/CtaButton";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { setPaywallSeen } from "@/lib/onboarding/storage";
import { onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors } from "@/lib/theme/wasfa";

const TIMELINE: { whenKey: TranslationKey; whatKey: TranslationKey; icon: ReactNode }[] = [
  {
    whenKey: "obTimeline1When",
    whatKey: "obTimeline1What",
    icon: <Feather name="unlock" size={16} color="#FFFFFF" />,
  },
  {
    whenKey: "obTimeline2When",
    whatKey: "obTimeline2What",
    icon: <Feather name="bell" size={16} color="#FFFFFF" />,
  },
  {
    whenKey: "obTimeline3When",
    whatKey: "obTimeline3What",
    icon: <MaterialCommunityIcons name="calendar-check-outline" size={16} color="#FFFFFF" />,
  },
];
const FEATURE_KEYS: TranslationKey[] = ["obFeature1", "obFeature2", "obFeature3", "obFeature4"];

export default function PaywallOfferScreen() {
  const { isRTL, t } = useLanguage();
  const insets = useSafeAreaInsets();

  // Every way out leads to the same place while nothing is for sale; which one
  // was taken shows how many people wanted the offer.
  const continueToSetup = async (via: "cta" | "skip" | "close") => {
    track("paywall_closed", { via });
    await setPaywallSeen(true);
    router.replace("/(questionnaire)/ready");
  };

  const features = FEATURE_KEYS;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom + 8, 24) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t("qPaywallBadge")}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("obPaywallClose")}
            hitSlop={8}
            style={styles.close}
            onPress={() => void continueToSetup("close")}
          >
            <Feather name="x" size={16} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.titleRow}>
          <Text style={[styles.title, headingStyle(30, isRTL)]}>{t("obPaywallTitle")}</Text>
          <Image source={onboardingImages.mascot} style={styles.mascot} resizeMode="contain" />
        </View>

        <View style={styles.timeline}>
          {TIMELINE.map((step, index) => (
            <View key={step.whenKey} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, index === 0 && styles.timelineDotActive]}>
                  {step.icon}
                </View>
                {index < TIMELINE.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={styles.timelineCopy}>
                <Text style={styles.timelineWhen}>{t(step.whenKey)}</Text>
                <Text style={styles.timelineWhat}>{t(step.whatKey)}</Text>
              </View>
            </View>
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.featureScroll}
          contentContainerStyle={styles.featureRow}
        >
          {features.map((key) => (
            <View key={key} style={styles.feature}>
              <Feather name="check" size={12} color="#A3D48F" />
              <Text style={styles.featureText}>{t(key)}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.spacer} />

        <CtaButton
          label={t("obPaywallCta")}
          onPress={() => void continueToSetup("cta")}
          style={styles.cta}
        />
        <Text style={styles.price}>{t("obPaywallPrice")}</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.skip}
          onPress={() => void continueToSetup("skip")}
        >
          <Text style={styles.skipText}>{t("obPaywallSkip")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: wasfaColors.deep,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: wasfaColors.cta,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  title: {
    flex: 1,
    fontWeight: "800",
    color: wasfaColors.onDeep,
    textAlign: "left",
  },
  mascot: {
    height: 110,
    width: 110 * MASCOT_ASPECT,
    marginBottom: -6,
    transform: [{ rotate: "8deg" }],
  },
  timeline: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 6,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  timelineRow: {
    flexDirection: "row",
    gap: 14,
  },
  timelineRail: {
    alignItems: "center",
  },
  timelineDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotActive: {
    backgroundColor: wasfaColors.cta,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    minHeight: 18,
    marginVertical: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  timelineCopy: {
    flex: 1,
    gap: 2,
    paddingTop: 4,
    paddingBottom: 10,
  },
  timelineWhen: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "left",
  },
  timelineWhat: {
    fontSize: 13,
    lineHeight: 18,
    color: wasfaColors.onDeepSoft,
    textAlign: "left",
  },
  featureScroll: {
    flexGrow: 0,
    marginHorizontal: -22,
  },
  featureRow: {
    paddingHorizontal: 22,
    gap: 6,
  },
  feature: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  featureText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#EAF5E5",
  },
  spacer: {
    flex: 1,
  },
  cta: {
    height: 58,
  },
  price: {
    fontSize: 13,
    color: wasfaColors.onDeepSoft,
    textAlign: "center",
  },
  skip: {
    padding: 4,
    alignItems: "center",
  },
  skipText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#EAF5E5",
  },
});
