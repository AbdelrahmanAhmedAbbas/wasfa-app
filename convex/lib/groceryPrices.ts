// Prices a grocery list at the Egyptian stores: searches Spinneys and Hyper One,
// takes Carrefour's candidates from the phone (Carrefour refuses server addresses),
// and asks a model to pick the product to buy for each line at each store.

export type StoreId = "carrefour" | "spinneys" | "hyperone";

export type StoreProduct = {
  id: string;
  name: string;
  /** EGP per pack, or per kilo when sold by weight. */
  price: number;
  imageUrl: string | null;
  soldByWeight: boolean;
};

export type GroceryItem = {
  key: string;
  /** The ingredient alone, used as the search term. */
  name: string;
  /** The list line as written, with its amount. */
  text: string;
};

export type PricedMatch = {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  soldByWeight: boolean;
  quantity: number;
  cost: number;
};

export type PricedItem = {
  key: string;
  name: string;
  matches: Partial<Record<StoreId, PricedMatch | null>>;
};

export type Candidates = Partial<Record<StoreId, StoreProduct[]>>;

export const MAX_ITEMS = 60;
const MAX_CANDIDATES = 10;
const MAX_TEXT_LENGTH = 200;
const MAX_QUANTITY = 20;
const PARALLEL_SEARCHES = 6;
const ITEMS_PER_MODEL_CALL = 5;
const SEARCH_TIMEOUT_MS = 15_000;
const MODEL_TIMEOUT_MS = 45_000;
const MATCH_MODELS = ["google/gemini-3-flash-preview", "anthropic/claude-haiku-4.5"];
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const GRAPHQL_STORES: Array<{ store: StoreId; url: string }> = [
  { store: "spinneys", url: "https://mcprod.spinneys-egypt.com/graphql" },
  { store: "hyperone", url: "https://mcprod.hyperone.com.eg/graphql" },
];

const PRODUCT_SEARCH = `query ($search: String!, $pageSize: Int!) {
  products(search: $search, pageSize: $pageSize) {
    items {
      name
      sku
      stock_status
      small_image { url }
      price_range { minimum_price { final_price { value } } }
    }
  }
}`;

// Loose produce and meat priced by weight, as these two stores write it in the name.
const SOLD_BY_WEIGHT = /(بالكيلو|بالوزن|per\s*kg)/i;

const MATCH_INSTRUCTIONS = `You match grocery list lines to supermarket products in Egypt. Prices are in EGP.

Each task has an id, "need" (the list line as written) and one store's numbered candidate products: i = index, n = name, p = price, w = true when p is the price of one kilo.

For each task, pick the product a home cook would buy for that line:
- It must be the ingredient itself in a plain form. Never pick a different food, a flavoured snack or drink, a ready meal, a sauce or spice mix that merely contains it, a cleaning or personal-care product, or kitchenware.
- Prefer fresh produce, herbs, meat and chicken unless the line says frozen, canned, dried or powdered.
- Among suitable products, pick the one that covers the needed amount at the lowest total cost.
- q is how much to buy. When w is true, q is kilos in steps of 0.25 (at least 0.25). Otherwise q is whole packs (at least 1), enough to cover the amount using the pack size in the name. If the line gives no amount, buy one pack or half a kilo.
- Answer null only when no candidate is the ingredient at all. A larger pack than needed is still a match.

Answer with JSON only, one entry for every task id:
{"0.carrefour": {"i": 2, "q": 1}, "0.spinneys": null, "1.carrefour": {"i": 0, "q": 0.5}}`;

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, MAX_TEXT_LENGTH);
  return text || null;
}

/** The list items of a request, or null when the body is not a usable list. */
export function readItems(raw: unknown): GroceryItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) return null;
  const items: GroceryItem[] = [];
  for (const entry of raw) {
    const key = cleanText((entry as GroceryItem | null)?.key);
    const name = cleanText((entry as GroceryItem | null)?.name);
    if (!key || !name) return null;
    items.push({ key, name, text: cleanText((entry as GroceryItem).text) ?? name });
  }
  return items;
}

