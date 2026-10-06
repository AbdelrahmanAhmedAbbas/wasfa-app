import { useMemo } from "react";

import { useShoppingList } from "./client";
import { countItemsToBuy } from "./merge";

/** How many rows are left to buy, for the grocery tab icon. Follows the live list. */
export function useShoppingBadgeCount(): number {
  const { items } = useShoppingList();
  return useMemo(() => (items ? countItemsToBuy(items) : 0), [items]);
}
