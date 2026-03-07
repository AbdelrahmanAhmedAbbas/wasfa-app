import { StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export default function PlannerScreen() {
  const { isRTL, t } = useLanguage();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>
        {t("screenComingSoonTitle")}
      </Text>
      <Text style={[styles.subtitle, { textAlign: isRTL ? "right" : "left" }]}>
        {t("screenComingSoonBody")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8DCCB",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#252821",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: "#4f5347",
  },
});
