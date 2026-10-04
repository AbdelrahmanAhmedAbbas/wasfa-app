// Carrefour Egypt product search, run on the phone: the site refuses requests from
// server addresses, so the app reads the search page itself.

export type StoreProduct = {
  id: string;
  name: string;
  /** EGP. Per kilo for loose produce, per pack for everything else. */
  price: number;
  imageUrl: string | null;
  soldByWeight: boolean;
  inStock: boolean;
  isFood: boolean;
};

const SEARCH_URL = "https://www.carrefouregypt.com/mafegy/ar/search?keyword=";
// Without browser-like headers the site answers with an empty page.
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html",
  "Accept-Language": "ar",
};
const TIMEOUT_MS = 30_000;
const CHUNK_OPEN = "self.__next_f.push([1,";

type CarrefourItem = {
  productId?: string;
  productName?: string;
  sellingPrice?: number;
  imageUrl?: string;
  isSoldByWeight?: boolean;
  orderThreshold?: { min?: number };
  stock?: { stockLevelStatus?: string };
  productType?: string;
};

/** Index of the quote that closes the string literal opening at `start`, or -1. */
function endOfString(text: string, start: number): number {
  for (let index = start + 1; index < text.length; index++) {
    if (text[index] === "\\") index++;
    else if (text[index] === '"') return index;
  }
  return -1;
}

// The search page is rendered on the server and carries its products inside Next.js
// data chunks: self.__next_f.push([1,"..."]). The chunks are read with plain scans
// because a regular expression over strings this long overflows Hermes's stack.
function readPageData(html: string): string {
  const chunks: string[] = [];
  let from = 0;
  for (;;) {
    const open = html.indexOf(CHUNK_OPEN, from);
    if (open < 0) break;
    const start = open + CHUNK_OPEN.length;
    const end = html[start] === '"' ? endOfString(html, start) : -1;
    if (end < 0) {
      from = start;
      continue;
    }
    try {
      chunks.push(JSON.parse(html.slice(start, end + 1)));
    } catch {
      // Not a string chunk; skip it.
    }
    from = end + 1;
  }
  return chunks.join("");
}

/** The JSON object that encloses position `index` in `text`. */
function jsonObjectAround(text: string, index: number): unknown {
  let depth = 0;
  let start = index;
  for (; start >= 0; start--) {
    if (text[start] === "}") depth++;
    else if (text[start] === "{" && depth-- === 0) break;
  }
  if (start < 0) return null;

  depth = 0;
  for (let end = start; end < text.length; end++) {
    const char = text[end];
    if (char === '"') {
      end = endOfString(text, end);
      if (end < 0) return null;
    } else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Products in a Carrefour search page, in the page's order. Empty when the page carries none. */
export function parseCarrefourSearchPage(html: string): StoreProduct[] {
  const data = readPageData(html);
  const products = new Map<string, StoreProduct>();
  const marker = '"productName":"';
  for (let at = data.indexOf(marker); at >= 0; at = data.indexOf(marker, at + marker.length)) {
    const item = jsonObjectAround(data, at) as CarrefourItem | null;
    if (!item?.productId || !item.productName || typeof item.sellingPrice !== "number") continue;
    if (products.has(item.productId)) continue;
    const soldByWeight = item.isSoldByWeight === true;
    products.set(item.productId, {
      id: item.productId,
      name: item.productName,
      // Loose produce is priced per smallest order (half a kilo), not per kilo.
      price: soldByWeight ? item.sellingPrice / (item.orderThreshold?.min || 1) : item.sellingPrice,
      imageUrl: item.imageUrl ?? null,
      soldByWeight,
      inStock: item.stock?.stockLevelStatus !== "outOfStock",
      isFood: item.productType !== "NONFOOD",
    });
  }
  return [...products.values()];
}

export async function searchCarrefour(term: string): Promise<StoreProduct[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(SEARCH_URL + encodeURIComponent(term), {
      headers: HEADERS,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseCarrefourSearchPage(await response.text());
  } finally {
    clearTimeout(timer);
  }
}

export type CarrefourReachReport = {
  searches: number;
  withProducts: number;
  seconds: number;
  /** One line per search: the first product and its price, or why it failed. */
  lines: string[];
};

/** Runs every search, five at a time, and reports how many came back with products. */
export async function checkCarrefourReach(terms: string[]): Promise<CarrefourReachReport> {
  const startedAt = Date.now();
  const lines: string[] = [];
  let withProducts = 0;
  for (let index = 0; index < terms.length; index += 5) {
    const batch = terms.slice(index, index + 5);
    const results = await Promise.all(
      batch.map((term) =>
        searchCarrefour(term).then(
          (products) => ({ term, products, error: null }),
          (error: unknown) => ({ term, products: [] as StoreProduct[], error: String(error) })
        )
      )
    );
    for (const { term, products, error } of results) {
      if (products.length > 0) withProducts++;
      const first = products[0];
      lines.push(`${term}: ${first ? `${first.name} = ${first.price}` : (error ?? "no products")}`);
    }
  }
  return { searches: terms.length, withProducts, seconds: (Date.now() - startedAt) / 1000, lines };
}
