import { LocalizedText as Text } from "@/components/LocalizedText";
import { ScreenTransition } from "@/components/navigation/ScreenTransition";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  deleteShoppingListItem,
  listShoppingListItems,
  toggleShoppingListItemChecked,
  type ShoppingListItem,
} from "@/lib/shopping/client";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";


function parseIngredientText(text: string) {
  // Try to match: optional numbers/fractions at start, optional unit, and the name
  const regex = /^([\d\s\.\/]+)?\s*(cup|cups|tbsp|tsp|g|kg|ml|l|liter|liters|oz|lb|lbs|clove|cloves|piece|pieces)?\s+(.+)$/i;
  const match = text.trim().match(regex);
  if (!match) return { amount: null, unit: null, name: text.trim().toLowerCase(), original: text };

  let numStr = (match[1] || "").trim();
  let unit = (match[2] || "").toLowerCase();
  let name = match[3].trim().toLowerCase();

  let amount: number | null = null;
  if (numStr) {
    let sum = 0;
    const parts = numStr.split(" ");
    for (const p of parts) {
      if (p.includes("/")) {
        const [n, d] = p.split("/");
        if (d && Number(d) !== 0) sum += Number(n) / Number(d);
      } else {
        sum += Number(p);
      }
    }
    amount = isNaN(sum) ? null : sum;
  }

  if (unit === "cups") unit = "cup";
  if (unit === "liters" || unit === "liter") unit = "l";
  if (unit === "lbs") unit = "lb";
  if (unit === "cloves") unit = "clove";
  if (unit === "pieces") unit = "piece";

  return { amount, unit, name, original: text };
}

type GroupedItem = {
  id: string;
  ingredient_text: string;
  checked: boolean;
  relatedItems: ShoppingListItem[];
  recipes: Set<string>;
};

function getShoppingRecipeTitle(item: ShoppingListItem, language: "en" | "ar") {
  return item.recipe?.localized?.[language]?.title || item.recipe?.title || "Recipe";
}

function groupItems(items: ShoppingListItem[], language: "en" | "ar"): GroupedItem[] {
  const groups: Record<string, {
    amount: number;
    unit: string | null;
    name: string;
    checked: boolean;
    related: ShoppingListItem[];
    recipes: Set<string>;
    recipeTitles: Record<string, string>;
  }> = {};

  const ungrouped: GroupedItem[] = [];

  items.forEach(item => {
    const { amount, unit, name, original } = parseIngredientText(item.ingredient_text);
    const recipeId = item.recipe?.id ?? item.recipe_id;
    const recipeTitle = getShoppingRecipeTitle(item, language);

    // If no amount can be parsed, or name is empty, just push it ungrouped
    if (amount === null || !name) {
      ungrouped.push({
        id: item.id,
        ingredient_text: item.ingredient_text,
        checked: item.checked,
        relatedItems: [item],
        recipes: new Set([recipeTitle])
      });
      return;
    }

    const key = `${unit || "none"}|${name}`;

    if (!groups[key]) {
      groups[key] = {
        amount,
        unit,
        name,
        checked: item.checked,
        related: [item],
        recipes: new Set([recipeTitle]),
        recipeTitles: { [recipeId]: recipeTitle }
      };
    } else {
      groups[key].amount += amount;
      groups[key].checked = groups[key].checked && item.checked;
      groups[key].related.push(item);
      groups[key].recipeTitles[recipeId] = recipeTitle;
      groups[key].recipes.add(recipeTitle);
    }
  });

  const grouped = Object.values(groups).map((g, i) => {
    // Format the combined amount
    const rounded = Math.round(g.amount * 100) / 100;
    const text = `${rounded} ${g.unit ? g.unit + " " : ""}${g.name}`;

    return {
      id: `group-${i}`,
      ingredient_text: text,
      checked: g.checked,
      relatedItems: g.related,
      recipes: g.recipes
    };
  });

  return [...grouped, ...ungrouped];
}

