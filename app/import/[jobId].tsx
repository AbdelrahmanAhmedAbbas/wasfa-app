import { LocalizedText as Text } from "@/components/LocalizedText";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Image, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CheckBox } from "@/components/wasfa/CheckBox";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { getImportJob } from "@/lib/import/client";
import { getImportErrorTranslationKey } from "@/lib/import/errors";
import { shouldRedirectImportHome } from "@/lib/import/navigation";
import { onboardingImages } from "@/lib/theme/onboarding";
import { wasfaColors } from "@/lib/theme/wasfa";

const POLL_INTERVAL_MS = 2500;

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
  youtube_short_read: { en: "Watching the Short...", ar: "نشاهد الشورت..." },
  youtube_short_read_failed: { en: "Couldn't watch the Short, using the available text...", ar: "تعذّرت مشاهدة الشورت، ونستخدم النص المتاح..." },
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

// The five steps the checklist shows, each covering a run of pipeline stages.
const CHECKLIST_STEPS: { labelKey: TranslationKey; stages: string[] }[] = [
  {
    labelKey: "importStageRead",
    stages: ["ingest_url", "cache_lookup", "metadata_fetch", "media_access_check"],
  },
  {
    labelKey: "importStageTranscribe",
    stages: [
      "tiktok_apify_transcript_used",
      "audio_extract",
      "openrouter_transcribe",
      "openrouter_transcribe_skipped",
      "openrouter_transcribe_failed",
      "youtube_short_read",
      "youtube_short_read_failed",
    ],
  },
  {
    labelKey: "importStageExtract",
    stages: ["gemini_parse", "web_measurement_fill"],
  },
  {
    labelKey: "importStageNutrition",
    stages: [
      "post_extraction_parallel",
      "content_generation_en",
      "content_generation_en_failed",
      "content_generation_ar",
      "content_generation_ar_failed",
      "content_generation_ar_retry",
      "content_generation_ar_retry_failed",
      "nutrition_estimate",
      "fill_missing_details",
      "sanity_check",
    ],
  },
  {
    labelKey: "importStageSave",
    stages: ["recipe_content_ready", "save_draft", "cache_write", "cleanup_artifacts"],
  },
];

function getChecklistStepIndex(stage: string | null): number {
  if (!stage) return -1;
  return CHECKLIST_STEPS.findIndex((step) => step.stages.includes(stage));
}

export default function ImportJobScreen() {
  const { isRTL, language, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ jobId?: string; token?: string }>();
  const jobId = useMemo(() => (typeof params.jobId === "string" ? params.jobId : ""), [params.jobId]);
  const accessToken = useMemo(
    () => (typeof params.token === "string" ? params.token : undefined),
    [params.token]
  );

  const [status, setStatus] = useState<string>("queued");
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  // Furthest checklist step the job has reported. Parallel stages can report out of
  // order and unknown stages map to nothing, so the checklist never steps backwards.
  const [reachedStep, setReachedStep] = useState(0);
  const failureNotifiedRef = useRef(false);
  const progress = useRef(new Animated.Value(0)).current;

  const pollOnce = useCallback(async () => {
    if (!jobId) return;
    try {
      const response = await getImportJob(jobId, accessToken);
      setStatus(response.job.status);
      setCurrentStage(response.job.current_stage);
      const stepIndex = getChecklistStepIndex(response.job.current_stage);
      setReachedStep((prev) => Math.max(prev, stepIndex));
      if (response.job.status === "failed" && !failureNotifiedRef.current) {
        failureNotifiedRef.current = true;
        const localizedKey = getImportErrorTranslationKey(response.job.error_code);
        if (localizedKey) {
          Alert.alert(t("importFailedTitle"), t(localizedKey));
        } else {
          const message =
            response.job.error_message ?? "Import failed. Please try another link.";
          Alert.alert("Import failed", message);
        }
      }
    } catch {
      // Swallow polling errors and let the next tick retry.
    }
  }, [accessToken, jobId, t]);

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

  const isConfirmed = status === "confirmed";
  const progressTarget = isConfirmed ? 1 : (reachedStep + 0.5) / CHECKLIST_STEPS.length;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: progressTarget,
      duration: 450,
      useNativeDriver: false,
    }).start();
  }, [progress, progressTarget]);

  const writingDirection = isRTL ? "rtl" : "ltr";
  const stageTitle =
    (currentStage ? STAGE_LABELS[currentStage]?.[language] : null) ??
    t(CHECKLIST_STEPS[reachedStep].labelKey);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.mascotCircle}>
        <Image
          source={onboardingImages.mascotTyping}
          style={styles.mascot}
          resizeMode="contain"
        />
      </View>

      <Text style={[styles.kicker, !isRTL && styles.kickerLatin, { writingDirection }]}>
        {t("importProgressKicker")}
      </Text>
      <Text style={[styles.stageTitle, { writingDirection }]}>{stageTitle}</Text>

      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>

      <View style={styles.checklist}>
        {CHECKLIST_STEPS.map((step, index) => {
          const done = isConfirmed || index < reachedStep;
          const upcoming = !done && index > reachedStep;

          return (
            <View key={step.labelKey} style={[styles.checklistRow, upcoming && styles.checklistRowUpcoming]}>
              <CheckBox variant="round" size={22} checked={done} />
              <Text
                style={[styles.checklistLabel, { writingDirection }]}
              >
                {t(step.labelKey)}
              </Text>
            </View>
          );
        })}
      </View>
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 16,
  },
  mascotCircle: {
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: wasfaColors.primarySoft,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  mascot: {
    width: 210,
    height: 210,
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
  stageTitle: {
    minHeight: 54,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "center",
  },
  progressTrack: {
    alignSelf: "stretch",
    height: 8,
    borderRadius: 9,
    backgroundColor: wasfaColors.line,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 9,
    backgroundColor: wasfaColors.cta,
  },
  checklist: {
    alignSelf: "stretch",
    gap: 10,
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checklistRowUpcoming: {
    opacity: 0.35,
  },
  checklistLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: wasfaColors.ink,
    textAlign: "left",
  },
});
