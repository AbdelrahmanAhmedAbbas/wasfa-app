// Turns per-store product matches for a grocery list into store totals and a
// two-store split suggestion.

export type StoreId = "carrefour" | "spinneys" | "hyperone";

export const STORE_IDS: StoreId[] = ["carrefour", "spinneys", "hyperone"];

export type PricedMatch = {
  productId: string;
  name: string;
  /** EGP per pack, or per kilo when sold by weight. */
  price: number;
  imageUrl: string | null;
  soldByWeight: boolean;
  /** Packs to buy, or kilos when sold by weight. */
  quantity: number;
  /** What the line costs at checkout: whole packs, not the share the recipe uses. */
  cost: number;
};

export type PricedItem = {
  key: string;
  name: string;
  matches: Partial<Record<StoreId, PricedMatch | null>>;
};

export type StoreLine = {
  key: string;
  name: string;
  cost: number;
  /** Null when the store does not carry the item; the cost is then the other stores' average. */
  match: PricedMatch | null;
};

export type StoreTotal = {
  store: StoreId;
  total: number;
  lines: StoreLine[];
  /** Lines priced from the other stores' average. */
  missing: number;
  /** False when too much of the list is missing for the total to stand on its own. */
  ranked: boolean;
};

export type SplitPlan = {
  total: number;
  /** Against the cheapest single store. */
  saving: number;
  lists: Array<{ store: StoreId; total: number; lines: StoreLine[] }>;
};

export type EstimateSummary = {
  /** Cheapest first; stores missing too much of the list come last. */
  stores: StoreTotal[];
  split: SplitPlan | null;
  /** Items no store carries; they are left out of every total. */
  unpriced: Array<{ key: string; name: string }>;
};

// A store missing more than a quarter of the list is not ranked on its own.
const MAX_MISSING_SHARE = 0.25;
// A split is only worth a second trip when it saves at least 5% and at least 100 EGP.
const MIN_SPLIT_SAVING_SHARE = 0.05;
const MIN_SPLIT_SAVING_EGP = 100;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function sumCosts(lines: StoreLine[]): number {
  return roundMoney(lines.reduce((sum, line) => sum + line.cost, 0));
}

function averageCost(item: PricedItem, excluding: StoreId[]): number {
  const costs = STORE_IDS.filter((store) => !excluding.includes(store))
    .map((store) => item.matches[store]?.cost)
    .filter((cost): cost is number => typeof cost === "number");
  return costs.length > 0 ? costs.reduce((sum, cost) => sum + cost, 0) / costs.length : 0;
}

function storeLine(item: PricedItem, store: StoreId): StoreLine {
  const match = item.matches[store] ?? null;
  return { key: item.key, name: item.name, cost: match ? match.cost : averageCost(item, [store]), match };
}

function findSplit(priced: PricedItem[], stores: StoreTotal[]): SplitPlan | null {
  const baseline = stores[0];
  let best: SplitPlan | null = null;

  for (let first = 0; first < stores.length; first++) {
    for (let second = first + 1; second < stores.length; second++) {
      const pair = [stores[first].store, stores[second].store];
      const lists = pair.map((store) => ({ store, total: 0, lines: [] as StoreLine[] }));
      for (const item of priced) {
        const lines = pair.map((store) => storeLine(item, store));
        const carried = lines.map((line, index) => ({ line, index })).filter(({ line }) => line.match);
        // An item neither store carries stays on the first list at the third store's price.
        const cheapest = carried.sort((a, b) => a.line.cost - b.line.cost)[0] ?? {
          line: { ...lines[0], cost: averageCost(item, pair) },
          index: 0,
        };
        lists[cheapest.index].lines.push(cheapest.line);
      }
      if (lists.some((list) => list.lines.length === 0)) continue;

      for (const list of lists) list.total = sumCosts(list.lines);
      const total = roundMoney(lists[0].total + lists[1].total);
      if (!best || total < best.total) {
        best = { total, saving: roundMoney(baseline.total - total), lists };
      }
    }
  }

  if (!best) return null;
  const worthIt =
    best.saving >= MIN_SPLIT_SAVING_EGP && best.saving >= baseline.total * MIN_SPLIT_SAVING_SHARE;
  return worthIt ? best : null;
}

export function summarizeEstimate(items: PricedItem[]): EstimateSummary {
  const priced = items.filter((item) => STORE_IDS.some((store) => item.matches[store]));
  const unpriced = items
    .filter((item) => !priced.includes(item))
    .map((item) => ({ key: item.key, name: item.name }));

  const stores = STORE_IDS.filter((store) => priced.some((item) => item.matches[store]))
    .map((store): StoreTotal => {
      const lines = priced.map((item) => storeLine(item, store));
      const missing = lines.filter((line) => !line.match).length;
      return {
        store,
        total: sumCosts(lines),
        lines,
        missing,
        ranked: missing <= priced.length * MAX_MISSING_SHARE,
      };
    })
    .sort((a, b) => Number(b.ranked) - Number(a.ranked) || a.total - b.total);

  return { stores, split: stores.length > 1 ? findSplit(priced, stores) : null, unpriced };
}
