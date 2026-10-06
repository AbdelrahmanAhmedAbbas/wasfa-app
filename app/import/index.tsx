import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ImportLoader } from "@/components/import/ImportLoader";
import { LocalizedText as Text } from "@/components/LocalizedText";
import { CtaButton } from "@/components/wasfa/CtaButton";

import { createShareImport } from "@/lib/import/client";
import {
  fillImportLimitMessage,
  getDailyImportLimit,
  getImportErrorCode,
  getImportErrorTranslationKey,
} from "@/lib/import/errors";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors, wasfaRadius } from "@/lib/theme/wasfa";

export default function ShareImportEntryScreen() {
  const { isRTL, language, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    url?: string;
    text?: string;
    share_id?: string;
    media_uri?: string;
    media_mime?: string;
  }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualUrl, setManualUrl] = useState("");
  const [submittingManual, setSubmittingManual] = useState(false);

  function describeImportError(error: unknown, fallback: string): string {
    const dailyLimit = getDailyImportLimit(error);
    if (dailyLimit) return fillImportLimitMessage(t("importErrorDailyLimit"), dailyLimit, language);
    const localizedKey = getImportErrorTranslationKey(getImportErrorCode(error));
    if (localizedKey) return t(localizedKey);
    return error instanceof Error ? error.message : fallback;
  }

  const sourceUrl = useMemo(
    () => (typeof params.url === "string" ? params.url : undefined),
    [params.url]
  );
  const sharedText = useMemo(
    () => (typeof params.text === "string" ? params.text : undefined),
    [params.text]
  );
  const shareId = useMemo(
    () => (typeof params.share_id === "string" ? params.share_id : undefined),
    [params.share_id]
  );
  const mediaUri = useMemo(
    () => (typeof params.media_uri === "string" ? params.media_uri : undefined),
    [params.media_uri]
  );
  const mediaMime = useMemo(
    () => (typeof params.media_mime === "string" ? params.media_mime : undefined),
    [params.media_mime]
  );

  useEffect(() => {
    let active = true;

    async function run() {
      if (!sourceUrl && !sharedText) {
        setLoading(false);
        setError(null);
        return;
      }

      try {
        const created = await createShareImport({
          source_url: sourceUrl,
          shared_text: sharedText,
        });
        if (!active) return;
        router.replace({
          pathname: "/import/[jobId]",
          params: {
            jobId: created.job_id,
          },
        });
      } catch (e) {
        if (!active) return;
        setError(describeImportError(e, "Failed to create share import job."));
      } finally {
        if (active) setLoading(false);
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, [shareId, sharedText, sourceUrl]);

  async function onManualImportPress() {
    const trimmed = manualUrl.trim();
    if (!trimmed) {
      setError(t("pasteInstagramUrl"));
      return;
    }

    setSubmittingManual(true);
    setError(null);
    try {
      const created = await createShareImport({
        source_url: trimmed,
      });
      router.replace({
        pathname: "/import/[jobId]",
        params: {
          jobId: created.job_id,
        },
      });
    } catch (e) {
      setError(describeImportError(e, "Failed to create import job."));
    } finally {
      setSubmittingManual(false);
    }
  }

  // Root direction already flips logical-start alignment for Arabic (see RTL_LAYOUT.md).
  const textAlign = "left";
  const writingDirection = isRTL ? "rtl" : "ltr";

  if (loading) {
    return (
      <View style={[styles.screen, styles.loadingContent]}>
        <ImportLoader style={styles.loadingMascot} />
        <Text style={[styles.kicker, !isRTL && styles.kickerLatin, { writingDirection }]}>
          {t("importProgressKicker")}
        </Text>
        <Text style={[styles.loadingTitle, { writingDirection }]}>{t("creatingImportJob")}</Text>
      </View>
    );
  }

  const needsLink = !sourceUrl && !sharedText;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.mascotCircle}>
        <Image source={onboardingImages.mascotReading} style={styles.mascot} resizeMode="contain" />
      </View>
      <Text style={[styles.title, { textAlign, writingDirection }]}>{t("shareImportTitle")}</Text>
      {needsLink ? (
        <>
          <Text style={[styles.subtitle, { textAlign, writingDirection }]}>
            {mediaUri
              ? t("mediaSharedWithoutUrl")
              : t("pasteVideoUrl")}
          </Text>
          {mediaUri ? (
            <Text style={[styles.caption, { textAlign, writingDirection }]}>
              {t("receivedMediaShare")}
              {mediaMime ? ` (${mediaMime})` : ""}
            </Text>
          ) : null}
          <TextInput
            value={manualUrl}
            onChangeText={setManualUrl}
            placeholder={t("recipeLinkPlaceholder")}
            placeholderTextColor={wasfaColors.muted}
            style={[styles.input, { writingDirection }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <CtaButton
            label={t("importUrl")}
            onPress={() => void onManualImportPress()}
            loading={submittingManual}
          />
        </>
      ) : null}
      <Text style={[styles.status, error ? styles.statusError : null, { textAlign, writingDirection }]}>
        {error ?? (needsLink ? t("awaitingUrlInput") : t("couldNotInitShare"))}
      </Text>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        onPress={() => router.dismissTo("/(tabs)")}
      >
        <Text style={styles.secondaryButtonText}>{t("backToHome")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: wasfaColors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  loadingContent: {
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  loadingMascot: {
    marginBottom: 16,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "800",
    color: wasfaColors.primary,
    textAlign: "center",
  },
  // Letter spacing breaks Arabic joining, so only the Latin label is tracked out.
  kickerLatin: {
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  loadingTitle: {
    marginTop: 16,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "center",
  },
  mascotCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: wasfaColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 10,
  },
  mascot: {
    width: 96,
    height: 96,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: wasfaColors.ink,
  },
  subtitle: {
    fontSize: 16,
    color: wasfaColors.muted,
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    color: wasfaColors.muted,
    marginTop: -4,
  },
  input: {
    width: "100%",
    height: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    color: wasfaColors.ink,
  },
  status: {
    fontSize: 15,
    color: wasfaColors.muted,
    lineHeight: 22,
  },
  statusError: {
    color: wasfaColors.danger,
  },
  secondaryButton: {
    height: 54,
    borderRadius: wasfaRadius.pill,
    borderWidth: 2,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: wasfaColors.ink,
  },
  pressed: {
    opacity: 0.7,
  },
});
