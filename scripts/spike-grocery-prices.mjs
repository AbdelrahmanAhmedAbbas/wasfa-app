#!/usr/bin/env node
// Checks whether the three Egyptian stores can price a grocery list on demand:
//   1. Spinneys and Hyper One, through the public product search their own sites use
//   2. Carrefour, through the products its search page carries
//   3. Carrefour again through an Apify actor, only when APIFY_TOKEN is set
//      (about $0.03 per ingredient)
//
// Usage:
//   node scripts/spike-grocery-prices.mjs [ingredient ...]
//   APIFY_TOKEN=... node scripts/spike-grocery-prices.mjs [ingredient ...]
//
// APIFY_ACTOR_CARREFOUR overrides the actor. With no ingredients, a 25-item
// Arabic list is used.

const GRAPHQL_STORES = {
  spinneys: "https://mcprod.spinneys-egypt.com/graphql",
  hyperone: "https://mcprod.hyperone.com.eg/graphql",
};
const CARREFOUR_SEARCH = "https://www.carrefouregypt.com/mafegy/ar/search?keyword=";
const DEFAULT_APIFY_ACTOR_CARREFOUR = "blackfalcondata~carrefour-maf-scraper";
// Keeps a 25-item list at or under $1.
const CARREFOUR_MAX_CHARGE_PER_SEARCH_USD = 0.04;
const APIFY_TIMEOUT_MS = 180_000;
const RESULTS_PER_SEARCH = 10;
const PARALLEL_SEARCHES = 5;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const DEFAULT_TERMS = [
  "أرز مصري", "دجاج", "طماطم", "بصل", "ثوم", "زيت زيتون", "لبن", "بيض", "زبدة", "دقيق",
  "سكر", "بطاطس", "جزر", "ليمون", "لحم مفروم", "مكرونة", "صلصة طماطم", "جبنة", "زبادي", "خيار",
  "فلفل", "كزبرة", "بقدونس", "عدس", "حمص",
];

// A pack size written in the product name, e.g. "1 كجم", "500جم", "1ك", "1L".
const PACK_SIZE =
  /(\d+(?:[.,]\d+)?)\s*(kg|gm|gr|g|ml|ltr|l|k|pcs|pc|كجم|كيلو|جرام|جم|مللي|ملى|مل|لتر|ك|قطعة|قطعه|بيضة)(?![a-zء-ي])/i;
// Loose produce and meat priced by weight.
const SOLD_BY_WEIGHT = /(بالكيلو|بالوزن|per\s*kg)/i;

const PRODUCT_SEARCH = `query ($search: String!, $pageSize: Int!) {
  products(search: $search, pageSize: $pageSize) {
    total_count
    items {
      name
      sku
      stock_status
      small_image { url }
      categories { name level }
      price_range { minimum_price { regular_price { value } final_price { value currency } } }
    }
  }
}`;

function seconds(startedAt) {
  return ((Date.now() - startedAt) / 1000).toFixed(1);
}

function percent(part, total) {
  return total === 0 ? 0 : Math.round((100 * part) / total);
}

function summarize(store, startedAt, rows) {
  const products = rows.flatMap((row) => row.products);
  const sized = products.filter((product) => PACK_SIZE.test(product.name)).length;
  const byWeight = products.filter(
    (product) =>
      !PACK_SIZE.test(product.name) && (product.soldByWeight || SOLD_BY_WEIGHT.test(product.name))
  ).length;
  console.log(
    `${store}: ${seconds(startedAt)}s for ${rows.length} searches | ` +
      `with results ${rows.filter((row) => row.products.length > 0).length} | ` +
      `failed ${rows.filter((row) => row.error).length} | ` +
      `pack size in name ${percent(sized, products.length)}% | sold by weight ${percent(byWeight, products.length)}%`
  );
  for (const row of rows) {
    const sample = row.error
      ? `FAILED: ${row.error}`
      : row.products
          .slice(0, 3)
          .map((product) => `${product.name.trim()} = ${product.price}`)
          .join(" | ") || "no results";
    console.log(`  ${row.term}: ${sample}`);
  }
}

// The app loads photos straight from the store, so they must load without a referrer.
async function checkImage(rows) {
  const image = rows.flatMap((row) => row.products).find((product) => product.image)?.image;
  if (!image) return;
  const response = await fetch(image, { method: "HEAD" }).catch(() => null);
  console.log(`  image check: ${response ? `HTTP ${response.status}` : "request failed"} ${image}`);
}

