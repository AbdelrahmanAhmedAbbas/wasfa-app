import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import { Image, Pressable, SafeAreaView, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { demoRecipe } from "@/lib/onboarding/demo-data";
import { setQuestionnaireStep } from "@/lib/onboarding/storage";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";

type DemoState = "instagram" | "extracting" | "revealing" | "complete";

export default function DemoQuestionnaireScreen() {
  const { language, t } = useLanguage();
  const [state, setState] = useState<DemoState>("instagram");
  const [extractIndex, setExtractIndex] = useState(0);
  const postOpacity = useSharedValue(1);
  const postScale = useSharedValue(1);
  const scanY = useSharedValue(-220);
  const recipeOpacity = useSharedValue(0);
  const recipeY = useSharedValue(80);
  const isArabic = language === "ar";
  const textKey = isArabic ? "ar" : "en";

  const extractionLabels = [
    t("qDemoReading"),
    t("qDemoIngredients"),
    t("qDemoSteps"),
    t("qDemoSaving"),
  ];

  useEffect(() => {
    if (state !== "extracting") return;

    const interval = setInterval(() => {
      setExtractIndex((index) => Math.min(index + 1, extractionLabels.length - 1));
    }, 700);

    const revealTimer = setTimeout(() => {
      setState("revealing");
      postOpacity.value = withTiming(0, { duration: 420 });
      recipeOpacity.value = withDelay(180, withTiming(1, { duration: 420 }));
      recipeY.value = withDelay(180, withSpring(0, { damping: 18, stiffness: 140 }));
      setTimeout(() => setState("complete"), 760);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(revealTimer);
    };
  }, [extractionLabels.length, postOpacity, recipeOpacity, recipeY, state]);

  const postStyle = useAnimatedStyle(() => ({
    opacity: postOpacity.value,
    transform: [{ scale: postScale.value }],
  }));

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value }],
  }));

  const recipeStyle = useAnimatedStyle(() => ({
    opacity: recipeOpacity.value,
    transform: [{ translateY: recipeY.value }],
  }));

  const startImport = () => {
    if (state !== "instagram") return;
    setState("extracting");
    setExtractIndex(0);
    postScale.value = withSpring(0.94, { damping: 18, stiffness: 140 });
    postOpacity.value = withTiming(0.42, { duration: 320 });
    scanY.value = withTiming(260, { duration: 2800 });
  };

  const handleContinue = async () => {
    await setQuestionnaireStep(9);
    router.push("/(questionnaire)/value");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("qDemoTitle")}</Text>
        <Text style={styles.subtitle}>{t("qDemoSubtitle")}</Text>
      </View>

      <View style={styles.stage}>
        <Animated.View style={[styles.instagramCard, postStyle]}>
          <View style={styles.igHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{demoRecipe.source.avatarInitials}</Text>
            </View>
            <View style={styles.igProfile}>
              <Text style={styles.username}>{demoRecipe.source.username}</Text>
              <Text style={styles.platform}>{demoRecipe.source.platform}</Text>
            </View>
            <Feather name="more-horizontal" size={22} color={onboardingColors.textMuted} />
          </View>

          <View style={styles.foodImage}>
            <Image source={onboardingImages.demoKabsaSocial} style={styles.foodMascot} resizeMode="cover" />
          </View>

          <View style={styles.engagement}>
            <View style={styles.engagementIcons}>
              <Feather name="heart" size={20} color={onboardingColors.text} />
              <Feather name="message-circle" size={20} color={onboardingColors.text} />
              <Feather name="send" size={20} color={onboardingColors.text} />
            </View>
            <Feather name="bookmark" size={20} color={onboardingColors.text} />
          </View>
          <Text style={styles.caption}>{demoRecipe.source.caption}</Text>

          {state === "extracting" ? (
            <Animated.View pointerEvents="none" style={[styles.scanLine, scanStyle]} />
          ) : null}
        </Animated.View>

        {state === "extracting" ? (
          <View style={styles.extractingPill}>
            <FontAwesome name="magic" size={14} color="#FFFFFF" />
            <Text style={styles.extractingText}>{extractionLabels[extractIndex]}</Text>
          </View>
        ) : null}

        <Animated.View style={[styles.recipeCard, recipeStyle]}>
          <View style={styles.savedBadge}>
            <FontAwesome name="check" size={12} color="#FFFFFF" />
            <Text style={styles.savedBadgeText}>{t("qDemoSavedBadge")}</Text>
          </View>
          <Text style={styles.recipeTitle}>{demoRecipe.title[textKey]}</Text>
          <Text style={styles.recipeDescription}>{demoRecipe.description[textKey]}</Text>

          <View style={styles.metaRow}>
            <Meta label={`${demoRecipe.prepMinutes + demoRecipe.cookMinutes}m`} icon="clock" />
            <Meta label={`${demoRecipe.servings}`} icon="users" />
            <Meta label={`${demoRecipe.calories}`} icon="activity" />
          </View>

          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>{t("ingredients")}</Text>
            {demoRecipe.ingredients.slice(0, 3).map((item) => (
              <Text key={item.en} style={styles.previewLine}>• {item[textKey]}</Text>
            ))}
          </View>

          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>{t("steps")}</Text>
            {demoRecipe.steps.slice(0, 2).map((item, index) => (
              <Text key={item.en} style={styles.previewLine}>{index + 1}. {item[textKey]}</Text>
            ))}
          </View>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        {state === "complete" ? (
          <Pressable style={styles.cta} onPress={handleContinue}>
            <Text style={styles.ctaText}>{t("qDemoContinue")}</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.cta, state !== "instagram" && styles.ctaDisabled]}
            onPress={startImport}
            disabled={state !== "instagram"}
          >
            <FontAwesome name="magic" size={16} color="#FFFFFF" />
            <Text style={styles.ctaText}>{t("qDemoImportButton")}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function Meta({ icon, label }: { icon: ComponentProps<typeof Feather>["name"]; label: string }) {
  return (
    <View style={styles.meta}>
      <Feather name={icon} size={14} color={onboardingColors.primaryDark} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: onboardingColors.backgroundBase,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "900",
    color: onboardingColors.primaryDark,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 23,
    color: onboardingColors.textMuted,
    textAlign: "center",
  },
  stage: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  instagramCard: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  igHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: onboardingColors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  igProfile: {
    flex: 1,
    marginHorizontal: 10,
  },
  username: {
    fontSize: 14,
    fontWeight: "900",
    color: onboardingColors.text,
  },
  platform: {
    fontSize: 12,
    color: onboardingColors.textMuted,
  },
  foodImage: {
    height: 230,
    backgroundColor: "#F7EAD5",
    alignItems: "center",
    justifyContent: "center",
  },
  foodMascot: {
    width: "100%",
    height: "100%",
  },
  engagement: {
    paddingHorizontal: 14,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  engagementIcons: {
    flexDirection: "row",
    gap: 14,
  },
  caption: {
    padding: 14,
    paddingTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: onboardingColors.text,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 72,
    height: 70,
    backgroundColor: "rgba(43,168,138,0.24)",
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: onboardingColors.teal,
  },
  extractingPill: {
    position: "absolute",
    alignSelf: "center",
    top: "50%",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: onboardingColors.primaryDark,
  },
  extractingText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  recipeCard: {
    position: "absolute",
    left: 22,
    right: 22,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: onboardingColors.border,
    padding: 18,
  },
  savedBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: onboardingColors.teal,
  },
  savedBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  recipeTitle: {
    marginTop: 14,
    fontSize: 28,
    fontWeight: "900",
    color: onboardingColors.text,
  },
  recipeDescription: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: onboardingColors.textMuted,
  },
  metaRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: onboardingColors.accent,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "900",
    color: onboardingColors.primaryDark,
  },
  previewSection: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: onboardingColors.text,
  },
  previewLine: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
    color: onboardingColors.textMuted,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cta: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: onboardingColors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
  },
});
