import * as Localization from "expo-localization";

import { supabase } from "@/lib/supabase/client";

import { searchCarrefour, type StoreProduct } from "./carrefour";
import type { PricedItem } from "./estimate";

export type GroceryLine = {
  key: string;
  /** The ingredient alone, used as the search term. */
  name: string;
  /** The list line as written, with its amount. */
  text: string;
};

// The server accepts at most this many lines per estimate.
const MAX_LINES = 60;
const CARREFOUR_PARALLEL_SEARCHES = 5;
const CANDIDATES_PER_LINE = 10;

/** Price comparison covers Egyptian stores only, so it is offered on phones set to Egypt. */
export function isPriceComparisonAvailable(): boolean {
  return Localization.getLocales()[0]?.regionCode === "EG";
}

/**
 * Prices the lines at Carrefour, Spinneys and Hyper One. The phone searches Carrefour
 * itself, since Carrefour refuses server addresses; the server searches the other two
 * and picks the product to buy for each line at each store.
 */
export async function estimateGroceryPrices(lines: GroceryLine[]): Promise<PricedItem[]> {
  const items = lines.slice(0, MAX_LINES);
  const carrefour: Record<string, StoreProduct[]> = {};
  for (let index = 0; index < items.length; index += CARREFOUR_PARALLEL_SEARCHES) {
    await Promise.all(
      items.slice(index, index + CARREFOUR_PARALLEL_SEARCHES).map(async (line) => {
        // A failed search only leaves Carrefour without a price for that line.
        const products = await searchCarrefour(line.name).catch(() => []);
        carrefour[line.key] = products.filter((product) => product.inStock).slice(0, CANDIDATES_PER_LINE);
      })
    );
  }

  const { data, error } = await supabase.functions.invoke("grocery-estimate", { body: { items, carrefour } });
  if (error) throw error;
  const priced = (data as { items?: PricedItem[] } | null)?.items;
  if (!priced) throw new Error("Price estimate did not return items.");
  return priced;
}
