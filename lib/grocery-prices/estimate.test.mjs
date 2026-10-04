import assert from "node:assert/strict";
import { test } from "node:test";

import { summarizeEstimate } from "./estimate.ts";

function match(cost) {
  return { productId: `p-${cost}`, name: "product", price: cost, imageUrl: null, soldByWeight: false, quantity: 1, cost };
}

// Costs in store order: carrefour, spinneys, hyperone. Null means the store does not carry it.
function item(key, [carrefour, spinneys, hyperone]) {
  const matches = {};
  if (carrefour !== undefined) matches.carrefour = carrefour === null ? null : match(carrefour);
  if (spinneys !== undefined) matches.spinneys = spinneys === null ? null : match(spinneys);
  if (hyperone !== undefined) matches.hyperone = hyperone === null ? null : match(hyperone);
  return { key, name: key, matches };
}

test("ranks stores by total, cheapest first", () => {
  const summary = summarizeEstimate([item("rice", [25, 30, 20]), item("eggs", [150, 190, 140])]);

  assert.deepEqual(
    summary.stores.map((store) => [store.store, store.total]),
    [["hyperone", 160], ["carrefour", 175], ["spinneys", 220]]
  );
  assert.deepEqual(summary.unpriced, []);
});

test("fills an item a store lacks with the other stores' average and marks it", () => {
  const summary = summarizeEstimate([
    item("rice", [25, 30, 20]),
    item("eggs", [150, 190, 140]),
    item("oil", [100, 110, 90]),
    item("lentils", [null, 60, 40]),
  ]);
  const carrefour = summary.stores.find((store) => store.store === "carrefour");

  assert.equal(carrefour.total, 325);
  assert.equal(carrefour.missing, 1);
  assert.equal(carrefour.ranked, true);
  assert.deepEqual(carrefour.lines.at(-1), { key: "lentils", name: "lentils", cost: 50, match: null });
});

test("does not rank a store that lacks more than a quarter of the list", () => {
  const summary = summarizeEstimate([
    item("rice", [null, 30, 20]),
    item("eggs", [null, 190, 140]),
    item("oil", [1, 110, 90]),
  ]);

  assert.deepEqual(summary.stores.map((store) => store.store), ["hyperone", "spinneys", "carrefour"]);
  assert.equal(summary.stores.at(-1).ranked, false);
});

test("leaves items no store carries out of every total", () => {
  const summary = summarizeEstimate([item("rice", [25, 30, 20]), item("saffron", [null, null, null])]);

  assert.deepEqual(summary.unpriced, [{ key: "saffron", name: "saffron" }]);
  assert.equal(summary.stores[0].lines.length, 1);
});

test("leaves out a store with no matches at all", () => {
  const summary = summarizeEstimate([item("rice", [undefined, 30, 20])]);

  assert.deepEqual(summary.stores.map((store) => store.store), ["hyperone", "spinneys"]);
});

test("suggests a two-store split when it saves at least 5% and 100 EGP", () => {
  const summary = summarizeEstimate([
    item("meat", [400, 600, 650]),
    item("chicken", [300, 180, 320]),
    item("rice", [30, 25, 40]),
  ]);

  // Cheapest single store: carrefour at 730. Split: meat at carrefour, the rest at spinneys.
  assert.equal(summary.stores[0].store, "carrefour");
  assert.equal(summary.split.total, 605);
  assert.equal(summary.split.saving, 125);
  assert.deepEqual(
    summary.split.lists.map((list) => [list.store, list.total, list.lines.map((line) => line.key)]),
    [["carrefour", 400, ["meat"]], ["spinneys", 205, ["chicken", "rice"]]]
  );
});

test("keeps quiet about a split that saves less than 100 EGP", () => {
  const summary = summarizeEstimate([item("meat", [400, 600, 650]), item("chicken", [300, 210, 320])]);

  assert.equal(summary.split, null);
});

test("keeps quiet about a split that saves less than 5%", () => {
  const summary = summarizeEstimate([item("meat", [4000, 6000, 6500]), item("chicken", [3000, 2890, 3200])]);

  assert.equal(summary.split, null);
});

test("returns nothing to show when no item has a price", () => {
  assert.deepEqual(summarizeEstimate([item("saffron", [null, null, null])]), {
    stores: [],
    split: null,
    unpriced: [{ key: "saffron", name: "saffron" }],
  });
});
