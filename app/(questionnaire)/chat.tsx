import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { MascotBadge } from "@/components/onboarding/MascotBadge";
import { CtaButton } from "@/components/wasfa/CtaButton";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import {
  saveOnboardingAnswers,
  type AllergyOption,
  type DietOption,
  type GoalOption,
  type HouseholdSize,
  type PainPoint,
} from "@/lib/onboarding/answers";
import {
  ALLERGY_OPTIONS,
  DIET_OPTIONS,
  getStepIndex,
  GOAL_OPTIONS,
  HOUSEHOLD_OPTIONS,
  MAX_DIETS,
  PAIN_OPTIONS,
} from "@/lib/onboarding/flow";
import { setQuestionnaireStep } from "@/lib/onboarding/storage";
import { toArabicIndicDigits } from "@/lib/recipes/numerals";
import { dietImages } from "@/lib/theme/onboarding";
import { wasfaColors } from "@/lib/theme/wasfa";

// Each question is asked by the mascot and followed by a short reply once answered.
const QUESTIONS: { askKey: TranslationKey; replyKey: TranslationKey | null }[] = [
  { askKey: "obQ1", replyKey: "obQ1Reply" },
  { askKey: "obQ2", replyKey: "obQ2Reply" },
  { askKey: "obQ3", replyKey: "obQ3Reply" },
  { askKey: "obQ4", replyKey: "obQ4Reply" },
  { askKey: "obQ5", replyKey: null },
];
const QUESTION_COUNT = QUESTIONS.length;
const TYPING_MS = 750;

type ChatAnswers = {
  goal: GoalOption | null;
  household: HouseholdSize | null;
  pains: PainPoint[];
  diets: DietOption[];
  allergies: AllergyOption[];
};

const EMPTY_ANSWERS: ChatAnswers = {
  goal: null,
  household: null,
  pains: [],
  diets: [],
  allergies: [],
};

type Message = { bot: boolean; text?: string; typing?: boolean };

type Chip = {
  key: string;
  label: string;
  emoji?: string;
  image?: number;
  selected: boolean;
  dimmed?: boolean;
  onPress: () => void;
};

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
}

