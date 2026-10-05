// Exercises the Convex backend as a signed-in user: sign-in, profile, folders, recipes,
// the shopping list and import rejections. It talks to the deployment in .env.local.
//
//   SMOKE_EMAIL=... SMOKE_PASSWORD=... node scripts/convex-smoke.mjs
//
// The account must exist first:
//   npx convex run users:createPasswordAccount '{"email":"...","password":"..."}'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";

import { api } from "../convex/_generated/api.js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()])
);
const { SMOKE_EMAIL: email, SMOKE_PASSWORD: password } = process.env;
assert.ok(email && password, "set SMOKE_EMAIL and SMOKE_PASSWORD");

const client = new ConvexHttpClient(env.EXPO_PUBLIC_CONVEX_URL);
const step = (name) => console.log(`ok - ${name}`);

async function rejectionCode(run) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ConvexError) return error.data?.code ?? null;
    throw error;
  }
  return "(no rejection)";
}

// Signed out: nothing is readable.
assert.equal(await client.query(api.users.viewer, {}), null);
assert.equal(await rejectionCode(() => client.query(api.recipes.list, {})), "UNAUTHENTICATED");
step("signed-out callers get nothing");

// Sign-in.
assert.equal(
  await client
    .action(api.auth.signIn, { provider: "password", params: { email, password: `${password}-wrong`, flow: "signIn" } })
    .then(() => "signed in", () => "refused"),
  "refused"
);
assert.equal(
  await client
    .action(api.auth.signIn, { provider: "password", params: { email: `new-${email}`, password, flow: "signUp" } })
    .then(() => "signed up", () => "refused"),
  "refused"
);
const session = await client.action(api.auth.signIn, {
  provider: "password",
  params: { email, password, flow: "signIn" },
});
assert.ok(session.tokens?.token, "sign-in should return a token");
client.setAuth(session.tokens.token);
const viewer = await client.query(api.users.viewer, {});
assert.equal(viewer.email, email.toLowerCase());
step("email sign-in works; a wrong password and sign-up are refused");

// Profile: a partial save keeps the other answers.
await client.mutation(api.profiles.save, { fields: { diet: ["halal"], household_size: "two", dislikes: [] } });
await client.mutation(api.profiles.save, { fields: { allergies: ["egg"], goal: null } });
assert.deepEqual(await client.query(api.profiles.get, {}), {
  diet: ["halal"],
  household_size: "two",
  dislikes: [],
  allergies: ["egg"],
  goal: null,
});
step("profile saves merge field by field");

// Folders.
const suffix = Date.now();
const folder = await client.mutation(api.recipes.createFolder, { name: `  Smoke ${suffix} ` });
assert.equal(folder.name, `Smoke ${suffix}`);
assert.equal(
  await rejectionCode(() => client.mutation(api.recipes.createFolder, { name: `Smoke ${suffix}` })),
  "FOLDER_EXISTS"
);
const renamed = await client.mutation(api.recipes.renameFolder, { folderId: folder.id, name: `Renamed ${suffix}` });
assert.equal(renamed.name, `Renamed ${suffix}`);
assert.ok((await client.query(api.recipes.listFolders, {})).some((entry) => entry.id === folder.id));
step("folders can be created, renamed and not duplicated");

// Import rejections happen before any job exists.
const rejections = {
  "https://example.com/recipe": "UNSUPPORTED_URL",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ": "YOUTUBE_NOT_A_SHORT",
  "not a link": "UNSUPPORTED_URL",
};
for (const [sourceUrl, code] of Object.entries(rejections)) {
  assert.equal(await rejectionCode(() => client.action(api.imports.create, { sourceUrl })), code, sourceUrl);
}
assert.equal(await client.query(api.imports.get, { jobId: "not-an-id" }), null);
assert.equal(await client.query(api.recipes.get, { recipeId: "3f0c2c1e-8a8e-4e0b-9d0a-000000000000" }), null);
step("unsupported links are rejected with their codes; unknown ids read as not found");

// Recipes saved by the pipeline (see SMOKE_RECIPE_ID) can be filed, listed and shopped for.
const recipeId = process.env.SMOKE_RECIPE_ID;
if (recipeId) {
  const recipe = await client.query(api.recipes.get, { recipeId });
  assert.ok(recipe, "the recipe should belong to this user");
  assert.ok(recipe.ingredients_json.length >= 2 && recipe.steps_json.length >= 2);

  await client.mutation(api.recipes.assignFolder, { recipeId, folderId: folder.id });
  assert.deepEqual((await client.query(api.recipes.list, { folderId: folder.id })).map((entry) => entry.id), [recipeId]);
  assert.ok(!(await client.query(api.recipes.list, { folderId: null })).some((entry) => entry.id === recipeId));
  assert.ok((await client.query(api.recipes.list, {})).some((entry) => entry.id === recipeId));

  const lines = ["2 tbsp olive oil", "1 onion", "1 onion", "  "];
  await client.mutation(api.shopping.addForRecipe, { recipeId, lines });
  let items = (await client.query(api.shopping.list, {})).filter((item) => item.recipe_id === recipeId);
  assert.equal(items.length, 2);
  assert.equal(items[0].recipe.title, recipe.title);
  await client.mutation(api.shopping.setChecked, { itemId: items[0].id, checked: true });
  await client.mutation(api.shopping.addForRecipe, { recipeId, lines });
  items = (await client.query(api.shopping.list, {})).filter((item) => item.recipe_id === recipeId);
  assert.equal(items.length, 2, "adding the same lines again must not duplicate them");
  assert.equal(items.filter((item) => item.checked).length, 1, "a checked line stays checked");

  const toggled = await client.mutation(api.recipes.setIngredientUseOriginal, { recipeId, index: 0, useOriginal: true });
  assert.equal(toggled[0].use_original, true);
  const restored = await client.mutation(api.recipes.setIngredientUseOriginal, { recipeId, index: 0, useOriginal: false });
  assert.equal("use_original" in restored[0], false);

  await client.mutation(api.recipes.removeFolder, { folderId: folder.id });
  assert.equal((await client.query(api.recipes.get, { recipeId })).folder_id, null);
  await client.mutation(api.shopping.removeForRecipe, { recipeId });
  assert.equal((await client.query(api.shopping.list, {})).filter((item) => item.recipe_id === recipeId).length, 0);
  step("a saved recipe can be filed, listed, shopped for and unfiled");
} else {
  await client.mutation(api.recipes.removeFolder, { folderId: folder.id });
  console.log("skipped - recipe checks (set SMOKE_RECIPE_ID to a recipe this user owns)");
}

console.log("all checks passed");
