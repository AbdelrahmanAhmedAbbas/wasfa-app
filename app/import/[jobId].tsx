import { LocalizedText as Text } from "@/components/LocalizedText";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View
} from "react-native";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
    confirmRecipe,
    getImportJob,
} from "@/lib/import/client";
import type { IngredientItem, LocalizedRecipeText, RecipeDraft, StepItem } from "@/lib/import/types";

const POLL_INTERVAL_MS = 2500;

function parseTranscriptionConfidence(confidence: Record<string, unknown> | null | undefined) {
  if (!confidence) {
    return {
      provider: null as string | null,
      model: null as string | null,
      chars: null as number | null,
      skipped: null as boolean | null,
    };
  }

  return {
    provider:
      typeof confidence.transcription_provider === "string"
        ? confidence.transcription_provider
        : null,
    model:
      typeof confidence.transcription_model === "string"
        ? confidence.transcription_model
        : null,
    chars:
      typeof confidence.transcription_chars === "number"
        ? confidence.transcription_chars
        : null,
    skipped:
      typeof confidence.transcription_skipped === "boolean"
        ? confidence.transcription_skipped
        : null,
  };
}

function getTranscriptionStatusText(params: {
  importStatus: string;
  errorCode: string | null;
  draftConfidence: Record<string, unknown> | null | undefined;
}): string {
  const { provider, model, chars, skipped } = parseTranscriptionConfidence(params.draftConfidence);

  if (skipped || provider === "skipped") {
    return "Transcription: skipped (using metadata/caption instead)";
  }
  if (provider === "openrouter" && typeof chars === "number" && chars > 0) {
    const modelSuffix = model ? ` • ${model}` : "";
    return `Transcription: completed (${chars} chars${modelSuffix})`;
  }
  if (params.errorCode === "TRANSCRIPTION_FAILED") {
    return "Transcription: failed";
  }
  if (params.errorCode === "MEDIA_TOO_LARGE") {
    return "Transcription: skipped (media too large)";
  }
  if (["queued", "processing"].includes(params.importStatus)) {
    return "Transcription: processing...";
  }
  return "Transcription: unavailable";
}

function ingredientsToText(ingredients: IngredientItem[]) {
  return ingredients
    .map((item) => [item.quantity, item.unit, item.name].filter(Boolean).join(" ").trim())
    .join("\n");
}

function stepsToText(steps: StepItem[]) {
  return steps
    .sort((a, b) => a.order - b.order)
    .map((step) => step.text)
    .join("\n");
}

function parseIngredients(text: string): IngredientItem[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ name: line }));
}

function parseSteps(text: string): StepItem[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      order: index + 1,
      text: line,
    }));
}

function applyLocalizedDraft(
  draft: RecipeDraft,
  language: "en" | "ar"
): RecipeDraft {
  const localized: LocalizedRecipeText | undefined = draft.localized?.[language];
  if (!localized) return draft;

  return {
    ...draft,
    title: localized.title,
    description: localized.description,
    ingredients: draft.ingredients.map((ingredient, index) => ({
      ...ingredient,
      name: localized.ingredients[index]?.name ?? ingredient.name,
      notes: localized.ingredients[index]?.notes ?? ingredient.notes,
    })),
    steps: draft.steps.map((step, index) => ({
      ...step,
      text: localized.steps[index]?.text ?? step.text,
    })),
  };
}