export default function GroceryScreen() {
  const { isRTL, t, language } = useLanguage();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listShoppingListItems();
      setItems(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load shopping list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);


  const align = isRTL ? "right" : "left";

  const groupedItems = useMemo(() => groupItems(items, language), [items, language]);

  const toggleGroup = async (group: GroupedItem) => {
    const next = !group.checked;
    setItems((prev) => prev.map((entry) =>
      group.relatedItems.some((r) => r.id === entry.id) ? { ...entry, checked: next } : entry
    ));
    try {
      await Promise.all(group.relatedItems.map((item) => toggleShoppingListItemChecked(item.id, next)));
    } catch (e) {
      void load(); // revert
      setError(e instanceof Error ? e.message : "Failed to update item.");
    }
  };

  const removeGroup = async (group: GroupedItem) => {
    const prev = items;
    setItems((current) => current.filter((entry) => !group.relatedItems.some((r) => r.id === entry.id)));
    try {
      await Promise.all(group.relatedItems.map((item) => deleteShoppingListItem(item.id)));
    } catch (e) {
      setItems(prev);
      setError(e instanceof Error ? e.message : "Failed to remove item.");
    }
  };

  if (loading) {
    return (
      <ScreenTransition>
        <View style={styles.centerContainer}>
          <ActivityIndicator color={onboardingColors.primary} />
          <Text style={styles.loadingText}>{t("loadingShoppingList")}</Text>
        </View>
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroText}>
              <Text style={[styles.title, { textAlign: align }]}>{t("shoppingListTitle")}</Text>
              <Text style={[styles.subtitle, { textAlign: align }]}>
                {t("shoppingListSubtitle")}
              </Text>
            </View>
            <Image source={onboardingImages.mascot} style={styles.heroImage} resizeMode="contain" />
          </View>
        </View>

        {error ? (
          <Text style={[styles.errorText, { textAlign: align }]}>{error}</Text>
        ) : null}

        {groupedItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Image source={onboardingImages.mascotReading} style={styles.emptyImage} resizeMode="contain" />
            <Text style={[styles.emptyTitle, { textAlign: align }]}>{t("noItemsYet")}</Text>
            <Text style={[styles.emptyBody, { textAlign: align }]}>
              {t("noItemsHint")}
            </Text>
          </View>
        ) : (
          groupedItems.map((group) => {
            const sources = Array.from(group.recipes).join(", ");
            return (
              <View key={group.id} style={styles.itemCard}>
                <Pressable style={styles.checkbox} onPress={() => void toggleGroup(group)}>
                  <Text style={styles.checkboxText}>{group.checked ? "✓" : ""}</Text>
                </Pressable>
                <View style={styles.itemBody}>
                  <Text
                    style={[
                      styles.itemText,
                      group.checked && styles.itemTextChecked,
                      { textAlign: align },
                    ]}
                  >
                    {group.ingredient_text}
                  </Text>
                  <Text style={[styles.itemMeta, { textAlign: align }]} numberOfLines={1}>
                    {sources}
                  </Text>
                </View>
                <Pressable style={styles.removeButton} onPress={() => void removeGroup(group)}>
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: onboardingColors.backgroundBase,
  },
  content: {
    padding: 16,
    paddingBottom: 44,
    gap: 12,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: onboardingColors.backgroundBase,
    gap: 10,
  },
  loadingText: {
    color: onboardingColors.textMuted,
    fontSize: 14,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    padding: 14,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroText: {
    flex: 1,
  },
  heroImage: {
    width: 68,
    height: 68,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: onboardingColors.primaryDark,
  },
  subtitle: {
    marginTop: 5,
    fontSize: 16,
    lineHeight: 22,
    color: onboardingColors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: "#933f3f",
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.cardSoft,
    alignItems: "center",
    padding: 16,
  },
  emptyImage: {
    width: 126,
    height: 126,
  },
  emptyTitle: {
    marginTop: 4,
    fontSize: 19,
    fontWeight: "800",
    color: onboardingColors.primaryDark,
  },
  emptyBody: {
    marginTop: 6,
    fontSize: 14,
    color: onboardingColors.textMuted,
  },
  itemCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.card,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: onboardingColors.accentBorder,
    backgroundColor: onboardingColors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxText: {
    color: onboardingColors.primaryDark,
    fontWeight: "800",
    fontSize: 13,
  },
  itemBody: {
    flex: 1,
    gap: 3,
  },
  itemText: {
    fontSize: 15,
    color: onboardingColors.text,
  },
  itemTextChecked: {
    textDecorationLine: "line-through",
    color: onboardingColors.textMuted,
  },
  itemMeta: {
    fontSize: 12,
    color: onboardingColors.primaryAccent,
    fontWeight: "700",
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff1f1",
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: {
    color: "#a54242",
    fontSize: 18,
    lineHeight: 20,
  },
});
