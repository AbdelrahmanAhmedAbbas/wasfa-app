"use node";

// Node, like every other action here that calls outside services. The pricing code was
// ported from a Deno function and relies on its web APIs, such as AbortSignal.timeout.

import { ConvexError, v } from "convex/values";

import { action } from "./_generated/server";
import { requireUserId } from "./authz";
import {
  estimateGroceryPrices,
  MAX_ITEMS,
  readItems,
  readPhoneCandidates,
  type PricedItem,
} from "./lib/groceryPrices";

/**
 * Prices a grocery list at the Egyptian stores. `carrefour` holds the Carrefour products
 * the phone found for each line, since Carrefour refuses server addresses.
 */
export const estimate = action({
  args: { items: v.any(), carrefour: v.optional(v.any()) },
  handler: async (ctx, args): Promise<PricedItem[]> => {
    await requireUserId(ctx);

    const items = readItems(args.items);
    if (!items) {
      throw new ConvexError({
        code: "INVALID_ITEMS",
        message: `items must be a list of 1 to ${MAX_ITEMS} entries with key and name`,
      });
    }

    try {
      return await estimateGroceryPrices(items, readPhoneCandidates(args.carrefour));
    } catch (error) {
      console.error("[grocery] estimate failed", String(error));
      throw new ConvexError({ code: "ESTIMATE_FAILED", message: "Could not estimate prices" });
    }
  },
});
