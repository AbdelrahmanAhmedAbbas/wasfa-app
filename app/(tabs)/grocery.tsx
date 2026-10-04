import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocalizedText as Text } from "@/components/LocalizedText";
import { ScreenTransition } from "@/components/navigation/ScreenTransition";
import { CheckBox } from "@/components/wasfa/CheckBox";
import { FoodIconTile, Glyph } from "@/components/wasfa/Glyph";
import Feather from "@expo/vector-icons/Feather";
import { checkCarrefourReach } from "@/lib/grocery-prices/carrefour";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { toArabicIndicDigits } from "@/lib/recipes/numerals";
import {
  deleteShoppingListItem,
  listShoppingListItems,
  toggleShoppingListItemChecked,
  type ShoppingListItem,
} from "@/lib/shopping/client";
import { publishShoppingItems } from "@/lib/shopping/badge";
import { mergeShoppingItems } from "@/lib/shopping/merge";
import { getFoodGlyph } from "@/lib/theme/glyphs";
import { onboardingImages } from "@/lib/theme/onboarding";
import { getTabBarClearance, wasfaColors } from "@/lib/theme/wasfa";

const CARREFOUR_CHECK_TERMS = [
  "أرز مصري", "دجاج", "طماطم", "بصل", "ثوم", "زيت زيتون", "لبن", "بيض", "زبدة", "دقيق",
];

type GroupedItem = {
  id: string;
  ingredient_text: string;
  /** Ingredient name without amount/unit, used for the icon tile and basket chip. */
  name: string;
  checked: boolean;
  relatedItems: ShoppingListItem[];
  recipes: Set<string>;
};

function getShoppingRecipeTitle(item: ShoppingListItem, language: "en" | "ar") {
  return item.recipe?.localized?.[language]?.title || item.recipe?.title || "Recipe";
}

function groupItems(items: ShoppingListItem[], language: "en" | "ar"): GroupedItem[] {
  return mergeShoppingItems(items).map((group) => {
    // A recipe is named once on the row, however many of its lines merged into it.
    const recipeTitles = new Map<string, string>();
    group.items.forEach((item) => {
      recipeTitles.set(item.recipe?.id ?? item.recipe_id, getShoppingRecipeTitle(item, language));
    });

    return {
      id: `group-${group.key}`,
      ingredient_text: group.text,
      name: group.name,
      checked: group.items.every((item) => item.checked),
      relatedItems: group.items,
      recipes: new Set(recipeTitles.values()),
    };
  });
}

