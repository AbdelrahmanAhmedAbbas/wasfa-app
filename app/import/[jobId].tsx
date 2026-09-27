import { LocalizedText as Text } from "@/components/LocalizedText";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, StyleSheet, View } from "react-native";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { getImportJob } from "@/lib/import/client";
import { shouldRedirectImportHome } from "@/lib/import/navigation";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";

const POLL_INTERVAL_MS = 2500;

const FALLBACK_TYPING_TEXTS = {
  en: [
    "Reading recipe from the link...",
    "Scanning for ingredients...",
    "Calculating macros...",
    "Estimating cooking times...",
    "Putting it all together...",
  ],
  ar: [
    "نقرأ الوصفة من الرابط...",
    "نراجع المكونات...",
    "نحسب القيم الغذائية...",
    "نقدّر أوقات الطبخ...",
    "نرتّب الوصفة النهائية...",
  ],
} as const;

const STAGE_LABELS: Record<string, { en: string; ar: string }> = {
  ingest_url: { en: "Reading the shared link...", ar: "نقرأ الرابط المشارك..." },
  cache_lookup: { en: "Checking for a saved import...", ar: "نبحث عن استيراد محفوظ..." },
  metadata_fetch: { en: "Fetching post details...", ar: "نجلب تفاصيل المنشور..." },
  media_access_check: { en: "Checking the source media...", ar: "نتأكد من ملف الفيديو..." },
  tiktok_apify_transcript_used: { en: "Using the source transcript...", ar: "نستخدم النص المرفق مع الفيديو..." },
  audio_extract: { en: "Preparing audio for transcription...", ar: "نجهّز الصوت للتفريغ..." },
  openrouter_transcribe: { en: "Transcribing the recipe audio...", ar: "نفرّغ صوت الوصفة..." },
  openrouter_transcribe_skipped: { en: "Skipping audio transcription...", ar: "نتجاوز تفريغ الصوت..." },
  openrouter_transcribe_failed: { en: "Transcript failed, using the available text...", ar: "تعذّر التفريغ، ونستخدم النص المتاح..." },
  gemini_parse: { en: "Extracting the recipe...", ar: "نستخرج الوصفة..." },
  web_measurement_fill: { en: "Filling ingredient amounts...", ar: "نكمّل مقادير المكونات..." },
  post_extraction_parallel: { en: "Generating the final recipe...", ar: "نجهّز الوصفة النهائية..." },
  content_generation_en: { en: "Writing the English recipe...", ar: "نكتب النسخة الإنجليزية..." },
  content_generation_ar: { en: "Writing the Arabic recipe...", ar: "نكتب النسخة العربية..." },
  content_generation_ar_retry: { en: "Polishing the Arabic recipe...", ar: "نحسّن النسخة العربية..." },
  nutrition_estimate: { en: "Estimating nutrition...", ar: "نقدّر القيم الغذائية..." },
  fill_missing_details: { en: "Filling the remaining details...", ar: "نكمّل التفاصيل الناقصة..." },
  sanity_check: { en: "Checking the final recipe...", ar: "نراجع الوصفة النهائية..." },
  recipe_content_ready: { en: "Finalizing the recipe...", ar: "نضع اللمسات الأخيرة..." },
  save_draft: { en: "Saving your recipe...", ar: "نحفظ وصفتك..." },
  cache_write: { en: "Saving import cache...", ar: "نحفظ نسخة الكاش..." },
  cleanup_artifacts: { en: "Cleaning up import artifacts...", ar: "ننظّف ملفات الاستيراد المؤقتة..." },
};

export default function ImportJobScreen() {
  const { isRTL, language } = useLanguage();
  const params = useLocalSearchParams<{ jobId?: string; token?: string }>();
  const jobId = useMemo(() => (typeof params.jobId === "string" ? params.jobId : ""), [params.jobId]);
  const accessToken = useMemo(
    () => (typeof params.token === "string" ? params.token : undefined),
    [params.token]
  );

  const [status, setStatus] = useState<string>("queued");
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [typingIndex, setTypingIndex] = useState(0);
  const failureNotifiedRef = useRef(false);

  useEffect(() => {
    if (currentStage) return;
    const interval = setInterval(() => {
      setTypingIndex((prev) => (prev + 1) % FALLBACK_TYPING_TEXTS[language].length);
    }, 2500);
    return () => clearInterval(interval);
  }, [currentStage, language]);

  const pollOnce = useCallback(async () => {
    if (!jobId) return;
    try {
      const response = await getImportJob(jobId, accessToken);
      setStatus(response.job.status);
      setCurrentStage(response.job.current_stage);
      if (response.job.status === "failed" && !failureNotifiedRef.current) {
        failureNotifiedRef.current = true;
        const message =
          response.job.error_message ?? "Import failed. Please try another link.";
        Alert.alert("Import failed", message);
      }
    } catch {
      // Swallow polling errors and let the next tick retry.
    }
  }, [accessToken, jobId]);

  useEffect(() => {
    void pollOnce();
    const handle = setInterval(() => {
      void pollOnce();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [pollOnce]);

  useEffect(() => {
    if (shouldRedirectImportHome(status)) {
      router.replace("/(tabs)");
    }
  }, [status]);

  const loadingText =
    (currentStage ? STAGE_LABELS[currentStage]?.[language] : null) ??
    FALLBACK_TYPING_TEXTS[language][typingIndex];

  return (
    <View style={styles.fullscreenLoading}>
      <Image
        source={onboardingImages.mascotTyping}
        style={styles.loadingMascot}
        resizeMode="contain"
      />
      <Text style={[styles.loadingTypingText, isRTL && styles.textRtl]}>
        {loadingText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreenLoading: {
    flex: 1,
    backgroundColor: onboardingColors.backgroundBase,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingMascot: {
    width: 250,
    height: 250,
    marginBottom: 24,
  },
  loadingTypingText: {
    fontSize: 20,
    fontWeight: "700",
    color: onboardingColors.primaryDark,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  textRtl: {
    writingDirection: "rtl",
  },
});
