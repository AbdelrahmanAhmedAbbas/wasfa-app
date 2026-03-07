import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { OnboardingScaffold } from "@/components/onboarding/OnboardingScaffold";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { saveOnboardingAnswers } from "@/lib/onboarding/answers";
import { onboardingColors } from "@/lib/theme/onboarding";

type CounterKey = "adults" | "children" | "infants";

export default function FamilyOnboardingScreen() {
  const { isRTL, t } = useLanguage();
  const textAlign = isRTL ? "right" : "left";

  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  function updateCounter(key: CounterKey, delta: number) {
    if (key === "adults") {
      setAdults((value) => Math.max(1, value + delta));
      return;
    }

    if (key === "children") {
      setChildren((value) => Math.max(0, value + delta));
      return;
    }

    setInfants((value) => Math.max(0, value + delta));
  }

  async function continueNext() {
    await saveOnboardingAnswers({
      family: { adults, children, infants },
    });

    router.push("/(onboarding)/frequency");
  }

  return (
    <OnboardingScaffold
      progress={0.5}
      title={t("onFamilyTitle")}
      onBack={() => router.back()}
      onContinue={() => void continueNext()}
      continueLabel={t("onNext")}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>👨‍👩‍👧‍👦</Text>
      </View>

      <View style={styles.countersCard}>
        <CounterRow
          rtl={isRTL}
          label={t("onFamilyAdults")}
          subLabel={t("onFamilyAdultsAge")}
          value={adults}
          onIncrease={() => updateCounter("adults", 1)}
          onDecrease={() => updateCounter("adults", -1)}
          canDecrease={adults > 1}
          textAlign={textAlign}
        />
        <CounterRow
          rtl={isRTL}
          label={t("onFamilyChildren")}
          subLabel={t("onFamilyChildrenAge")}
          value={children}
          onIncrease={() => updateCounter("children", 1)}
          onDecrease={() => updateCounter("children", -1)}
          canDecrease={children > 0}
          textAlign={textAlign}
        />
        <CounterRow
          rtl={isRTL}
          label={t("onFamilyInfants")}
          subLabel={t("onFamilyInfantsAge")}
          value={infants}
          onIncrease={() => updateCounter("infants", 1)}
          onDecrease={() => updateCounter("infants", -1)}
          canDecrease={infants > 0}
          textAlign={textAlign}
        />
      </View>
    </OnboardingScaffold>
  );
}

function CounterRow({
  rtl,
  label,
  subLabel,
  value,
  onIncrease,
  onDecrease,
  canDecrease,
  textAlign,
}: {
  rtl: boolean;
  label: string;
  subLabel: string;
  value: number;
  onIncrease: () => void;
  onDecrease: () => void;
  canDecrease: boolean;
  textAlign: "left" | "right";
}) {
  return (
    <View style={[styles.row, rtl && styles.rowRtl]}>
      <View style={styles.rowTextWrap}>
        <Text style={[styles.rowTitle, { textAlign }]}>{label}</Text>
        <Text style={[styles.rowSubTitle, { textAlign }]}>{subLabel}</Text>
      </View>

      <View style={[styles.actions, rtl && styles.actionsRtl]}>
        <Pressable
          style={[styles.counterButton, !canDecrease && styles.counterButtonDisabled]}
          onPress={onDecrease}
          disabled={!canDecrease}
        >
          <Text style={styles.counterLabel}>−</Text>
        </Pressable>
        <Text style={styles.count}>{value}</Text>
        <Pressable style={styles.counterButton} onPress={onIncrease}>
          <Text style={styles.counterLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    marginTop: 14,
    alignItems: "center",
  },
  icon: {
    fontSize: 56,
  },
  countersCard: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: "#F2EDE4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowRtl: {
    flexDirection: "row-reverse",
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    color: onboardingColors.text,
    fontWeight: "700",
  },
  rowSubTitle: {
    marginTop: 3,
    fontSize: 13,
    color: onboardingColors.textMuted,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 8,
  },
  actionsRtl: {
    marginLeft: 0,
    marginRight: 8,
    flexDirection: "row-reverse",
  },
  counterButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: "#FBF9F4",
    alignItems: "center",
    justifyContent: "center",
  },
  counterButtonDisabled: {
    opacity: 0.4,
  },
  counterLabel: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    color: onboardingColors.text,
  },
  count: {
    minWidth: 18,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: onboardingColors.text,
  },
});
