import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { api } from "@/convex/_generated/api";
import { track } from "@/lib/analytics/posthog";
import { getServerError } from "@/lib/convex/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { wasfaColors } from "@/lib/theme/wasfa";

type FeedbackKind = "bug" | "feature";

export default function FeedbackScreen() {
  const { t, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const posts = useQuery(api.feedback.list);
  const submit = useMutation(api.feedback.submit);
  const toggleVote = useMutation(api.feedback.toggleVote);
  const [kind, setKind] = useState<FeedbackKind>("feature");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);

  const submitFeedback = async () => {
    if (!title.trim() || !detail.trim()) {
      Alert.alert(t("feedbackCheckFields"));
      return;
    }
    setSubmitting(true);
    try {
      await submit({ kind, title, detail });
      track("feedback_submitted", { kind });
      setTitle("");
      setDetail("");
    } catch (error) {
      Alert.alert(t(getServerError(error)?.code === "FEEDBACK_RATE_LIMIT" ? "feedbackRateLimit" : "feedbackSubmitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const vote = async (postId: NonNullable<typeof posts>[number]["id"]) => {
    setVoting(postId);
    try {
      const voted = await toggleVote({ postId });
      track("feedback_vote_toggled", { voted });
    } catch {
      Alert.alert(t("feedbackVoteFailed"));
    } finally {
      setVoting(null);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={22} color={wasfaColors.ink} />
      </Pressable>
      <Text style={styles.heading}>{t("feedbackTitle")}</Text>
      <Text style={styles.intro}>{t("feedbackIntro")}</Text>

      <View style={styles.composer}>
        <View style={styles.kindRow}>
          {(["feature", "bug"] as const).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: kind === option }}
              onPress={() => setKind(option)}
              style={[styles.kindButton, kind === option && styles.kindSelected]}
            >
              <Text style={[styles.kindText, kind === option && styles.kindTextSelected]}>
                {option === "feature" ? t("feedbackFeature") : t("feedbackBug")}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          placeholder={t("feedbackTitlePlaceholder")}
          placeholderTextColor={wasfaColors.muted}
          style={[styles.input, { textAlign: isRTL ? "right" : "left" }]}
        />
        <TextInput
          value={detail}
          onChangeText={setDetail}
          maxLength={1000}
          multiline
          placeholder={t("feedbackDetailPlaceholder")}
          placeholderTextColor={wasfaColors.muted}
          style={[styles.input, styles.detailInput, { textAlign: isRTL ? "right" : "left" }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting }}
          disabled={submitting}
          onPress={() => void submitFeedback()}
          style={[styles.submit, submitting && styles.disabled]}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{t("feedbackSubmit")}</Text>}
        </Pressable>
      </View>

      {posts === undefined ? <ActivityIndicator style={styles.loading} color={wasfaColors.primary} /> : null}
      {posts?.length === 0 ? <Text style={styles.empty}>{t("feedbackEmpty")}</Text> : null}
      {posts?.map((post) => (
        <View key={post.id} style={styles.post}>
          <View style={styles.postTop}>
            <Text style={styles.pill}>{post.kind === "bug" ? t("feedbackBug") : t("feedbackFeature")}</Text>
            <Text style={styles.status}>
              {post.status === "done" ? t("feedbackDone") : post.status === "planned" ? t("feedbackPlanned") : t("feedbackOpen")}
            </Text>
          </View>
          <Text style={styles.postTitle}>{post.title}</Text>
          <Text style={styles.postDetail}>{post.detail}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: post.voted, disabled: voting === post.id }}
            disabled={voting === post.id}
            onPress={() => void vote(post.id)}
            style={[styles.vote, post.voted && styles.voteSelected]}
          >
            <Feather name="arrow-up" size={15} color={post.voted ? "#FFFFFF" : wasfaColors.primary} />
            <Text style={[styles.voteText, post.voted && styles.voteTextSelected]}>
              {post.voted ? t("feedbackVoted") : t("feedbackVote")} · {post.voteCount}
            </Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: wasfaColors.background },
  content: { paddingHorizontal: 20, gap: 14 },
  back: { width: 40, height: 40, justifyContent: "center" },
  heading: { fontSize: 29, fontWeight: "800", color: wasfaColors.ink },
  intro: { fontSize: 14, lineHeight: 21, color: wasfaColors.muted, marginBottom: 4 },
  composer: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, gap: 12 },
  kindRow: { flexDirection: "row", gap: 8 },
  kindButton: { borderWidth: 1, borderColor: wasfaColors.line, borderRadius: 100, paddingHorizontal: 13, paddingVertical: 8 },
  kindSelected: { backgroundColor: wasfaColors.primary, borderColor: wasfaColors.primary },
  kindText: { fontSize: 13, color: wasfaColors.ink, fontWeight: "600" },
  kindTextSelected: { color: "#FFFFFF" },
  input: { borderWidth: 1, borderColor: wasfaColors.line, borderRadius: 12, padding: 12, color: wasfaColors.ink, fontSize: 15 },
  detailInput: { minHeight: 96, textAlignVertical: "top" },
  submit: { alignItems: "center", justifyContent: "center", minHeight: 46, borderRadius: 12, backgroundColor: wasfaColors.primary },
  disabled: { opacity: 0.6 },
  submitText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  loading: { marginVertical: 28 },
  empty: { textAlign: "center", color: wasfaColors.muted, paddingVertical: 24 },
  post: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, gap: 8 },
  postTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pill: { color: wasfaColors.primary, fontSize: 12, fontWeight: "700" },
  status: { color: wasfaColors.muted, fontSize: 12 },
  postTitle: { color: wasfaColors.ink, fontWeight: "700", fontSize: 16 },
  postDetail: { color: wasfaColors.ink, lineHeight: 21, fontSize: 14 },
  vote: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: wasfaColors.primarySoft },
  voteSelected: { backgroundColor: wasfaColors.primary },
  voteText: { color: wasfaColors.primary, fontSize: 12, fontWeight: "700" },
  voteTextSelected: { color: "#FFFFFF" },
});