export default function ImportJobScreen() {
  const { t, isRTL, language } = useLanguage();
  const params = useLocalSearchParams<{ jobId?: string; token?: string }>();
  const jobId = useMemo(() => (typeof params.jobId === "string" ? params.jobId : ""), [params.jobId]);
  const accessToken = useMemo(
    () => (typeof params.token === "string" ? params.token : undefined),
    [params.token]
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("queued");
  const [serverErrorCode, setServerErrorCode] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState("Transcription: processing...");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("");
  const [prepMinutes, setPrepMinutes] = useState("");
  const [cookMinutes, setCookMinutes] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [nutritionSummary, setNutritionSummary] = useState<string | null>(null);

  useEffect(() => {
    if (__DEV__) {
      console.clear();
    }
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!jobId) return;
      if (!silent) setLoading(true);
      if (silent) setRefreshing(true);

      try {
        const response = await getImportJob(jobId, accessToken);
        setStatus(response.job.status);
        setServerErrorCode(response.job.error_code);
        setServerMessage(response.job.error_message);
        setTranscriptionStatus(
          getTranscriptionStatusText({
            importStatus: response.job.status,
            errorCode: response.job.error_code,
            draftConfidence: response.draft?.confidence,
          })
        );
        setError(null);

        if (response.draft?.payload) {
          const draft = applyLocalizedDraft(response.draft.payload, language);
          setTitle(draft.title ?? "");
          setDescription(draft.description ?? "");
          setServings(draft.servings ? String(draft.servings) : "");
          setPrepMinutes(draft.prep_minutes ? String(draft.prep_minutes) : "");
          setCookMinutes(draft.cook_minutes ? String(draft.cook_minutes) : "");
          setIngredientsText(ingredientsToText(draft.ingredients));
          setStepsText(stepsToText(draft.steps));
          if (draft.nutrition_estimate) {
            const calories =
              typeof draft.nutrition_estimate.calories === "number"
                ? `~${Math.round(draft.nutrition_estimate.calories)} kcal`
                : "Estimated nutrition available";
            setNutritionSummary(`${calories} • confidence ${(draft.nutrition_estimate.confidence * 100).toFixed(0)}%`);
          } else {
            setNutritionSummary(null);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch import status.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, jobId, language]
  );

  const displayedServerError = useMemo(() => {
    if (status !== "failed") return serverMessage;
    if (serverErrorCode && serverMessage) return `${serverErrorCode}: ${serverMessage}`;
    if (serverErrorCode) return `Import failed (${serverErrorCode}).`;
    if (serverMessage) return serverMessage;
    return "Import failed. Please try another URL.";
  }, [status, serverErrorCode, serverMessage]);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (!["queued", "processing"].includes(status)) return;
    const handle = setInterval(() => {
      void load(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [status, load]);

  async function onConfirmDraft() {
    if (!jobId) return;
    const edits: Partial<RecipeDraft> = {
      title: title.trim(),
      description: description.trim() || undefined,
      servings: servings.trim() ? Number(servings) : undefined,
      prep_minutes: prepMinutes.trim() ? Number(prepMinutes) : undefined,
      cook_minutes: cookMinutes.trim() ? Number(cookMinutes) : undefined,
      ingredients: parseIngredients(ingredientsText),
      steps: parseSteps(stepsText),
    };

    setSaving(true);
    setError(null);
    try {
      await confirmRecipe(jobId, edits, accessToken);
      setStatus("confirmed");
      await load(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm recipe.");
    } finally {
      setSaving(false);
    }
  }

  if (!jobId) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Missing import job id.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color="#2c5f37" />
        <Text style={styles.statusText}>Loading import job...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>Recipe Import</Text>
        <Text style={[styles.meta, { textAlign: isRTL ? "right" : "left" }]}>
          Status: {status}
          {refreshing ? " • syncing" : ""}
        </Text>
        <Text style={[styles.meta, { textAlign: isRTL ? "right" : "left" }]}>
          {transcriptionStatus}
        </Text>
        {displayedServerError ? (
          <Text style={[styles.warning, { textAlign: isRTL ? "right" : "left" }]}>
            {displayedServerError}
          </Text>
        ) : null}
        {error ? <Text style={[styles.errorText, { textAlign: isRTL ? "right" : "left" }]}>{error}</Text> : null}
      </View>

      {["awaiting_user_review", "confirmed"].includes(status) ? (
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { textAlign: isRTL ? "right" : "left" }]}>
            {t("importReviewTitle")}
          </Text>
          {nutritionSummary ? (
            <Text style={[styles.meta, { textAlign: isRTL ? "right" : "left" }]}>{nutritionSummary}</Text>
          ) : null}

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t("importTitlePlaceholder")}
            style={[styles.input, isRTL && styles.textRtl]}
            placeholderTextColor="#7A7F74"
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t("importDescriptionPlaceholder")}
            style={[styles.input, isRTL && styles.textRtl]}
            placeholderTextColor="#7A7F74"
          />

          <View style={styles.row}>
            <TextInput
              value={servings}
              onChangeText={setServings}
              placeholder={t("importServingsPlaceholder")}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput, isRTL && styles.textRtl]}
              placeholderTextColor="#7A7F74"
            />
            <TextInput
              value={prepMinutes}
              onChangeText={setPrepMinutes}
              placeholder={t("importPrepMinutesPlaceholder")}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput, isRTL && styles.textRtl]}
              placeholderTextColor="#7A7F74"
            />
          </View>

          <TextInput
            value={cookMinutes}
            onChangeText={setCookMinutes}
            placeholder={t("importCookMinutesPlaceholder")}
            keyboardType="numeric"
            style={[styles.input, isRTL && styles.textRtl]}
            placeholderTextColor="#7A7F74"
          />

          <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>
            {t("importIngredientsLabel")}
          </Text>
          <TextInput
            multiline
            value={ingredientsText}
            onChangeText={setIngredientsText}
            placeholder={t("importIngredientsPlaceholder")}
            style={[styles.textArea, isRTL && styles.textRtl]}
            placeholderTextColor="#7A7F74"
          />

          <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>
            {t("importStepsLabel")}
          </Text>
          <TextInput
            multiline
            value={stepsText}
            onChangeText={setStepsText}
            placeholder={t("importStepsPlaceholder")}
            style={[styles.textArea, isRTL && styles.textRtl]}
            placeholderTextColor="#7A7F74"
          />

          {status === "confirmed" ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{t("importConfirmedMessage")}</Text>
            </View>
          ) : (
            <Pressable
              style={[
                styles.button,
                (saving || parseIngredients(ingredientsText).length < 2 || parseSteps(stepsText).length < 2) &&
                  styles.buttonDisabled,
              ]}
              onPress={() => void onConfirmDraft()}
              disabled={
                saving || parseIngredients(ingredientsText).length < 2 || parseSteps(stepsText).length < 2
              }
            >
              {saving ? (
                <ActivityIndicator color="#f5f8f3" />
              ) : (
                <Text style={styles.buttonText}>{t("importConfirmRecipe")}</Text>
              )}
            </Pressable>
          )}
        </View>
      ) : null}

      <Pressable style={styles.secondaryButton} onPress={() => router.replace("/(tabs)")}>
        <Text style={styles.secondaryButtonText}>{t("importBackHome")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8DCCB",
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8DCCB",
    padding: 24,
    gap: 12,
  },
  card: {
    backgroundColor: "#F6F1E9",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d2c8b8",
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#263221",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#33412a",
  },
  label: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "700",
    color: "#43513a",
  },
  meta: {
    fontSize: 14,
    color: "#647058",
  },
  warning: {
    fontSize: 14,
    color: "#7a5a18",
  },
  errorText: {
    fontSize: 14,
    color: "#8e2f2f",
  },
  statusText: {
    fontSize: 15,
    color: "#57604f",
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c6cfba",
    backgroundColor: "#fcfbf8",
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#2f2f2a",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  textArea: {
    minHeight: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c6cfba",
    backgroundColor: "#fcfbf8",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#2f2f2a",
    textAlignVertical: "top",
  },
  textRtl: {
    writingDirection: "rtl",
  },
  button: {
    borderRadius: 14,
    backgroundColor: "#638d55",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f5f8f3",
  },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#b7c2aa",
    backgroundColor: "#f3efe5",
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4a5242",
  },
  successBox: {
    borderRadius: 12,
    backgroundColor: "#deeed3",
    borderWidth: 1,
    borderColor: "#b7d6a1",
    padding: 10,
  },
  successText: {
    color: "#2a5a24",
    fontWeight: "600",
    fontSize: 14,
  },
});
