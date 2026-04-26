import { LocalizedText as Text } from "@/components/LocalizedText";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from "react-native";

import { BottomDrawer } from "@/components/ui/BottomDrawer";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";

export type ImportPlatform = "tiktok" | "instagram" | "youtube";

type ImportGuideStep = {
  titleKey: TranslationKey;
  image: ImageSourcePropType;
  highlight?: boolean;
};

type ImportPlatformConfig = {
  iconKind: "fontawesome" | "fontawesome5";
  iconName: string;
  iconColor: string;
  iconBackground: string;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  steps: ImportGuideStep[];
};

type SocialImportDrawersProps = {
  isPrimaryVisible: boolean;
  selectedPlatform: ImportPlatform | null;
  t: (key: TranslationKey) => string;
  onClosePrimary: () => void;
  onSelectPlatform: (platform: ImportPlatform) => void;
  onCloseGuide: () => void;
};

const PLATFORM_CONFIG: Record<ImportPlatform, ImportPlatformConfig> = {
  tiktok: {
    iconKind: "fontawesome5",
    iconName: "music",
    iconColor: "#FFFFFF",
    iconBackground: "#111111",
    titleKey: "sourceTikTok",
    subtitleKey: "importDrawerTiktokSubtitle",
    steps: [
      { titleKey: "importGuideTiktokStep1", image: onboardingImages.mascotTyping },
      { titleKey: "importGuideTiktokStep2", image: onboardingImages.mascotReading },
      { titleKey: "importGuideTiktokStep3", image: onboardingImages.mascot, highlight: true },
    ],
  },
  instagram: {
    iconKind: "fontawesome",
    iconName: "instagram",
    iconColor: "#FFFFFF",
    iconBackground: "#E84D6E",
    titleKey: "sourceInstagram",
    subtitleKey: "importDrawerInstagramSubtitle",
    steps: [
      { titleKey: "importGuideInstagramStep1", image: onboardingImages.demoKabsaSocial },
      { titleKey: "importGuideInstagramStep2", image: onboardingImages.mascotReading },
      { titleKey: "importGuideInstagramStep3", image: onboardingImages.mascot, highlight: true },
    ],
  },
  youtube: {
    iconKind: "fontawesome",
    iconName: "youtube-play",
    iconColor: "#FFFFFF",
    iconBackground: "#FF2A1A",
    titleKey: "sourceYoutube",
    subtitleKey: "importDrawerYoutubeSubtitle",
    steps: [
      { titleKey: "importGuideYoutubeStep1", image: onboardingImages.demoKabsaSocial },
      { titleKey: "importGuideYoutubeStep2", image: onboardingImages.mascotTyping },
      { titleKey: "importGuideYoutubeStep3", image: onboardingImages.mascot, highlight: true },
    ],
  },
};

function PlatformIcon({
  platform,
  size = 24,
}: {
  platform: ImportPlatform;
  size?: number;
}) {
  const config = PLATFORM_CONFIG[platform];

  if (config.iconKind === "fontawesome5") {
    return <FontAwesome5 name={config.iconName} size={size - 2} color={config.iconColor} solid />;
  }

  return <FontAwesome name={config.iconName as never} size={size} color={config.iconColor} />;
}

export function SocialImportDrawers({
  isPrimaryVisible,
  selectedPlatform,
  t,
  onClosePrimary,
  onSelectPlatform,
  onCloseGuide,
}: SocialImportDrawersProps) {
  const { isRTL } = useLanguage();
  const textAlign = "left";

  return (
    <>
      <BottomDrawer
        visible={isPrimaryVisible}
        onClose={onClosePrimary}
        title={t("socialImportDrawerTitle")}
        dockToBottom
        sideInset={0}
        sheetStyle={styles.primarySheet}
        contentStyle={styles.primaryContent}
      >
        {(["tiktok", "instagram", "youtube"] as ImportPlatform[]).map((platform) => {
          const config = PLATFORM_CONFIG[platform];

          return (
            <Pressable
              key={platform}
              style={styles.platformRow}
              onPress={() => onSelectPlatform(platform)}
            >
              <View
                style={[
                  styles.platformIconWrap,
                  { backgroundColor: config.iconBackground },
                ]}
              >
                <PlatformIcon platform={platform} />
              </View>

              <View style={styles.platformTextWrap}>
                <Text style={[styles.platformTitle, { textAlign }]}>{t(config.titleKey)}</Text>
                <Text style={[styles.platformSubtitle, { textAlign }]}>{t(config.subtitleKey)}</Text>
              </View>

              <FontAwesome name={isRTL ? "chevron-left" : "chevron-right"} size={14} color="#9A9F96" />
            </Pressable>
          );
        })}
      </BottomDrawer>

      {selectedPlatform ? (
        <BottomDrawer
          visible
          onClose={onCloseGuide}
          title={t("socialImportGuideTitle")}
          showCloseButton
          dockToBottom
          sideInset={0}
          backdropOpacity={0}
          sheetStyle={styles.guideSheet}
          contentStyle={styles.guideContent}
        >
          {PLATFORM_CONFIG[selectedPlatform].steps.map((step, index) => (
            <View
              key={`${selectedPlatform}-${index}`}
              style={[styles.stepCard, step.highlight && styles.stepCardHighlight]}
            >
              <View style={styles.stepTopRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{index + 1}</Text>
                </View>
                <Text style={[styles.stepText, { textAlign }]}>{t(step.titleKey)}</Text>
              </View>

              <Image
                source={step.image}
                style={styles.stepImage}
                resizeMode={selectedPlatform === "instagram" ? "cover" : "contain"}
              />
            </View>
          ))}
        </BottomDrawer>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  primarySheet: {
    paddingHorizontal: 18,
  },
  primaryContent: {
    gap: 12,
    paddingBottom: 8,
  },
  platformRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#EEEAE0",
    borderRadius: 18,
    backgroundColor: "#FBF9F4",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  platformIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  platformTextWrap: {
    flex: 1,
    gap: 2,
  },
  platformTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#242822",
  },
  platformSubtitle: {
    fontSize: 13,
    color: "#7D847A",
  },
  guideSheet: {
    paddingHorizontal: 18,
  },
  guideContent: {
    gap: 14,
    paddingBottom: 4,
  },
  stepCard: {
    borderWidth: 1,
    borderColor: "#E6EBDD",
    borderRadius: 18,
    backgroundColor: "#FFFDF8",
    padding: 14,
    gap: 12,
  },
  stepCardHighlight: {
    backgroundColor: "#EFF7E7",
    borderColor: "#D8E9C8",
  },
  stepTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: onboardingColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    color: "#364133",
  },
  stepImage: {
    width: "100%",
    height: 92,
    borderRadius: 14,
    backgroundColor: "#F3F7EE",
  },
});
