import assert from "node:assert/strict";
import { test } from "node:test";

import { importFinishedMessage, isExpoPushToken, unregisteredTokens } from "./pushMessages.ts";

const recipe = { title: "Chicken Kabsa", titles: { en: "Chicken Kabsa", ar: "كبسة دجاج" } };

test("names the saved recipe in the phone's language", () => {
  assert.deepEqual(importFinishedMessage({ language: "ar", recipe }), {
    title: "وصفتك جاهزة",
    body: "تم حفظ «كبسة دجاج» في مكتبتك.",
  });
  assert.equal(importFinishedMessage({ language: "en", recipe }).body, '"Chicken Kabsa" is saved in your library.');
});

test("falls back to the stored title when the recipe has no text in that language", () => {
  const message = importFinishedMessage({
    language: "ar",
    recipe: { title: "Chicken Kabsa", titles: { en: "Chicken Kabsa", ar: null } },
  });
  assert.equal(message.body, "تم حفظ «Chicken Kabsa» في مكتبتك.");
});

test("says the import failed when there is no recipe", () => {
  assert.equal(importFinishedMessage({ language: "en", recipe: null }).title, "We couldn't import that recipe");
  assert.equal(importFinishedMessage({ language: "ar", recipe: null }).title, "تعذّر استيراد الوصفة");
});

test("accepts only Expo push tokens", () => {
  assert.equal(isExpoPushToken("ExponentPushToken[abc123-_]"), true);
  assert.equal(isExpoPushToken("ExpoPushToken[abc123]"), true);
  assert.equal(isExpoPushToken("abc123"), false);
  assert.equal(isExpoPushToken("ExponentPushToken[]"), false);
});

test("picks out the tokens Expo no longer knows", () => {
  const tokens = ["ExponentPushToken[a]", "ExponentPushToken[b]", "ExponentPushToken[c]"];
  const reply = {
    data: [
      { status: "ok", id: "1" },
      { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } },
      { status: "error", message: "busy", details: { error: "MessageRateExceeded" } },
    ],
  };
  assert.deepEqual(unregisteredTokens(tokens, reply), ["ExponentPushToken[b]"]);
  assert.deepEqual(unregisteredTokens(tokens, { errors: [{ code: "FAILED" }] }), []);
});
