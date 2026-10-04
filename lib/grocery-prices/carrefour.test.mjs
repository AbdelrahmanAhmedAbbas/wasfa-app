import assert from "node:assert/strict";
import { test } from "node:test";

import { parseCarrefourSearchPage } from "./carrefour.ts";

function carrefourItem(overrides) {
  return {
    orderThreshold: { max: 12, min: 1 },
    stock: { stockLevelStatus: "inStock" },
    imageUrl: "https://cdn.mafrservices.com/644111_main.jpg",
    productId: "644111",
    productName: "بيض أبيض - 30 بيضة",
    isSoldByWeight: false,
    sellingPrice: 151.99,
    productType: "FOOD",
    ...overrides,
  };
}

// The page ships its data as string chunks that are cut at arbitrary points.
function page(items, cutAt = 90) {
  const data = `7:["$","$L8",null,{"products":${JSON.stringify(items)}}]`;
  const chunks = [data.slice(0, cutAt), data.slice(cutAt)];
  return (
    "<html><body><div>skeleton</div>" +
    chunks.map((chunk) => `<script>self.__next_f.push([1,${JSON.stringify(chunk)}])</script>`).join("") +
    "<script>self.__next_f.push([0])</script></body></html>"
  );
}

test("reads products across data chunks, in page order", () => {
  const products = parseCarrefourSearchPage(
    page([carrefourItem({}), carrefourItem({ productId: "2", productName: 'بيض "بلدي" {طازج}', sellingPrice: 160 })])
  );

  assert.deepEqual(products, [
    {
      id: "644111",
      name: "بيض أبيض - 30 بيضة",
      price: 151.99,
      imageUrl: "https://cdn.mafrservices.com/644111_main.jpg",
      soldByWeight: false,
      inStock: true,
      isFood: true,
    },
    {
      id: "2",
      name: 'بيض "بلدي" {طازج}',
      price: 160,
      imageUrl: "https://cdn.mafrservices.com/644111_main.jpg",
      soldByWeight: false,
      inStock: true,
      isFood: true,
    },
  ]);
});

test("prices loose produce per kilo, not per half-kilo order", () => {
  const [onion] = parseCarrefourSearchPage(
    page([
      carrefourItem({
        productName: "بصل أحمر",
        isSoldByWeight: true,
        sellingPrice: 11.25,
        orderThreshold: { max: 10, min: 0.5 },
      }),
    ])
  );

  assert.equal(onion.price, 22.5);
  assert.equal(onion.soldByWeight, true);
});

test("marks non-food and out-of-stock products", () => {
  const [soap] = parseCarrefourSearchPage(
    page([carrefourItem({ productType: "NONFOOD", stock: { stockLevelStatus: "outOfStock" } })])
  );

  assert.equal(soap.isFood, false);
  assert.equal(soap.inStock, false);
});

test("lists a product once when the page repeats it", () => {
  assert.equal(parseCarrefourSearchPage(page([carrefourItem({}), carrefourItem({})])).length, 1);
});

test("returns nothing for a page without product data", () => {
  assert.deepEqual(parseCarrefourSearchPage("<HTML><H1>Access Denied</H1></HTML>"), []);
});
