import { useMemo } from "react";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

import { useLocalizedShoppingList } from "./client";
import { countItemsToBuy } from "./merge";

/** How many rows are left to buy, for the grocery tab icon. Follows the live list. */
export function useShoppingBadgeCount(): number {
  // Counted in the app's language, as the grocery screen merges its rows.
  const { language } = useLanguage();
  const { items } = useLocalizedShoppingList(language);
  return useMemo(() => (items ? countItemsToBuy(items) : 0), [items]);
}
