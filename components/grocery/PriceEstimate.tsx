import Feather from "@expo/vector-icons/Feather";
import { useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { CtaButton } from "@/components/wasfa/CtaButton";
import { FoodIconTile } from "@/components/wasfa/Glyph";
import { estimateGroceryPrices, type GroceryLine } from "@/lib/grocery-prices/client";
import {
  summarizeEstimate,
  type PricedItem,
  type StoreId,
  type StoreLine,
} from "@/lib/grocery-prices/estimate";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { toArabicIndicDigits } from "@/lib/recipes/numerals";
import { wasfaColors } from "@/lib/theme/wasfa";

const STORE_NAME_KEYS: Record<StoreId, TranslationKey> = {
  carrefour: "priceStoreCarrefour",
  spinneys: "priceStoreSpinneys",
  hyperone: "priceStoreHyperOne",
};

// Each store's own brand colour, behind its initial.
const STORE_COLORS: Record<StoreId, string> = {
  carrefour: "#1E4FA3",
  spinneys: "#0B7A3B",
  hyperone: "#D32027",
};

type Props = {
  /** The lines still to buy. */
  lines: GroceryLine[];
};

/** Prices the list at the three stores on tap and shows each store's total. */
export function PriceEstimate({ lines }: Props) {
  const { t, language } = useLanguage();
  const [priced, setPriced] = useState<PricedItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  /** A store, or "split", whose product list is open. */
  const [open, setOpen] = useState<StoreId | "split" | null>(null);

  const summary = useMemo(() => (priced ? summarizeEstimate(priced) : null), [priced]);

  const money = (value: number, whole = false) => {
    const amount = whole ? String(Math.round(value)) : String(Math.round(value * 100) / 100);
    return `${language === "ar" ? toArabicIndicDigits(amount) : amount} ${t("priceCurrency")}`;
  };
  const number = (value: number) => (language === "ar" ? toArabicIndicDigits(String(value)) : String(value));

  const estimate = async () => {
    setLoading(true);
    setFailed(false);
    try {
      setPriced(await estimateGroceryPrices(lines));
      setOpen(null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const renderLine = (line: StoreLine) => (
    <View key={line.key} style={styles.line}>
      {line.match?.imageUrl ? (
        <Image source={{ uri: line.match.imageUrl }} style={styles.photo} resizeMode="contain" />
      ) : (
        <FoodIconTile name={line.name} size={44} />
      )}
      <View style={styles.lineBody}>
        <Text style={styles.lineName} numberOfLines={2}>
          {line.match ? line.match.name : line.name}
        </Text>
        <Text style={styles.lineMeta} numberOfLines={1}>
          {line.match
            ? `${number(line.match.quantity)} ${line.match.soldByWeight ? t("priceKilo") : "×"} ${money(line.match.price)}`
            : t("priceAverageElsewhere")}
        </Text>
      </View>
      <Text style={[styles.lineCost, !line.match && styles.estimated]}>
        {`${line.match ? "" : "~"}${money(line.cost)}`}
      </Text>
    </View>
  );

  const storeBadge = (store: StoreId) => (
    <View style={[styles.storeBadge, { backgroundColor: STORE_COLORS[store] }]}>
      <Text style={styles.storeInitial}>{t(STORE_NAME_KEYS[store]).charAt(0)}</Text>
    </View>
  );

  if (!summary) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t("priceTitle")}</Text>
        <Text style={styles.body}>{failed ? t("priceError") : t("priceIntro")}</Text>
        <CtaButton label={failed ? t("priceRetry") : t("priceEstimate")} loading={loading} onPress={() => void estimate()} />
        {loading ? <Text style={styles.note}>{t("priceLoading")}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("priceTitle")}</Text>
        <Pressable accessibilityRole="button" disabled={loading} onPress={() => void estimate()} hitSlop={10}>
          {loading ? (
            <ActivityIndicator color={wasfaColors.primary} />
          ) : (
            <Text style={styles.refresh}>{t("priceRefresh")}</Text>
          )}
        </Pressable>
      </View>
      {failed ? <Text style={styles.error}>{t("priceError")}</Text> : null}
      {summary.stores.length === 0 ? <Text style={styles.body}>{t("priceNothingFound")}</Text> : null}

      {summary.stores.map((store, index) => (
        <View key={store.store}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open === store.store }}
            style={[styles.storeRow, !store.ranked && styles.unranked]}
            onPress={() => setOpen(open === store.store ? null : store.store)}
          >
            {storeBadge(store.store)}
            <View style={styles.storeBody}>
              <Text style={styles.storeName}>{t(STORE_NAME_KEYS[store.store])}</Text>
              {store.missing > 0 ? (
                <Text style={styles.lineMeta}>
                  {`${number(store.missing)} ${t(store.ranked ? "priceMissing" : "priceMissingTooMany")}`}
                </Text>
              ) : null}
            </View>
            {index === 0 && store.ranked ? <Text style={styles.cheapest}>{t("priceCheapest")}</Text> : null}
            <Text style={styles.storeTotal}>{money(store.total, true)}</Text>
            <Feather name={open === store.store ? "chevron-up" : "chevron-down"} size={18} color={wasfaColors.muted} />
          </Pressable>
          {open === store.store ? <View style={styles.lines}>{store.lines.map(renderLine)}</View> : null}
        </View>
      ))}

      {summary.split ? (
        <View style={styles.split}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open === "split" }}
            style={styles.splitHeader}
            onPress={() => setOpen(open === "split" ? null : "split")}
          >
            <View style={styles.storeBody}>
              <Text style={styles.splitTitle}>{`${t("priceSplitSave")} ${money(summary.split.saving, true)}`}</Text>
              <Text style={styles.lineMeta}>
                {summary.split.lists
                  .map((list) => `${t(STORE_NAME_KEYS[list.store])} ${money(list.total, true)}`)
                  .join(" + ")}
              </Text>
            </View>
            <Feather name={open === "split" ? "chevron-up" : "chevron-down"} size={18} color={wasfaColors.primaryDark} />
          </Pressable>
          {open === "split"
            ? summary.split.lists.map((list) => (
                <View key={list.store} style={styles.lines}>
                  <View style={styles.splitStore}>
                    {storeBadge(list.store)}
                    <Text style={styles.storeName}>{t(STORE_NAME_KEYS[list.store])}</Text>
                  </View>
                  {list.lines.map(renderLine)}
                </View>
              ))
            : null}
        </View>
      ) : null}

      {summary.unpriced.length > 0 ? (
        <Text style={styles.note}>
          {`${t("priceNotFound")} ${summary.unpriced.map((item) => item.name).join(language === "ar" ? "، " : ", ")}`}
        </Text>
      ) : null}
      <Text style={styles.note}>{t("priceDisclaimer")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.soft,
    padding: 16,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: wasfaColors.muted,
    textAlign: "left",
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    color: wasfaColors.muted,
    textAlign: "left",
  },
  error: {
    fontSize: 13,
    fontWeight: "600",
    color: wasfaColors.danger,
    textAlign: "left",
  },
  refresh: {
    fontSize: 14,
    fontWeight: "700",
    color: wasfaColors.primaryDark,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: wasfaColors.surface,
  },
  unranked: {
    opacity: 0.6,
  },
  storeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  storeInitial: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  storeBody: {
    flex: 1,
    gap: 1,
  },
  storeName: {
    fontSize: 15,
    fontWeight: "700",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  storeTotal: {
    fontSize: 16,
    fontWeight: "800",
    color: wasfaColors.ink,
  },
  cheapest: {
    overflow: "hidden",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "800",
    color: wasfaColors.primaryDark,
    backgroundColor: wasfaColors.primarySoft,
  },
  lines: {
    paddingTop: 8,
    paddingHorizontal: 4,
    gap: 10,
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  photo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: wasfaColors.surface,
  },
  lineBody: {
    flex: 1,
    gap: 1,
  },
  lineName: {
    fontSize: 13,
    fontWeight: "600",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  lineMeta: {
    fontSize: 12,
    color: wasfaColors.muted,
    textAlign: "left",
  },
  lineCost: {
    fontSize: 13,
    fontWeight: "700",
    color: wasfaColors.ink,
  },
  estimated: {
    color: wasfaColors.muted,
  },
  split: {
    borderRadius: 18,
    backgroundColor: wasfaColors.primarySoft,
    padding: 12,
    gap: 6,
  },
  splitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  splitTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: wasfaColors.primaryDark,
    textAlign: "left",
  },
  splitStore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
