import { LocalizedText as Text } from "@/components/LocalizedText";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";

import { BottomDrawer } from "@/components/ui/BottomDrawer";
import { CtaButton } from "@/components/wasfa/CtaButton";
import { api } from "@/convex/_generated/api";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { fillImportLimitMessage } from "@/lib/import/errors";
import type { TranslationKey } from "@/lib/i18n/translations";
import { onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors, wasfaRadius } from "@/lib/theme/wasfa";

export type ImportPlatform = "tiktok" | "instagram" | "youtube";

type ImportGuideStep = {
  titleKey: TranslationKey;
  image: ImageSourcePropType;
  highlight?: boolean;
};

type ImportPlatformConfig = {
  iconKind: "fontawesome" | "fontawesome5-brand";
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

const PLATFORMS: ImportPlatform[] = ["tiktok", "instagram", "youtube"];

const PLATFORM_CONFIG: Record<ImportPlatform, ImportPlatformConfig> = {
  tiktok: {
    iconKind: "fontawesome5-brand",
    iconName: "tiktok",
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
  size = 22,
}: {
  platform: ImportPlatform;
  size?: number;
}) {
  const config = PLATFORM_CONFIG[platform];

  if (config.iconKind === "fontawesome5-brand") {
    return <FontAwesome5 name={config.iconName} size={size - 2} color={config.iconColor} brand />;
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
  const { isRTL, language } = useLanguage();
  const textAlign = "left";
  const writingDirection = isRTL ? "rtl" : "ltr";
  const [link, setLink] = useState("");
  const trimmedLink = link.trim();

  // What is left of the day's imports, counted from the moment the sheet opens. It is
  // only a note: the server decides when a link is sent, so nothing here blocks one.
  const [countedFrom, setCountedFrom] = useState<number | null>(null);
  useEffect(() => {
    setCountedFrom(isPrimaryVisible ? Date.now() : null);
  }, [isPrimaryVisible]);
  const allowance = useQuery(api.imports.allowance, countedFrom ? { now: countedFrom } : "skip");
  const noneLeft = allowance?.remaining === 0;
  const allowanceNote =
    !allowance || allowance.limit === null || allowance.remaining === null
      ? null
      : noneLeft
        ? fillImportLimitMessage(
            t("importSheetNoneLeft"),
            { limit: allowance.limit, resetsAt: allowance.resets_at },
            language
          )
        : fillImportLimitMessage(
            t("importSheetLeftToday"),
            { count: allowance.remaining, limit: allowance.limit },
            language
          );

  const handleImportLink = () => {
    if (!trimmedLink) return;
    setLink("");
    Keyboard.dismiss();
    onClosePrimary();
    // Same entry a share intent uses: /import creates the job and opens its progress screen.
    // It goes on top of the tabs: replacing them tore this sheet down while it was still
    // on screen with the keyboard up, and the rebuilt tab bar could stop taking taps.
    router.push({ pathname: "/import", params: { url: trimmedLink } });
  };

  return (
    <>
      <BottomDrawer
        visible={isPrimaryVisible}
        onClose={onClosePrimary}
        dockToBottom
        avoidKeyboard
        showHandle={false}
        sideInset={0}
        sheetStyle={styles.sheet}
        contentStyle={styles.sheetContent}
      >
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.sheetTitle, { textAlign, writingDirection }]}>
              {t("importRecipe")}
            </Text>
            <Text style={[styles.sheetSubtitle, { textAlign, writingDirection }]}>
              {t("importSheetSubtitle")}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("importSheetClose")}
            onPress={onClosePrimary}
            hitSlop={8}
            style={styles.roundButton}
          >
            <Feather name="x" size={18} color={wasfaColors.ink} />
          </Pressable>
        </View>

        {allowanceNote ? (
          <Text
            style={[styles.allowanceNote, noneLeft && styles.allowanceNoteNoneLeft, { textAlign, writingDirection }]}
          >
            {allowanceNote}
          </Text>
        ) : null}

        <View style={styles.platformList}>
          {PLATFORMS.map((platform) => {
            const config = PLATFORM_CONFIG[platform];

            return (
              <Pressable
                key={platform}
                accessibilityRole="button"
                style={({ pressed }) => [styles.platformRow, pressed && styles.pressed]}
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
                  <Text style={[styles.platformTitle, { textAlign, writingDirection }]}>
                    {t(config.titleKey)}
                  </Text>
                  <Text style={[styles.platformSubtitle, { textAlign, writingDirection }]}>
                    {t(config.subtitleKey)}
                  </Text>
                </View>

                <Feather
                  name={isRTL ? "chevron-left" : "chevron-right"}
                  size={20}
                  color={wasfaColors.muted}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t("importSheetOrPaste")}</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.linkRow}>
          <View style={styles.linkField}>
            <Feather name="link" size={18} color={wasfaColors.muted} />
            <TextInput
              value={link}
              onChangeText={setLink}
              placeholder={t("importSheetLinkPlaceholder")}
              placeholderTextColor={wasfaColors.muted}
              style={styles.linkInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleImportLink}
            />
          </View>
          <CtaButton
            label={t("importSheetImport")}
            onPress={handleImportLink}
            disabled={!trimmedLink}
            style={styles.linkButton}
          />
        </View>
      </BottomDrawer>

      {selectedPlatform ? (
        <BottomDrawer
          visible
          onClose={onCloseGuide}
          dockToBottom
          showHandle={false}
          sideInset={0}
          backdropOpacity={0}
          sheetStyle={styles.sheet}
          contentStyle={styles.sheetContent}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("commonBack")}
              onPress={onCloseGuide}
              hitSlop={8}
              style={styles.roundButton}
            >
              <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={18} color={wasfaColors.ink} />
            </Pressable>
            <Text style={[styles.guideTitle, { textAlign, writingDirection }]}>
              {`${t("importGuideTitle")} · ${t(PLATFORM_CONFIG[selectedPlatform].titleKey)}`}
            </Text>
          </View>

          {PLATFORM_CONFIG[selectedPlatform].steps.map((step, index) => (
            <View
              key={`${selectedPlatform}-${index}`}
              style={[styles.stepCard, step.highlight && styles.stepCardHighlight]}
            >
              <View style={styles.stepTopRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{index + 1}</Text>
                </View>
                <Text style={[styles.stepText, { textAlign, writingDirection }]}>{t(step.titleKey)}</Text>
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
  sheet: {
    paddingTop: 10,
    paddingHorizontal: 18,
    backgroundColor: wasfaColors.background,
  },
  sheetContent: {
    gap: 10,
    paddingBottom: 12,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: wasfaRadius.pill,
    backgroundColor: wasfaColors.line,
    alignSelf: "center",
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: wasfaColors.ink,
  },
  sheetSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: wasfaColors.muted,
  },
  roundButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: wasfaColors.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  allowanceNote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: wasfaColors.primary,
  },
  allowanceNoteNoneLeft: {
    color: wasfaColors.danger,
  },
  platformList: {
    gap: 10,
  },
  platformRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    borderRadius: 20,
    backgroundColor: wasfaColors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.8,
  },
  platformIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    color: wasfaColors.ink,
  },
  platformSubtitle: {
    fontSize: 13,
    color: wasfaColors.muted,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: wasfaColors.line,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "700",
    color: wasfaColors.muted,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  // Links are Latin, so the field keeps a left-to-right layout in Arabic too.
  linkField: {
    flex: 1,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    direction: "ltr",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    paddingHorizontal: 14,
  },
  linkInput: {
    flex: 1,
    height: "100%",
    padding: 0,
    fontSize: 15,
    color: wasfaColors.ink,
    textAlign: "left",
    writingDirection: "ltr",
  },
  linkButton: {
    height: 50,
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  guideTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: wasfaColors.ink,
  },
  stepCard: {
    borderWidth: 1,
    borderColor: wasfaColors.line,
    borderRadius: 20,
    backgroundColor: wasfaColors.surface,
    padding: 14,
    gap: 12,
  },
  stepCardHighlight: {
    backgroundColor: wasfaColors.primarySoft,
    borderColor: wasfaColors.primarySoftBorder,
  },
  stepTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: wasfaColors.primary,
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
    lineHeight: 21,
    fontWeight: "700",
    color: wasfaColors.ink,
  },
  stepImage: {
    width: "100%",
    height: 84,
    borderRadius: 14,
    backgroundColor: wasfaColors.soft,
  },
});