async function searchGraphqlStore(url, term) {
  try {
    const response = await fetch(url, {
      method: "POST",
      // The Arabic store view; product names and search both follow it.
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT, Store: "ar_EG" },
      body: JSON.stringify({
        query: PRODUCT_SEARCH,
        variables: { search: term, pageSize: RESULTS_PER_SEARCH },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.json();
    if (!response.ok || body.errors) {
      return { term, products: [], error: `HTTP ${response.status} ${JSON.stringify(body.errors ?? "").slice(0, 200)}` };
    }
    return {
      term,
      products: (body.data?.products?.items ?? []).map((item) => ({
        name: item.name,
        price: item.price_range.minimum_price.final_price.value,
        image: item.small_image?.url ?? null,
      })),
    };
  } catch (error) {
    return { term, products: [], error: String(error) };
  }
}

async function checkStore(store, source, terms, search) {
  console.log(`\n--- ${store}: ${source} ---`);
  const startedAt = Date.now();
  const rows = [];
  for (let index = 0; index < terms.length; index += PARALLEL_SEARCHES) {
    const batch = terms.slice(index, index + PARALLEL_SEARCHES);
    rows.push(...(await Promise.all(batch.map(search))));
  }
  summarize(store, startedAt, rows);
  await checkImage(rows);
  return rows.every((row) => !row.error);
}

// The JSON object that encloses position `index` in `text`.
function jsonObjectAround(text, index) {
  let depth = 0;
  let start = index;
  for (; start >= 0; start--) {
    if (text[start] === "}") depth++;
    else if (text[start] === "{" && depth-- === 0) break;
  }
  depth = 0;
  let inString = false;
  for (let end = start; start >= 0 && end < text.length; end++) {
    const char = text[end];
    if (inString) {
      if (char === "\\") end++;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "{") depth++;
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

// Carrefour renders its search page on the server and ships the products inside the
// page's Next.js data chunks: self.__next_f.push([1,"..."]).
async function searchCarrefourDirect(term) {
  try {
    const response = await fetch(CARREFOUR_SEARCH + encodeURIComponent(term), {
      // Without browser-like headers the site answers with an empty page.
      headers: { "User-Agent": USER_AGENT, Accept: "text/html", "Accept-Language": "ar" },
      signal: AbortSignal.timeout(30_000),
    });
    const html = await response.text();
    if (!response.ok) return { term, products: [], error: `HTTP ${response.status}` };
    const data = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
      .map((match) => JSON.parse(match[1]))
      .join("");
    if (!data) return { term, products: [], error: `no product data in a page of ${html.length} characters` };

    const products = new Map();
    for (const match of data.matchAll(/"productName":"/g)) {
      const item = jsonObjectAround(data, match.index);
      if (item?.productId && !products.has(item.productId)) products.set(item.productId, item);
    }
    return {
      term,
      products: [...products.values()].slice(0, RESULTS_PER_SEARCH).map((item) => ({
        name: item.productName,
        // Loose produce is priced per smallest order (half a kilo), not per kilo.
        price: item.isSoldByWeight ? item.sellingPrice / (item.orderThreshold?.min || 1) : item.sellingPrice,
        image: item.imageUrl ?? null,
        soldByWeight: item.isSoldByWeight === true,
      })),
    };
  } catch (error) {
    return { term, products: [], error: String(error) };
  }
}

// One actor run per term: the actor's maxResults caps a whole run, not each term,
// and it always reads 60 products per term, so a shared run is filled by the first few.
async function searchCarrefourApify(actorId, apifyToken, term) {
  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?format=json&clean=true&maxTotalChargeUsd=${CARREFOUR_MAX_CHARGE_PER_SEARCH_USD}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apifyToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: term,
          market: "mafegy",
          language: "ar",
          maxResults: RESULTS_PER_SEARCH,
          usePagination: false,
          proxyConfiguration: { useApifyProxy: true },
        }),
        signal: AbortSignal.timeout(APIFY_TIMEOUT_MS),
      }
    );
    const body = await response.text();
    if (!response.ok) return { term, products: [], error: `HTTP ${response.status} ${body.slice(0, 200)}` };
    return {
      term,
      products: JSON.parse(body).map((item) => ({
        name: item.title ?? "",
        price: item.attributes?.isSoldByWeight ? item.price / (item.purchaseMin || 1) : item.price,
        image: item.main_image ?? null,
        soldByWeight: item.attributes?.isSoldByWeight === true,
      })),
    };
  } catch (error) {
    return { term, products: [], error: String(error) };
  }
}

const terms = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_TERMS;
let allPassed = true;

for (const [store, url] of Object.entries(GRAPHQL_STORES)) {
  allPassed = (await checkStore(store, url, terms, (term) => searchGraphqlStore(url, term))) && allPassed;
}
allPassed = (await checkStore("carrefour", CARREFOUR_SEARCH, terms, searchCarrefourDirect)) && allPassed;

const apifyToken = process.env.APIFY_TOKEN?.trim();
if (apifyToken) {
  const actorId = process.env.APIFY_ACTOR_CARREFOUR?.trim() || DEFAULT_APIFY_ACTOR_CARREFOUR;
  const search = (term) => searchCarrefourApify(actorId, apifyToken, term);
  allPassed = (await checkStore("carrefour", `Apify actor ${actorId}`, terms, search)) && allPassed;
}

process.exit(allPassed ? 0 : 1);
