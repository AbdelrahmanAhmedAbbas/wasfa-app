import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { LocalizedText as Text } from "@/components/LocalizedText";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  deleteShoppingListItem,
  listShoppingListItems,
  toggleShoppingListItemChecked,
  type ShoppingListItem,
} from "@/lib/shopping/client";
import { onboardingColors, onboardingImages } from "@/lib/theme/onboarding";

export default function GroceryScreen() {
  const { isRTL } = useLanguage();
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

  const toggleItem = async (item: ShoppingListItem) => {
    const next = !item.checked;
    setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, checked: next } : entry)));
    try {
      await toggleShoppingListItemChecked(item.id, next);
    } catch (e) {
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, checked: item.checked } : entry)));
      setError(e instanceof Error ? e.message : "Failed to update item.");
    }
  };

  const removeItem = async (item: ShoppingListItem) => {
    const prev = items;
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    try {
      await deleteShoppingListItem(item.id);
    } catch (e) {
      setItems(prev);
      setError(e instanceof Error ? e.message : "Failed to remove item.");
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={onboardingColors.primary} />
        <Text style={styles.loadingText}>Loading shopping list...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Text style={[styles.title, { textAlign: align }]}>Shopping list</Text>
            <Text style={[styles.subtitle, { textAlign: align }]}>
              Ingredients added from recipes appear here and are checked by default.
            </Text>
          </View>
          <Image source={onboardingImages.mascot} style={styles.heroImage} resizeMode="contain" />
        </View>
      </View>

      {error ? (
        <Text style={[styles.errorText, { textAlign: align }]}>{error}</Text>
      ) : null}

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Image source={onboardingImages.mascotReading} style={styles.emptyImage} resizeMode="contain" />
          <Text style={[styles.emptyTitle, { textAlign: align }]}>No items yet</Text>
          <Text style={[styles.emptyBody, { textAlign: align }]}>
            Open a recipe and tap &quot;Add To Shopping List&quot;.
          </Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <Pressable style={styles.checkbox} onPress={() => void toggleItem(item)}>
              <Text style={styles.checkboxText}>{item.checked ? "✓" : ""}</Text>
            </Pressable>
            <View style={styles.itemBody}>
              <Text
                style={[
                  styles.itemText,
                  item.checked && styles.itemTextChecked,
                  { textAlign: align },
                ]}
              >
                {item.ingredient_text}
              </Text>
              <Text style={[styles.itemMeta, { textAlign: align }]}>
                {item.recipe?.title ?? "Recipe"}
              </Text>
            </View>
            <Pressable style={styles.removeButton} onPress={() => void removeItem(item)}>
              <Text style={styles.removeText}>×</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
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
