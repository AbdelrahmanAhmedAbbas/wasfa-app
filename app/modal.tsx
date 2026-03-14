import { LocalizedText as Text } from "@/components/LocalizedText";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { createImportJob } from "@/lib/import/client";
import { onboardingColors } from "@/lib/theme/onboarding";

export default function ImportModalScreen() {
  const { isRTL, t } = useLanguage();
  const [link, setLink] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onImportPress() {
    const trimmed = link.trim();
    if (!trimmed) {
      setMessage(t("emptyLinkError") || "Please enter a valid link.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const created = await createImportJob({
        source_url: trimmed,
        entrypoint: "paste_url",
      });
      setMessage(t("importResult") || "Success! Redirecting...");
      router.replace({
        pathname: "/import/[jobId]",
        params: {
          jobId: created.job_id,
          token: created.access_token,
        },
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to import.");
    } finally {
      setSubmitting(false);
    }
  }

  const rtlTextStyle = isRTL ? { writingDirection: 'rtl' as const } : {};

  return (
    <View style={styles.container}>
      <Text style={[styles.title, rtlTextStyle]}>
        {t("recipeLinkLabel") || "Import Recipe Link"}
      </Text>

      <TextInput
        value={link}
        onChangeText={setLink}
        placeholder={t("recipeLinkPlaceholder") || "Paste Instagram/TikTok link here..."}
        placeholderTextColor="#8a8a82"
        style={[styles.input, rtlTextStyle]}
        autoFocus
        autoCapitalize="none"
        keyboardType="url"
      />

      <Pressable style={styles.primaryButton} onPress={() => void onImportPress()} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={onboardingColors.textOnDark} />
        ) : (
          <Text style={styles.primaryButtonText}>{t("importRecipe") || "Import Recipe"}</Text>
        )}
      </Pressable>

      {message ? (
        <Text style={[styles.message, rtlTextStyle]}>
          {message}
        </Text>
      ) : null}

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: onboardingColors.backgroundBase,
    padding: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: onboardingColors.primaryDark,
    marginBottom: 20,
  },
  input: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.cardSoft,
    paddingHorizontal: 16,
    fontSize: 16,
    color: onboardingColors.text,
  },
  primaryButton: {
    marginTop: 20,
    borderRadius: 14,
    backgroundColor: onboardingColors.primary,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: onboardingColors.textOnDark,
  },
  message: {
    marginTop: 16,
    fontSize: 14,
    color: onboardingColors.textMuted,
    textAlign: "center",
  },
});