/** Candidates the phone found at Carrefour, keyed by item key. Anything malformed is dropped. */
export function readPhoneCandidates(raw: unknown): Map<string, StoreProduct[]> {
  const byKey = new Map<string, StoreProduct[]>();
  if (!raw || typeof raw !== "object") return byKey;
  for (const [key, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const products: StoreProduct[] = [];
    for (const entry of list.slice(0, MAX_CANDIDATES) as Array<Partial<StoreProduct> | null>) {
      const id = cleanText(entry?.id);
      const name = cleanText(entry?.name);
      const price = entry?.price;
      if (!id || !name || typeof price !== "number" || !Number.isFinite(price) || price <= 0) continue;
      const imageUrl = typeof entry?.imageUrl === "string" && entry.imageUrl.startsWith("https://") ? entry.imageUrl : null;
      products.push({ id, name, price, imageUrl, soldByWeight: entry?.soldByWeight === true });
    }
    byKey.set(key, products);
  }
  return byKey;
}

async function searchGraphqlStore(url: string, term: string): Promise<StoreProduct[]> {
  try {
    const response = await fetch(url, {
      method: "POST",
      // The Arabic store view; product names and search both follow it.
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT, Store: "ar_EG" },
      body: JSON.stringify({ query: PRODUCT_SEARCH, variables: { search: term, pageSize: MAX_CANDIDATES } }),
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (!response.ok) return [];
    const body = await response.json();
    const products: StoreProduct[] = [];
    for (const item of body.data?.products?.items ?? []) {
      const price = item.price_range?.minimum_price?.final_price?.value;
      if (item.stock_status === "OUT_OF_STOCK" || typeof price !== "number" || price <= 0) continue;
      const name = String(item.name ?? "").trim();
      products.push({
        id: String(item.sku ?? name),
        name,
        price,
        imageUrl: item.small_image?.url ?? null,
        soldByWeight: SOLD_BY_WEIGHT.test(name),
      });
    }
    return products;
  } catch (error) {
    console.warn("[grocery] store search failed", { url, term, error: String(error) });
    return [];
  }
}

async function inBatches<T, R>(values: T[], size: number, run: (value: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < values.length; index += size) {
    results.push(...(await Promise.all(values.slice(index, index + size).map(run))));
  }
  return results;
}

/** What the model sees for one batch: one task per item and store that has candidates. */
export function buildMatchInput(items: GroceryItem[], candidates: Candidates[]): string {
  return JSON.stringify(
    items.flatMap((item, index) =>
      Object.entries(candidates[index])
        .filter(([, products]) => products.length > 0)
        .map(([store, products]) => ({
          id: `${index}.${store}`,
          need: item.text,
          products: products.map((product, i) => ({
            i,
            n: product.name,
            p: product.price,
            ...(product.soldByWeight ? { w: true } : {}),
          })),
        }))
    )
  );
}

function readQuantity(raw: unknown, soldByWeight: boolean): number {
  const value = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 1;
  const quantity = soldByWeight ? Math.max(0.25, Math.round(value * 4) / 4) : Math.max(1, Math.ceil(value));
  return Math.min(quantity, MAX_QUANTITY);
}

/** Turns the model's picks for one batch into priced matches. A bad or missing pick is no match. */
export function readMatchAnswer(answer: unknown, items: GroceryItem[], candidates: Candidates[]): PricedItem[] {
  const picks = (answer && typeof answer === "object" ? answer : {}) as Record<string, unknown>;
  return items.map((item, index) => {
    const matches: PricedItem["matches"] = {};
    for (const [store, products] of Object.entries(candidates[index]) as Array<[StoreId, StoreProduct[]]>) {
      const pick = picks[`${index}.${store}`] as { i?: unknown; q?: unknown } | null | undefined;
      const product = typeof pick?.i === "number" ? products[pick.i] : undefined;
      if (!product) {
        matches[store] = null;
        continue;
      }
      const quantity = readQuantity(pick?.q, product.soldByWeight);
      matches[store] = {
        productId: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        soldByWeight: product.soldByWeight,
        quantity,
        cost: Math.round(product.price * quantity * 100) / 100,
      };
    }
    return { key: item.key, name: item.name, matches };
  });
}

async function askModel(model: string, input: string): Promise<unknown> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("Missing required environment variable: OPENROUTER_API_KEY");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://meal-planner.app",
      "X-Title": "Meal Planner Grocery Prices",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: MATCH_INSTRUCTIONS },
        { role: "user", content: input },
      ],
    }),
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`OPENROUTER_CHAT_FAILED ${response.status} ${body.slice(0, 300)}`);
  const content = JSON.parse(body).choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OPENROUTER_CHAT_EMPTY");
  // Some models wrap the JSON in a code fence.
  return JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1));
}

async function matchBatch(items: GroceryItem[], candidates: Candidates[]): Promise<PricedItem[]> {
  if (candidates.every((stores) => Object.values(stores).every((products) => products.length === 0))) {
    return readMatchAnswer({}, items, candidates);
  }
  const input = buildMatchInput(items, candidates);
  for (const model of MATCH_MODELS) {
    try {
      return readMatchAnswer(await askModel(model, input), items, candidates);
    } catch (error) {
      console.warn("[grocery] match model failed", { model, error: String(error).slice(0, 300) });
    }
  }
  throw new Error("GROCERY_MATCH_FAILED");
}

/** Candidate products per item and store: Carrefour from the phone, the others searched here. */
export async function findCandidates(
  items: GroceryItem[],
  carrefour: Map<string, StoreProduct[]>
): Promise<Candidates[]> {
  const found = await Promise.all(
    GRAPHQL_STORES.map(({ url }) => inBatches(items, PARALLEL_SEARCHES, (item) => searchGraphqlStore(url, item.name)))
  );
  return items.map((item, index) => ({
    carrefour: carrefour.get(item.key) ?? [],
    ...Object.fromEntries(GRAPHQL_STORES.map(({ store }, storeIndex) => [store, found[storeIndex][index]])),
  }));
}

export async function estimateGroceryPrices(
  items: GroceryItem[],
  carrefour: Map<string, StoreProduct[]>
): Promise<PricedItem[]> {
  const candidates = await findCandidates(items, carrefour);
  const batches: Array<{ items: GroceryItem[]; candidates: Candidates[] }> = [];
  for (let index = 0; index < items.length; index += ITEMS_PER_MODEL_CALL) {
    batches.push({
      items: items.slice(index, index + ITEMS_PER_MODEL_CALL),
      candidates: candidates.slice(index, index + ITEMS_PER_MODEL_CALL),
    });
  }
  // A batch the models could not match leaves its lines unpriced instead of failing the
  // whole list; the estimate fails only when no batch was matched.
  const settled = await Promise.allSettled(batches.map((batch) => matchBatch(batch.items, batch.candidates)));
  if (settled.every((result) => result.status === "rejected")) throw new Error("GROCERY_MATCH_FAILED");
  return settled.flatMap((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : batches[index].items.map((item) => ({ key: item.key, name: item.name, matches: {} }))
  );
}
