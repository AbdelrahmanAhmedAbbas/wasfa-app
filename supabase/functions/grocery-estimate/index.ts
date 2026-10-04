import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getRequestUser } from "../_shared/db.ts";
import { estimateGroceryPrices, MAX_ITEMS, readItems, readPhoneCandidates } from "../_shared/grocery-prices.ts";

type EstimateInput = {
  items?: unknown;
  /** Carrefour candidates the phone found, keyed by item key. */
  carrefour?: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let input: EstimateInput;
  try {
    input = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const items = readItems(input.items);
  if (!items) return jsonResponse({ error: `items must be a list of 1 to ${MAX_ITEMS} entries with key and name` }, 400);

  const requestUser = await getRequestUser(req);
  if (!requestUser?.id) return jsonResponse({ error: "Authentication required" }, 401);

  try {
    return jsonResponse({ items: await estimateGroceryPrices(items, readPhoneCandidates(input.carrefour)) });
  } catch (error) {
    console.error("[grocery] estimate failed", String(error));
    return jsonResponse({ error: "Could not estimate prices" }, 502);
  }
});
