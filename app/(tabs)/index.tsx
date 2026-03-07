import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";
import { router } from "expo-router";

import { createImportJob } from "@/lib/import/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export default function HomeScreen() {
  const { isRTL, t } = useLanguage();
  const [link, setLink] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onImportPress() {
    const trimmed = link.trim();
    if (!trimmed) {
      setMessage(t("emptyLinkError"));
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const created = await createImportJob({
        source_url: trimmed,
        entrypoint: "paste_url",
      });
      setMessage(t("importResult"));
      router.push({
        pathname: "/import/[jobId]",
        params: {
          jobId: created.job_id,
          token: created.access_token,
        },
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("importFailedError"));
    } finally {
      setSubmitting(false);
    }
  }

  // ONLY use writingDirection, NOT textAlign (setting both causes conflicts!)
  const rtlTextStyle = isRTL ? { writingDirection: 'rtl' as const } : {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Main Card */}
      <View style={styles.card}>
        <Text style={[styles.label, rtlTextStyle]}>
          {t("homeLabel")}
        </Text>
        <Text style={[styles.title, rtlTextStyle]}>
          {t("homeTitle")}
        </Text>
        <Text style={[styles.subtitle, rtlTextStyle]}>
          {t("homeSubtitle")}
        </Text>
      </View>

      {/* Recipe Link Card */}
      <View style={styles.card}>
        <Text style={[styles.sectionTitle, rtlTextStyle]}>
          {t("recipeLinkLabel")}
        </Text>

        <TextInput
          value={link}
          onChangeText={setLink}
          placeholder={t("recipeLinkPlaceholder")}
          placeholderTextColor="#8a8a82"
          style={[styles.input, rtlTextStyle]}
        />

        <Pressable style={styles.primaryButton} onPress={() => void onImportPress()} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#1f2719" />
          ) : (
            <Text style={styles.primaryButtonText}>{t("importRecipe")}</Text>
          )}
        </Pressable>

        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{t("createPlan")}</Text>
        </Pressable>

        {message ? (
          <Text style={[styles.message, rtlTextStyle]}>
            {message}
          </Text>
        ) : null}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8DCCB",
  },
  contentContainer: {
    padding: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#F6F1E9",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#d2c8b8",
    padding: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7d7468",
  },
  title: {
    marginTop: 8,
    fontSize: 40,
    fontWeight: "800",
    lineHeight: 46,
    color: "#252821",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 18,
    lineHeight: 28,
    color: "#4a5142",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4b4c43",
  },
  input: {
    marginTop: 12,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#c6cfba",
    backgroundColor: "#fcfbf8",
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#2f2f2a",
  },
  primaryButton: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: "#9CAF88",
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2719",
  },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#c6cfba",
    backgroundColor: "transparent",
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4b4c43",
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: "#59614e",
  },
  textRTL: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