export default function GroceryScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipeFilter, setRecipeFilter] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await listShoppingListItems();
      setItems(data);
      setError(null);
    } catch {
      setError(t("groceryLoadError"));
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, [t]);

  // The list changes whenever a recipe is planned elsewhere, so refresh on focus.
  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnce.current) setLoading(true);
      void load();
    }, [load])
  );

  // Checking items off or removing them here changes the count on the tab icon.
  useEffect(() => {
    if (hasLoadedOnce.current) publishShoppingItems(items);
  }, [items]);

  const localizeDigits = (value: string) => (language === "ar" ? toArabicIndicDigits(value) : value);
  // Ingredient text stays in the recipe's own language, so only Arabic text gets Arabic digits.
  const localizeIngredient = (value: string) =>
    /[\u0600-\u06FF]/.test(value) ? localizeDigits(value) : value;

  const recipeChips = useMemo(() => {
    const recipeTitles = new Map<string, string>();
    items.forEach((item) => {
      recipeTitles.set(item.recipe?.id ?? item.recipe_id, getShoppingRecipeTitle(item, language));
    });
    return Array.from(recipeTitles, ([id, title]) => ({ id, title }));
  }, [items, language]);

  // A filtered recipe can disappear (unplanned elsewhere); fall back to "All".
  const activeFilter = recipeChips.some((chip) => chip.id === recipeFilter) ? recipeFilter : null;

  const groupedItems = useMemo(
    () =>
      groupItems(
        activeFilter
          ? items.filter((item) => (item.recipe?.id ?? item.recipe_id) === activeFilter)
          : items,
        language
      ),
    [activeFilter, items, language]
  );
  const toBuy = groupedItems.filter((group) => !group.checked);
  const inBasket = groupedItems.filter((group) => group.checked);
  const progress = groupedItems.length > 0 ? inBasket.length / groupedItems.length : 0;

  const toggleGroup = async (group: GroupedItem) => {
    const next = !group.checked;
    setItems((prev) => prev.map((entry) =>
      group.relatedItems.some((r) => r.id === entry.id) ? { ...entry, checked: next } : entry
    ));
    try {
      await Promise.all(group.relatedItems.map((item) => toggleShoppingListItemChecked(item.id, next)));
    } catch {
      void load(); // revert
      setError(t("groceryUpdateError"));
    }
  };

  const removeGroup = async (group: GroupedItem) => {
    const prev = items;
    setItems((current) => current.filter((entry) => !group.relatedItems.some((r) => r.id === entry.id)));
    try {
      await Promise.all(group.relatedItems.map((item) => deleteShoppingListItem(item.id)));
    } catch {
      setItems(prev);
      setError(t("groceryRemoveError"));
    }
  };

  // Development builds only: long-press the title to check that this phone can read
  // Carrefour's search pages, which the site refuses to server addresses.
  const checkCarrefour = async () => {
    setError("Checking Carrefour…");
    const report = await checkCarrefourReach(CARREFOUR_CHECK_TERMS);
    setError(null);
    Alert.alert(
      `Carrefour: ${report.withProducts} of ${report.searches} in ${report.seconds.toFixed(1)}s`,
      report.lines.join("\n")
    );
  };

  const confirmRemoveGroup = (group: GroupedItem) => {
    Alert.alert(t("groceryRemoveTitle"), group.ingredient_text, [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => void removeGroup(group) },
    ]);
  };

  if (loading) {
    return (
      <ScreenTransition>
        <View style={styles.centerContainer}>
          <ActivityIndicator color={wasfaColors.primary} />
          <Text style={styles.loadingText}>{t("loadingShoppingList")}</Text>
        </View>
      </ScreenTransition>
    );
  }

  const renderChip = (id: string | null, label: string) => {
    const active = activeFilter === id;
    return (
      <Pressable
        key={id ?? "all"}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => setRecipeFilter(active ? null : id)}
      >
        <Text numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const chips = [
    renderChip(null, t("groceryAll")),
    ...recipeChips.map((chip) => renderChip(chip.id, chip.title)),
  ];

  return (
    <ScreenTransition>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 18, paddingBottom: getTabBarClearance(insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow} onLongPress={__DEV__ ? () => void checkCarrefour() : undefined}>
          {t("groceryTitle")}
        </Text>
        {items.length > 0 ? (
          <>
            <View style={styles.countRow}>
              <Text style={styles.count}>{localizeDigits(String(toBuy.length))}</Text>
              <Text style={styles.countLabel}>{t("groceryLeft")}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Image source={onboardingImages.mascotReading} style={styles.emptyImage} resizeMode="contain" />
            <Text style={styles.emptyTitle}>{t("groceryEmptyTitle")}</Text>
            <Text style={styles.emptyBody}>{t("groceryEmptyBody")}</Text>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroller}
              contentContainerStyle={styles.chipRow}
            >
              {chips}
            </ScrollView>

            <Text style={[styles.sectionLabel, language === "en" && styles.sectionLabelLatin]}>
              {t("groceryToBuy")}
            </Text>
            {toBuy.length === 0 ? <Text style={styles.allDone}>{t("groceryAllDone")}</Text> : null}
            {toBuy.map((group) => (
              <Pressable
                key={group.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false }}
                style={styles.itemCard}
                onPress={() => void toggleGroup(group)}
                onLongPress={() => confirmRemoveGroup(group)}
              >
                <FoodIconTile name={group.name} size={48} />
                <View style={styles.itemBody}>
                  <Text style={styles.itemText}>{localizeIngredient(group.ingredient_text)}</Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {Array.from(group.recipes).join(" · ")}
                  </Text>
                </View>
                <CheckBox checked={false} />
              </Pressable>
            ))}

            {inBasket.length > 0 ? (
              <View style={styles.basketCard}>
                <View style={styles.basketHeader}>
                  <Feather name="shopping-bag" size={18} color={wasfaColors.primaryDark} />
                  <Text style={styles.basketTitle}>
                    {`${t("groceryBasket")} · ${localizeDigits(String(inBasket.length))}`}
                  </Text>
                </View>
                <View style={styles.basketChips}>
                  {inBasket.map((group) => (
                    <Pressable
                      key={group.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: true }}
                      style={styles.basketChip}
                      onPress={() => void toggleGroup(group)}
                      onLongPress={() => confirmRemoveGroup(group)}
                    >
                      <Glyph name={getFoodGlyph(group.name)} size={16} color={wasfaColors.muted} />
                      <Text numberOfLines={1} style={styles.basketChipText}>
                        {group.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: wasfaColors.surface,
  },
  content: {
    paddingHorizontal: 20,
    gap: 14,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: wasfaColors.surface,
    gap: 10,
  },
  loadingText: {
    color: wasfaColors.muted,
    fontSize: 14,
  },
  eyebrow: {
    fontSize: 15,
    fontWeight: "700",
    color: wasfaColors.muted,
    textAlign: "left",
  },
  countRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  count: {
    fontSize: 60,
    // Tall line box: Arabic-Indic digits clip at the top in a tight one.
    lineHeight: 80,
    fontWeight: "800",
    letterSpacing: -1.8,
    color: wasfaColors.cta,
  },
  countLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: wasfaColors.ink,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: wasfaColors.line,
    flexDirection: "row",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: wasfaColors.primary,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    color: wasfaColors.danger,
    textAlign: "left",
  },
  chipScroller: {
    marginHorizontal: -20,
    flexGrow: 0,
  },
  chipRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    height: 40,
    maxWidth: 220,
    borderRadius: 20,
    paddingHorizontal: 16,
    backgroundColor: wasfaColors.warm,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: wasfaColors.cta,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "700",
    color: wasfaColors.ink,
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  sectionLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "800",
    color: wasfaColors.muted,
    textAlign: "left",
  },
  // Uppercase tracking only suits Latin script; letter spacing breaks Arabic joining.
  sectionLabelLatin: {
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  allDone: {
    fontSize: 15,
    fontWeight: "600",
    color: wasfaColors.primaryDark,
    textAlign: "left",
  },
  itemCard: {
    marginTop: -6,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingStart: 8,
    paddingEnd: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: wasfaColors.line,
    backgroundColor: wasfaColors.surface,
  },
  itemBody: {
    flex: 1,
    gap: 1,
  },
  itemText: {
    fontSize: 16,
    fontWeight: "700",
    color: wasfaColors.ink,
    textAlign: "left",
  },
  itemMeta: {
    fontSize: 12,
    color: wasfaColors.muted,
    textAlign: "left",
  },
  basketCard: {
    marginTop: 6,
    borderRadius: 24,
    backgroundColor: wasfaColors.primarySoft,
    padding: 14,
    gap: 10,
  },
  basketHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  basketTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: wasfaColors.primaryDark,
  },
  basketChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  basketChip: {
    height: 36,
    maxWidth: "100%",
    borderRadius: 18,
    paddingStart: 8,
    paddingEnd: 12,
    backgroundColor: wasfaColors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  basketChipText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "600",
    color: wasfaColors.muted,
    textDecorationLine: "line-through",
  },
  emptyCard: {
    marginTop: 6,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: wasfaColors.checkBorder,
    backgroundColor: wasfaColors.soft,
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  emptyImage: {
    width: 110,
    height: 110,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: wasfaColors.ink,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    color: wasfaColors.muted,
    textAlign: "center",
  },
});
