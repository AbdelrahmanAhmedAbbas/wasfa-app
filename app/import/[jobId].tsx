import { LocalizedText as Text } from "@/components/LocalizedText";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, StyleSheet, View } from "react-native";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { getImportJob } from "@/lib/import/client";
import { shouldRedirectImportHome } from "@/lib/import/navigation";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";

const POLL_INTERVAL_MS = 2500;

const TYPING_TEXTS = [
  "Reading recipe from the link...",
  "Scanning for ingredients...",
  "Calculating macros...",
  "Analyzing number of servings...",
  "Estimating cooking times...",
  "Putting it all together...",
];

export default function ImportJobScreen() {
  const { isRTL } = useLanguage();
  const params = useLocalSearchParams<{ jobId?: string; token?: string }>();
  const jobId = useMemo(() => (typeof params.jobId === "string" ? params.jobId : ""), [params.jobId]);
  const accessToken = useMemo(
    () => (typeof params.token === "string" ? params.token : undefined),
    [params.token]
  );

  const [status, setStatus] = useState<string>("queued");
  const [typingIndex, setTypingIndex] = useState(0);
  const failureNotifiedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTypingIndex((prev) => (prev + 1) % TYPING_TEXTS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const pollOnce = useCallback(async () => {
    if (!jobId) return;
    try {
      const response = await getImportJob(jobId, accessToken);
      setStatus(response.job.status);
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

  return (
    <View style={styles.fullscreenLoading}>
      <Image
        source={onboardingImages.mascotTyping}
        style={styles.loadingMascot}
        resizeMode="contain"
      />
      <Text style={[styles.loadingTypingText, isRTL && styles.textRtl]}>
        {TYPING_TEXTS[typingIndex]}
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
