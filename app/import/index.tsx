import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { createShareImport } from "@/lib/import/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export default function ShareImportEntryScreen() {
  const { isRTL, t } = useLanguage();
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
            token: created.access_token,
          },
        });
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to create share import job.");
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
          token: created.access_token,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create import job.");
    } finally {
      setSubmittingManual(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#2c5f37" />
        <Text style={[styles.subtitle, { textAlign: isRTL ? "right" : "left" }]}>
          {t("creatingImportJob")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>{t("shareImportTitle")}</Text>
      {!sourceUrl && !sharedText ? (
        <>
          <Text style={[styles.subtitle, { textAlign: isRTL ? "right" : "left" }]}>
            {mediaUri
              ? t("mediaSharedWithoutUrl")
              : t("pasteVideoUrl")}
          </Text>
          {mediaUri ? (
            <Text style={[styles.caption, { textAlign: isRTL ? "right" : "left" }]}>
              {t("receivedMediaShare")}
              {mediaMime ? ` (${mediaMime})` : ""}
            </Text>
          ) : null}
          <TextInput
            value={manualUrl}
            onChangeText={setManualUrl}
            placeholder="https://www.instagram.com/..."
            placeholderTextColor="#8a8a82"
            style={[styles.input, isRTL && styles.textRtl]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={[styles.button, submittingManual && styles.buttonDisabled]}
            onPress={() => void onManualImportPress()}
            disabled={submittingManual}
          >
            {submittingManual ? (
              <ActivityIndicator color="#f5f8f3" />
            ) : (
              <Text style={styles.buttonText}>{t("importUrl")}</Text>
            )}
          </Pressable>
        </>
      ) : null}
      <Text style={[styles.subtitle, { textAlign: isRTL ? "right" : "left" }]}>
        {error ?? (!sourceUrl && !sharedText ? t("awaitingUrlInput") : t("couldNotInitShare"))}
      </Text>
      <Pressable style={styles.button} onPress={() => router.replace("/(tabs)")}>
        <Text style={styles.buttonText}>{t("backToHome")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 14,
    justifyContent: "center",
    backgroundColor: "#E8DCCB",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#22321f",
  },
  subtitle: {
    fontSize: 16,
    color: "#4f5347",
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    color: "#5f6f58",
    marginTop: -4,
  },
  input: {
    width: "100%",
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c6cfba",
    backgroundColor: "#fcfbf8",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: "#2f2f2a",
  },
  textRtl: {
    writingDirection: "rtl",
  },
  button: {
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: "#7C9B68",
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignSelf: "flex-start",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f5f8f3",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
