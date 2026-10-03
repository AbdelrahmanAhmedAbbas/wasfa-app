import { useEffect, useState } from "react";

import { listShoppingListItems } from "./client";
import { countItemsToBuy } from "./merge";

// The grocery tab icon shows how many rows are left to buy. The count is shared
// the way the meal plan is: whoever changes the list publishes the new number.
let itemsToBuy = 0;
const listeners = new Set<(count: number) => void>();

/** Sets the count from a list the caller already holds, without fetching. */
export function publishShoppingItems(items: Array<{ ingredient_text: string; checked: boolean }>): void {
  itemsToBuy = countItemsToBuy(items);
  listeners.forEach((listener) => listener(itemsToBuy));
}

/** Refetches the list and updates the count. A failed fetch keeps the last count. */
export async function refreshShoppingBadge(): Promise<void> {
  try {
    publishShoppingItems(await listShoppingListItems());
  } catch {
    // Offline or signed out: the badge stays as it was until the next change.
  }
}

export function useShoppingBadgeCount(): number {
  const [count, setCount] = useState(itemsToBuy);

  useEffect(() => {
    listeners.add(setCount);
    void refreshShoppingBadge();
    return () => {
      listeners.delete(setCount);
    };
  }, []);

  return count;
}
