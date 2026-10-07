import Feather from "@expo/vector-icons/Feather";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { fillImportLimitMessage, getImportAllowanceNote } from "@/lib/import/errors";
import { onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors, wasfaRadius, wasfaShadow } from "@/lib/theme/wasfa";

/** How far the card reaches up over the hero above it. */
export const IMPORT_ALLOWANCE_CARD_OVERLAP = 34;

// One bar per import up to this many; a longer limit is drawn as a single bar.
const MAX_SEGMENTS = 10;

type ImportAllowanceCardProps = {
  /** A plan with a daily limit: how many imports it allows and how many are left. */
  allowance: { limit: number | null; remaining: number | null; resets_at: number | null };
  onPress: () => void;
};

/** The home screen's count of today's imports, with the mascot keeping the tally. */
export function ImportAllowanceCard({ allowance, onPress }: ImportAllowanceCardProps) {
  const { t, isRTL, language } = useLanguage();
  const { limit, remaining } = allowance;
  if (limit === null || remaining === null) return null;

  const noneLeft = remaining === 0;
  const text = { textAlign: "left", writingDirection: isRTL ? "rtl" : "ltr" } as const;
  const fill = (template: string, count?: number) =>
    fillImportLimitMessage(template, { count, limit, resetsAt: allowance.resets_at }, language);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={getImportAllowanceNote(allowance, t, language) ?? undefined}
      style={styles.card}
      onPress={onPress}
    >
      <View style={[styles.mascotTile, noneLeft && styles.mascotTileNoneLeft]}>
        <Image source={onboardingImages.mascotTyping} resizeMode="contain" style={styles.mascot} />
      </View>

      {noneLeft ? (
        <View style={styles.copy}>
          <Text style={[styles.noneTitle, text]} numberOfLines={1} adjustsFontSizeToFit>
            {t("homeImportsNoneTitle")}
          </Text>
          <View style={styles.nextRow}>
            <Feather name="clock" size={13} color={wasfaColors.cta} />
            <Text style={[styles.nextText, text]} numberOfLines={1} adjustsFontSizeToFit>
              {fill(t("homeImportsNextAt"))}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.copy}>
          <Text style={[styles.label, text]} numberOfLines={1}>
            {t("homeImportsLeftLabel")}
          </Text>
          <View style={styles.countRow}>
            <Text style={styles.count}>{fill("{count}", remaining)}</Text>
            <Text style={styles.ofLimit}>{fill(t("homeImportsOfLimit"))}</Text>
            <View style={styles.meter}>
              {limit <= MAX_SEGMENTS ? (
                Array.from({ length: limit }, (_, index) => (
                  <View key={index} style={[styles.segment, index < remaining && styles.segmentLeft]} />
                ))
              ) : (
                <View style={styles.segment}>
                  <View style={[styles.segmentFill, { width: `${(remaining / limit) * 100}%` }]} />
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      <View style={[styles.action, noneLeft && styles.actionNoneLeft]}>
        <Feather name="plus" size={20} color={noneLeft ? wasfaColors.disabledText : "#FFFFFF"} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: -IMPORT_ALLOWANCE_CARD_OVERLAP,
    marginHorizontal: 20,
    padding: 10,
    paddingEnd: 14,
    borderRadius: wasfaRadius.lg,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...wasfaShadow.card,
  },
  // The mascot stands taller than its tile, so only its face and clipboard show.
  mascotTile: {
    width: 58,
    height: 58,
    borderRadius: wasfaRadius.md,
    backgroundColor: wasfaColors.primarySoft,
    alignItems: "center",
    overflow: "hidden",
  },
  mascotTileNoneLeft: {
    backgroundColor: wasfaColors.warm,
  },
  mascot: {
    marginTop: 5,
    width: 58,
    height: 86,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: wasfaColors.muted,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  count: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
    color: wasfaColors.primaryDark,
  },
  ofLimit: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: wasfaColors.muted,
  },
  meter: {
    flex: 1,
    marginStart: 6,
    flexDirection: "row",
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: wasfaColors.line,
    overflow: "hidden",
  },
  segmentLeft: {
    backgroundColor: wasfaColors.primary,
  },
  segmentFill: {
    height: "100%",
    backgroundColor: wasfaColors.primary,
  },
  noneTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "800",
    color: wasfaColors.ink,
  },
  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nextText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: wasfaColors.muted,
  },
  action: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: wasfaColors.cta,
    alignItems: "center",
    justifyContent: "center",
  },
  actionNoneLeft: {
    backgroundColor: wasfaColors.disabled,
  },
});