export default function ChatQuestionnaireScreen() {
  const { isRTL, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { restart } = useLocalSearchParams<{ restart?: string }>();
  const [question, setQuestion] = useState(0);
  const [typing, setTyping] = useState(false);
  const [answers, setAnswers] = useState<ChatAnswers>(EMPTY_ANSWERS);
  const [allergiesNone, setAllergiesNone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  // "Edit answers" on the kitchen card comes back here with a fresh `restart` value.
  useEffect(() => {
    if (!restart) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    setQuestion(0);
    setTyping(false);
    setAnswers(EMPTY_ANSWERS);
    setAllergiesNone(false);
  }, [restart]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [question, typing]);

  const num = (value: number) => (isRTL ? toArabicIndicDigits(String(value)) : String(value));
  const joinLabels = (options: { id: string; labelKey: TranslationKey }[], selected: string[]) =>
    options
      .filter((option) => selected.includes(option.id))
      .map((option) => t(option.labelKey))
      .join(" · ");

  const advance = () => {
    setQuestion((current) => current + 1);
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), TYPING_MS);
  };

  const answerGoal = (goal: GoalOption) => {
    setAnswers((current) => ({ ...current, goal }));
    void saveOnboardingAnswers({ goal });
    advance();
  };

  const answerHousehold = (household: HouseholdSize) => {
    setAnswers((current) => ({ ...current, household }));
    void saveOnboardingAnswers({ householdSize: household });
    advance();
  };

  const sendMultiAnswer = () => {
    if (question === 2) void saveOnboardingAnswers({ painPoints: answers.pains });
    if (question === 3) void saveOnboardingAnswers({ diet: answers.diets });
    if (question === 4) void saveOnboardingAnswers({ allergies: answers.allergies });
    advance();
  };

  const openKitchenCard = async () => {
    setIsSaving(true);
    try {
      await saveOnboardingAnswers({
        goal: answers.goal,
        householdSize: answers.household,
        painPoints: answers.pains,
        diet: answers.diets,
        allergies: answers.allergies,
      });
      await setQuestionnaireStep(getStepIndex("kitchen"));
      router.push("/(questionnaire)/kitchen");
    } finally {
      setIsSaving(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(questionnaire)/intro");
    }
  };

  // What the user "said" for each answered question.
  const answerTexts = [
    answers.goal ? joinLabels(GOAL_OPTIONS, [answers.goal]) : "",
    answers.household ? joinLabels(HOUSEHOLD_OPTIONS, [answers.household]) : "",
    joinLabels(PAIN_OPTIONS, answers.pains),
    joinLabels(DIET_OPTIONS, answers.diets) || t("obNoPref"),
    joinLabels(ALLERGY_OPTIONS, answers.allergies) || t("obNone"),
  ];

  const messages: Message[] = [
    { bot: true, text: t("obHi1") },
    { bot: true, text: t("obHi2") },
  ];
  for (let index = 0; index < Math.min(question, QUESTION_COUNT); index++) {
    const { askKey, replyKey } = QUESTIONS[index];
    messages.push({ bot: true, text: t(askKey) });
    messages.push({ bot: false, text: answerTexts[index] });
    // The reply to the latest answer only appears once the mascot stops typing.
    if (replyKey && !(index === question - 1 && typing)) {
      messages.push({ bot: true, text: t(replyKey) });
    }
  }
  if (typing) {
    messages.push({ bot: true, typing: true });
  } else if (question < QUESTION_COUNT) {
    messages.push({ bot: true, text: t(QUESTIONS[question].askKey) });
  } else {
    messages.push({ bot: true, text: t("obFinal") });
  }

  const finished = question >= QUESTION_COUNT && !typing;
  const isMultiQuestion = question >= 2 && question < QUESTION_COUNT;
  const canSend = question === 2 ? answers.pains.length > 0 : true;

  let chips: Chip[] = [];
  if (!typing) {
    if (question === 0) {
      chips = GOAL_OPTIONS.map((option) => ({
        key: option.id,
        label: t(option.labelKey),
        emoji: option.emoji,
        selected: false,
        onPress: () => answerGoal(option.id),
      }));
    } else if (question === 1) {
      chips = HOUSEHOLD_OPTIONS.map((option) => ({
        key: option.id,
        label: t(option.labelKey),
        emoji: option.emoji,
        selected: false,
        onPress: () => answerHousehold(option.id),
      }));
    } else if (question === 2) {
      chips = PAIN_OPTIONS.map((option) => ({
        key: option.id,
        label: t(option.labelKey),
        emoji: option.emoji,
        selected: answers.pains.includes(option.id),
        onPress: () =>
          setAnswers((current) => ({ ...current, pains: toggle(current.pains, option.id) })),
      }));
    } else if (question === 3) {
      const atLimit = answers.diets.length >= MAX_DIETS;
      chips = DIET_OPTIONS.map((option) => {
        const selected = answers.diets.includes(option.id);
        return {
          key: option.id,
          label: t(option.labelKey),
          image: dietImages[option.id],
          selected,
          dimmed: !selected && atLimit,
          onPress: () =>
            setAnswers((current) =>
              !current.diets.includes(option.id) && current.diets.length >= MAX_DIETS
                ? current
                : { ...current, diets: toggle(current.diets, option.id) }
            ),
        };
      });
    } else if (question === 4) {
      chips = [
        ...ALLERGY_OPTIONS.map((option) => ({
          key: option.id,
          label: t(option.labelKey),
          emoji: option.emoji,
          selected: answers.allergies.includes(option.id),
          onPress: () => {
            setAllergiesNone(false);
            setAnswers((current) => ({
              ...current,
              allergies: toggle(current.allergies, option.id),
            }));
          },
        })),
        {
          key: "none",
          label: t("obNone"),
          selected: allergiesNone,
          onPress: () => {
            setAllergiesNone((current) => !current);
            setAnswers((current) => ({ ...current, allergies: [] }));
          },
        },
      ];
    }
  }

  const sendArrowColor = canSend || finished ? "#FFFFFF" : wasfaColors.disabledText;
  const sendArrow = (
    <Feather name={isRTL ? "arrow-left" : "arrow-right"} size={18} color={sendArrowColor} />
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("back")}
            hitSlop={8}
            style={styles.backButton}
            onPress={goBack}
          >
            <Feather
              name={isRTL ? "chevron-right" : "chevron-left"}
              size={18}
              color={wasfaColors.ink}
            />
          </Pressable>
          <MascotBadge size={36} imageHeight={40} offset={11} />
          <View style={styles.headerCopy}>
            <Text style={styles.botName}>{t("obBotName")}</Text>
            <Text style={styles.botStatus}>{t("obBotSub")}</Text>
          </View>
          <Text style={styles.counter}>
            {`${num(Math.min(question + 1, QUESTION_COUNT))} ${t("obOf")} ${num(QUESTION_COUNT)}`}
          </Text>
        </View>
        <View style={styles.progressRow}>
          {QUESTIONS.map((item, index) => (
            <View
              key={item.askKey}
              style={[
                styles.progressBar,
                index < question && styles.progressBarDone,
                index === question && styles.progressBarCurrent,
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const next = messages[index + 1];
          // The avatar sits beside the last bubble of each run of mascot messages.
          const showAvatar = message.bot && (!next || !next.bot);
          const speakerChanged = !!previous && previous.bot !== message.bot;

          return (
            <View
              key={index}
              style={[
                styles.messageRow,
                !message.bot && styles.messageRowUser,
                speakerChanged && styles.messageRowGap,
              ]}
            >
              {message.bot ? (
                <View style={styles.avatarSlot}>
                  {showAvatar ? <MascotBadge size={30} imageHeight={34} offset={9} /> : null}
                </View>
              ) : null}

              {message.typing ? (
                <TypingBubble />
              ) : message.bot ? (
                <View style={[styles.botBubble, showAvatar && styles.botBubbleTail]}>
                  <Text style={styles.botText}>{message.text}</Text>
                </View>
              ) : (
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{message.text}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom + 8, 28) }]}>
        {chips.length > 0 ? (
          <ScrollView
            style={styles.chipScroll}
            contentContainerStyle={styles.chipWrap}
            showsVerticalScrollIndicator={false}
          >
            {chips.map((chip) => (
              <Pressable
                key={chip.key}
                accessibilityRole="button"
                accessibilityState={{ selected: chip.selected, disabled: !!chip.dimmed }}
                disabled={chip.dimmed}
                style={[
                  styles.chip,
                  !chip.emoji && !chip.image && styles.chipPlain,
                  chip.selected && styles.chipSelected,
                  chip.dimmed && styles.chipDimmed,
                ]}
                onPress={chip.onPress}
              >
                {chip.image ? <Image source={chip.image} style={styles.chipImage} /> : null}
                {chip.emoji ? <RNText style={styles.chipEmoji}>{chip.emoji}</RNText> : null}
                <Text style={styles.chipLabel}>{chip.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {typing ? (
          <View style={styles.typingNote}>
            <Text style={styles.typingNoteText}>{t("obTyping")}</Text>
          </View>
        ) : finished ? (
          <CtaButton
            label={t("obSeeCard")}
            onPress={() => void openKitchenCard()}
            loading={isSaving}
            trailing={sendArrow}
            style={styles.send}
          />
        ) : isMultiQuestion ? (
          <CtaButton
            label={t("obSend")}
            onPress={sendMultiAnswer}
            disabled={!canSend}
            trailing={sendArrow}
            style={styles.send}
          />
        ) : null}
      </View>
    </View>
  );
}

/** Three dots that pulse one after another while the mascot is "typing". */
function TypingBubble() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    loop.start();
    return () => loop.stop();
  }, [progress]);

  return (
    <View style={styles.typingBubble}>
      {[0, 1, 2].map((dot) => {
        const peak = 0.2 + dot * 0.2;
        const opacity = progress.interpolate({
          inputRange: [0, peak, peak + 0.3, 1],
          outputRange: [0.35, 1, 0.35, 0.35],
        });

        return <Animated.View key={dot} style={[styles.typingDot, { opacity }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: wasfaColors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: wasfaColors.line,
    backgroundColor: wasfaColors.background,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
  },
  botName: {
    fontSize: 15,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  botStatus: {
    fontSize: 11,
    fontWeight: "700",
    color: wasfaColors.primary,
    textAlign: "left",
  },
  counter: {
    fontSize: 12,
    fontWeight: "800",
    color: wasfaColors.muted,
  },
  progressRow: {
    flexDirection: "row",
    gap: 4,
  },
  progressBar: {
    flex: 1,
    height: 5,
    borderRadius: 9,
    backgroundColor: wasfaColors.line,
  },
  progressBarDone: {
    backgroundColor: wasfaColors.primary,
  },
  progressBarCurrent: {
    backgroundColor: wasfaColors.cta,
  },
  thread: {
    flex: 1,
  },
  threadContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 6,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  // The user's bubbles sit on the trailing side of the thread.
  messageRowUser: {
    justifyContent: "flex-end",
  },
  messageRowGap: {
    marginTop: 10,
  },
  avatarSlot: {
    width: 30,
    height: 30,
  },
  botBubble: {
    maxWidth: 252,
    flexShrink: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
  },
  botBubbleTail: {
    borderBottomStartRadius: 6,
  },
  botText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  userBubble: {
    maxWidth: 260,
    flexShrink: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderBottomEndRadius: 6,
    backgroundColor: wasfaColors.primary,
  },
  userText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "left",
  },
  typingBubble: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: wasfaColors.muted,
  },
  panel: {
    paddingTop: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderTopWidth: 1,
    borderColor: wasfaColors.line,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: wasfaColors.background,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -10 },
    elevation: 12,
  },
  chipScroll: {
    maxHeight: 250,
    flexGrow: 0,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 44,
    paddingVertical: 8,
    paddingStart: 8,
    paddingEnd: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chipPlain: {
    paddingStart: 14,
  },
  chipSelected: {
    borderColor: wasfaColors.cta,
    backgroundColor: wasfaColors.ctaSoft,
  },
  chipDimmed: {
    opacity: 0.45,
  },
  chipImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  chipEmoji: {
    fontSize: 20,
  },
  chipLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
    color: wasfaColors.ink,
  },
  typingNote: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  typingNoteText: {
    fontSize: 13,
    fontWeight: "600",
    color: wasfaColors.muted,
  },
  send: {
    height: 52,
  },
});
