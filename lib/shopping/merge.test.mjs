import assert from "node:assert/strict";
import { test } from "node:test";

import { countItemsToBuy, mergeShoppingItems, parseShoppingText } from "./merge.ts";

function item(ingredient_text, checked = false) {
  return { ingredient_text, checked };
}

function mergedTexts(...texts) {
  return mergeShoppingItems(texts.map((text) => item(text))).map((group) => group.text);
}

test("reads the amount, unit and name out of a shopping line", () => {
  const rice = parseShoppingText("2 cups basmati rice (washed)");
  assert.equal(rice.amount, 2);
  assert.equal(rice.unit.unit, "cup");
  assert.equal(rice.name, "basmati rice");

  assert.equal(parseShoppingText("1 1/2 tbsp olive oil").amount, 1.5);
  assert.equal(parseShoppingText("1/2 tsp salt").amount, 0.5);
  assert.equal(parseShoppingText("½ cup milk").amount, 0.5);
  assert.equal(parseShoppingText("1½ cups milk").amount, 1.5);
  assert.equal(parseShoppingText("2-3 tomatoes").amount, 3);
  assert.equal(parseShoppingText("200g flour").unit.unit, "g");
  assert.equal(parseShoppingText("2 cups of flour").name, "flour");

  const salt = parseShoppingText("salt");
  assert.equal(salt.amount, null);
  assert.equal(salt.unit, null);
  assert.equal(salt.name, "salt");
});

test("reads Arabic amounts, digits and two-word units", () => {
  const oil = parseShoppingText("٢ ملعقة كبيرة زيت زيتون");
  assert.equal(oil.amount, 2);
  assert.equal(oil.unit.unit, "tbsp");
  assert.equal(oil.name, "زيت زيتون");

  const rice = parseShoppingText("١٫٥ كوب أرز");
  assert.equal(rice.amount, 1.5);
  assert.equal(rice.unit.unit, "cup");
  assert.equal(rice.name, "أرز");

  assert.equal(parseShoppingText("500 جرام دجاج").unit.unit, "g");
  assert.equal(parseShoppingText("3 فصوص ثوم").unit.unit, "clove");
});

test("adds the same ingredient from two recipes into one row", () => {
  assert.deepEqual(mergedTexts("2 cups rice", "1 cup rice"), ["3 cups rice"]);
  assert.deepEqual(mergedTexts("1 tbsp olive oil", "2 tablespoons olive oil"), ["3 tbsp olive oil"]);
  assert.deepEqual(mergedTexts("2 onions", "1 onion"), ["3 onions"]);
  assert.deepEqual(mergedTexts("2 tomatoes", "1 Tomato (diced)"), ["3 tomatoes"]);
});

test("adds three recipes and keeps unrelated ingredients apart", () => {
  const groups = mergeShoppingItems([
    item("1 cup rice"),
    item("2 cloves garlic"),
    item("0.5 cup rice"),
    item("1 clove garlic"),
    item("1 cup rice"),
    item("1 cup milk"),
  ]);
  assert.deepEqual(
    groups.map((group) => group.text),
    ["2.5 cups rice", "3 cloves garlic", "1 cup milk"]
  );
  assert.deepEqual(
    groups.map((group) => group.items.length),
    [3, 2, 1]
  );
});

test("converts between units of the same kind before adding", () => {
  assert.deepEqual(mergedTexts("500 g chicken", "1 kg chicken"), ["1.5 kg chicken"]);
  assert.deepEqual(mergedTexts("200 g flour", "300 g flour"), ["500 g flour"]);
  assert.deepEqual(mergedTexts("500 ml milk", "1 l milk"), ["1.5 l milk"]);
  assert.deepEqual(mergedTexts("8 oz pasta", "1 lb pasta"), ["1.5 lb pasta"]);
});

test("keeps amounts that cannot be converted side by side on one row", () => {
  assert.deepEqual(mergedTexts("2 cups rice", "500 g rice"), ["2 cups + 500 g rice"]);
  assert.deepEqual(mergedTexts("1 tbsp butter", "1 tsp butter"), ["1 tbsp + 1 tsp butter"]);
});

test("merges an ingredient that has no amount in one of the recipes", () => {
  assert.deepEqual(mergedTexts("salt", "Salt"), ["salt"]);
  assert.deepEqual(mergedTexts("1 tsp salt", "salt"), ["1 tsp salt"]);
});

test("merges Arabic ingredients across spellings and writes Arabic units", () => {
  assert.deepEqual(mergedTexts("٢ كوب أرز", "1 كوب الأرز"), ["3 كوب أرز"]);
  assert.deepEqual(mergedTexts("500 جرام دجاج", "1 كيلو دجاج"), ["1.5 كجم دجاج"]);
  assert.deepEqual(mergedTexts("2 فص ثوم", "3 فصوص ثوم"), ["5 فصوص ثوم"]);
  assert.deepEqual(mergedTexts("ملح", "ملح"), ["ملح"]);
});

test("a single item keeps its text exactly as written", () => {
  assert.deepEqual(mergedTexts("2 cups basmati rice (washed)"), ["2 cups basmati rice (washed)"]);
});

test("counts merged rows that still need buying", () => {
  assert.equal(countItemsToBuy([]), 0);
  assert.equal(countItemsToBuy([item("1 cup rice"), item("2 cups rice"), item("1 onion")]), 2);
  // A merged row is done only when every recipe's share is in the basket.
  assert.equal(countItemsToBuy([item("1 cup rice", true), item("2 cups rice"), item("1 onion", true)]), 1);
  assert.equal(countItemsToBuy([item("1 cup rice", true), item("2 cups rice", true)]), 0);
});
