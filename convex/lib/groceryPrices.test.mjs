import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMatchInput,
  estimateGroceryPrices,
  readItems,
  readMatchAnswer,
  readPhoneCandidates,
} from "./groceryPrices.ts";

const rice = { id: "r1", name: "أرز مصري - 1 كجم", price: 25, imageUrl: "https://cdn/r1.jpg", soldByWeight: false };
const bigRice = { id: "r5", name: "أرز مصري - 5 كجم", price: 140, imageUrl: null, soldByWeight: false };
const onion = { id: "o1", name: "بصل أحمر", price: 22.5, imageUrl: null, soldByWeight: true };

const items = [
  { key: "rice", name: "أرز مصري", text: "2 كجم أرز مصري" },
  { key: "onion", name: "بصل", text: "3 بصل" },
];
const candidates = [
  { carrefour: [rice, bigRice], spinneys: [bigRice], hyperone: [] },
  { carrefour: [onion], spinneys: [], hyperone: [] },
];

test("reads list items and rejects a body that is not a usable list", () => {
  assert.deepEqual(readItems([{ key: "a", name: " أرز ", text: "2 كوب أرز" }, { key: "b", name: "بصل" }]), [
    { key: "a", name: "أرز", text: "2 كوب أرز" },
    { key: "b", name: "بصل", text: "بصل" },
  ]);
  assert.equal(readItems([]), null);
  assert.equal(readItems("rice"), null);
  assert.equal(readItems([{ key: "a" }]), null);
  assert.equal(readItems(Array.from({ length: 61 }, (_, index) => ({ key: String(index), name: "x" }))), null);
});

test("keeps only well-formed phone candidates, ten per item", () => {
  const byKey = readPhoneCandidates({
    rice: [
      rice,
      { id: "x", name: "no price" },
      { id: "y", name: "free", price: 0 },
      { id: "z", name: "bad image", price: 5, imageUrl: "javascript:alert(1)", soldByWeight: "yes" },
    ],
    many: Array.from({ length: 15 }, (_, index) => ({ id: String(index), name: "p", price: 1 })),
    junk: "nope",
  });

  assert.deepEqual(byKey.get("rice"), [rice, { id: "z", name: "bad image", price: 5, imageUrl: null, soldByWeight: false }]);
  assert.equal(byKey.get("many").length, 10);
  assert.equal(byKey.has("junk"), false);
  assert.equal(readPhoneCandidates(null).size, 0);
});

test("gives the model one task per item and store that has candidates", () => {
  assert.deepEqual(JSON.parse(buildMatchInput(items, candidates)), [
    {
      id: "0.carrefour",
      need: "2 كجم أرز مصري",
      products: [
        { i: 0, n: "أرز مصري - 1 كجم", p: 25 },
        { i: 1, n: "أرز مصري - 5 كجم", p: 140 },
      ],
    },
    { id: "0.spinneys", need: "2 كجم أرز مصري", products: [{ i: 0, n: "أرز مصري - 5 كجم", p: 140 }] },
    { id: "1.carrefour", need: "3 بصل", products: [{ i: 0, n: "بصل أحمر", p: 22.5, w: true }] },
  ]);
});

test("prices the model's picks as whole packs, or kilos for loose produce", () => {
  const priced = readMatchAnswer(
    { "0.carrefour": { i: 0, q: 2 }, "0.spinneys": { i: 0, q: 1 }, "1.carrefour": { i: 0, q: 0.6 } },
    items,
    candidates
  );

  assert.deepEqual(priced[0].matches.carrefour, {
    productId: "r1",
    name: "أرز مصري - 1 كجم",
    price: 25,
    imageUrl: "https://cdn/r1.jpg",
    soldByWeight: false,
    quantity: 2,
    cost: 50,
  });
  assert.equal(priced[0].matches.spinneys.cost, 140);
  assert.equal(priced[0].matches.hyperone, null);
  // 0.6 kg rounds to the nearest quarter kilo.
  assert.equal(priced[1].matches.carrefour.quantity, 0.5);
  assert.equal(priced[1].matches.carrefour.cost, 11.25);
});

test("treats a missing, null or out-of-range pick as no match", () => {
  const priced = readMatchAnswer({ "0.carrefour": { i: 7, q: 1 }, "0.spinneys": null }, items, candidates);

  assert.deepEqual(priced[0].matches, { carrefour: null, spinneys: null, hyperone: null });
  assert.deepEqual(priced[1].matches, { carrefour: null, spinneys: null, hyperone: null });
  assert.deepEqual(readMatchAnswer("not json", items, candidates)[0].matches.carrefour, null);
});

test("never buys a fraction of a pack or an absurd quantity", () => {
  const priced = readMatchAnswer(
    { "0.carrefour": { i: 0, q: 1.2 }, "0.spinneys": { i: 0, q: 500 }, "1.carrefour": { i: 0, q: -3 } },
    items,
    candidates
  );

  assert.equal(priced[0].matches.carrefour.quantity, 2);
  assert.equal(priced[0].matches.spinneys.quantity, 20);
  assert.equal(priced[1].matches.carrefour.quantity, 1);
});

/** Stores find nothing; the model picks the first Carrefour product, except for lines named in `failFor`. */
async function withFakeServices(failFor, run) {
  const realFetch = globalThis.fetch;
  const realKey = process.env.OPENROUTER_API_KEY;
  const realWarn = console.warn;
  process.env.OPENROUTER_API_KEY = "test-key";
  console.warn = () => {};
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes("openrouter.ai")) return new Response(JSON.stringify({ data: { products: { items: [] } } }));
    const tasks = JSON.parse(JSON.parse(init.body).messages[1].content);
    if (tasks.some((task) => failFor.some((name) => task.need.includes(name)))) {
      return new Response("upstream error", { status: 502 });
    }
    const content = JSON.stringify(Object.fromEntries(tasks.map((task) => [task.id, { i: 0, q: 1 }])));
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }));
  };
  try {
    return await run();
  } finally {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
    if (realKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = realKey;
  }
}

// Six lines make two model batches: the first five lines, then the sixth on its own.
const sixLines = ["أرز", "بصل", "ثوم", "طماطم", "فلفل", "ليمون"].map((name) => ({ key: name, name, text: name }));
const carrefourFor = (lines) => new Map(lines.map((line) => [line.key, [{ ...rice, id: line.key }]]));

test("a batch the models cannot match leaves its lines unpriced, not the whole list", async () => {
  const priced = await withFakeServices(["ليمون"], () => estimateGroceryPrices(sixLines, carrefourFor(sixLines)));

  assert.equal(priced.length, 6);
  assert.equal(priced[0].matches.carrefour.productId, "أرز");
  assert.deepEqual(priced[5], { key: "ليمون", name: "ليمون", matches: {} });
});

test("fails when no batch could be matched", async () => {
  await assert.rejects(
    withFakeServices(["أرز", "ليمون"], () => estimateGroceryPrices(sixLines, carrefourFor(sixLines))),
    /GROCERY_MATCH_FAILED/
  );
});
