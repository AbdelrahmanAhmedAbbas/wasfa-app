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
  assert.deepEqual(mergedTexts("2 cups rice", "1 cup rice"), ["3 cups Rice"]);
  assert.deepEqual(mergedTexts("1 tbsp olive oil", "2 tablespoons olive oil"), ["3 tbsp Olive oil"]);
  assert.deepEqual(mergedTexts("2 onions", "1 onion"), ["3 Onions"]);
  assert.deepEqual(mergedTexts("1 onion", "2 onions"), ["3 Onions"]);
  assert.deepEqual(mergedTexts("2 tomatoes", "1 Tomato (diced)"), ["3 Tomatoes"]);
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
    ["2½ cups Rice", "3 cloves Garlic", "1 cup Milk"]
  );
  assert.deepEqual(
    groups.map((group) => group.items.length),
    [3, 2, 1]
  );
});

test("converts between units of the same kind before adding", () => {
  assert.deepEqual(mergedTexts("500 g chicken", "1 kg chicken"), ["1.5 kg Chicken"]);
  assert.deepEqual(mergedTexts("200 g flour", "300 g flour"), ["500 g Flour"]);
  assert.deepEqual(mergedTexts("250 g chicken", "0.25 kg chicken"), ["500 g Chicken"]);
  assert.deepEqual(mergedTexts("500 ml milk", "1 l milk"), ["1.5 l Milk"]);
  assert.deepEqual(mergedTexts("8 oz pasta", "1 lb pasta"), ["1½ lb Pasta"]);
});

test("keeps amounts that cannot be converted side by side on one row", () => {
  assert.deepEqual(mergedTexts("2 cups rice", "500 g rice"), ["2 cups + 500 g Rice"]);
  assert.deepEqual(mergedTexts("1 tbsp butter", "1 tsp butter"), ["1 tbsp + 1 tsp Butter"]);
});

test("merges an ingredient that has no amount in one of the recipes", () => {
  assert.deepEqual(mergedTexts("salt", "Salt"), ["Salt"]);
  assert.deepEqual(mergedTexts("1 tsp salt", "salt"), ["1 tsp Salt"]);
  assert.deepEqual(mergedTexts("1 tsp salt", "salt, to taste", "to taste salt"), ["1 tsp Salt"]);
});

test("merges Arabic ingredients across spellings and writes Arabic units", () => {
  assert.deepEqual(mergedTexts("٢ كوب أرز", "1 كوب الأرز"), ["3 كوب أرز"]);
  assert.deepEqual(mergedTexts("500 جرام دجاج", "1 كيلو دجاج"), ["1.5 كجم دجاج"]);
  assert.deepEqual(mergedTexts("2 فص ثوم", "3 فصوص ثوم"), ["5 فصوص ثوم"]);
  assert.deepEqual(mergedTexts("ملح", "ملح حسب الرغبة"), ["ملح"]);
  assert.deepEqual(mergedTexts("نصف كوب أرز", "1 كوب أرز"), ["1½ كوب أرز"]);
});

test("leaves notes, descriptions and cooking steps off the row", () => {
  assert.deepEqual(mergedTexts("2 cups basmati rice (washed)"), ["2 cups Basmati rice"]);
  assert.deepEqual(mergedTexts("2 chicken breasts, cut into cubes and marinated overnight"), ["2 Chicken breasts"]);
  assert.deepEqual(mergedTexts("1 cup rice - washed and soaked for 30 minutes"), ["1 cup Rice"]);
  assert.deepEqual(mergedTexts("3 فصوص ثوم مفروم، يقلى حتى يذهب لونه"), ["3 فصوص ثوم مفروم"]);
  assert.deepEqual(mergedTexts("1 cup flour (sifted, for the dough"), ["1 cup Flour"]);
  assert.deepEqual(mergedTexts("parsley for garnish"), ["Parsley"]);
});

test("reads amounts written as words", () => {
  assert.deepEqual(mergedTexts("a pinch of salt"), ["1 pinch Salt"]);
  assert.deepEqual(mergedTexts("half a cup milk", "1 cup milk"), ["1½ cups Milk"]);
  assert.deepEqual(mergedTexts("رشة ملح"), ["1 رشة ملح"]);
  assert.deepEqual(mergedTexts("extra virgin olive oil"), ["Extra virgin olive oil"]);
});

test("adds up sizes and cuts of the same ingredient", () => {
  assert.deepEqual(mergedTexts("2 large eggs", "3 eggs"), ["5 Eggs"]);
  assert.deepEqual(mergedTexts("1 chopped onion", "2 onions"), ["3 Onions"]);
  assert.deepEqual(mergedTexts("2 فص ثوم مفروم", "1 فص ثوم"), ["3 فصوص ثوم"]);
  // Minced meat is its own thing to buy.
  assert.deepEqual(mergedTexts("500 جرام لحم مفروم", "500 جرام لحم"), ["500 جم لحم مفروم", "500 جم لحم"]);
});

test("writes fractions the way recipes do", () => {
  assert.deepEqual(mergedTexts("1/3 cup milk", "1/3 cup milk"), ["⅔ cup Milk"]);
  assert.deepEqual(mergedTexts("1/4 tsp salt", "1/2 tsp salt"), ["¾ tsp Salt"]);
  assert.deepEqual(mergedTexts("0.33 cup oil"), ["⅓ cup Oil"]);
  assert.deepEqual(mergedTexts("1.3 kg beef"), ["1.3 kg Beef"]);
});

test("keeps uncountable names singular", () => {
  assert.deepEqual(mergedTexts("1 garlic", "1 garlic"), ["2 Garlic"]);
  assert.deepEqual(mergedTexts("1 lemon", "1 lemon"), ["2 Lemons"]);
});

test("gives the name and the amount apart for the row", () => {
  const [rice] = mergeShoppingItems([item("2 cups rice"), item("500 g rice")]);
  assert.equal(rice.name, "Rice");
  assert.equal(rice.amount, "2 cups + 500 g");
  const [salt] = mergeShoppingItems([item("salt")]);
  assert.equal(salt.amount, "");
  assert.equal(salt.text, "Salt");
});

test("counts a recipe planned twice twice", () => {
  const items = [
    { ingredient_text: "2 cups rice", recipe_id: "a" },
    { ingredient_text: "1 cup rice", recipe_id: "b" },
    { ingredient_text: "salt", recipe_id: "a" },
  ];
  const groups = mergeShoppingItems(items, { timesPlanned: (entry) => (entry.recipe_id === "a" ? 2 : 1) });
  assert.deepEqual(groups.map((group) => group.text), ["5 cups Rice", "Salt"]);
});

test("adds the same line listed twice in one recipe", () => {
  // Flour for the dough and flour for the filling, saved as two rows.
  assert.deepEqual(mergedTexts("1 cup flour", "1 cup flour"), ["2 cups Flour"]);
});

test("counts merged rows that still need buying", () => {
  assert.equal(countItemsToBuy([]), 0);
  assert.equal(countItemsToBuy([item("1 cup rice"), item("2 cups rice"), item("1 onion")]), 2);
  // A merged row is done only when every recipe's share is in the basket.
  assert.equal(countItemsToBuy([item("1 cup rice", true), item("2 cups rice"), item("1 onion", true)]), 1);
  assert.equal(countItemsToBuy([item("1 cup rice", true), item("2 cups rice", true)]), 0);
});
