import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireUserId } from "./authz";

const MAX_LISTED_ITEMS = 1000;
const MAX_LINES_PER_RECIPE = 200;

async function requireOwnedItem(ctx: MutationCtx, userId: Id<"users">, itemId: Id<"shopping_list_items">) {
  const item = await ctx.db.get("shopping_list_items", itemId);
  if (!item || item.user_id !== userId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Shopping item not found." });
  }
  return item;
}

/** The user's shopping list, newest first, each line with the recipe it came from. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const items = await ctx.db
      .query("shopping_list_items")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .order("desc")
      .take(MAX_LISTED_ITEMS);

    const recipes = new Map<Id<"recipes">, Doc<"recipes"> | null>();
    for (const item of items) {
      if (!recipes.has(item.recipe_id)) recipes.set(item.recipe_id, await ctx.db.get("recipes", item.recipe_id));
    }

    return items.map((item) => {
      const recipe = recipes.get(item.recipe_id);
      return {
        id: item._id,
        recipe_id: item.recipe_id,
        ingredient_text: item.ingredient_text,
        checked: item.checked,
        created_at: new Date(item._creationTime).toISOString(),
        recipe: recipe
          ? {
              id: recipe._id,
              title: recipe.title,
              localized_json: recipe.localized_json,
              source_thumbnail_url: recipe.source_thumbnail_url ?? null,
            }
          : null,
      };
    });
  },
});

export const setChecked = mutation({
  args: { itemId: v.id("shopping_list_items"), checked: v.boolean() },
  handler: async (ctx, { itemId, checked }) => {
    const userId = await requireUserId(ctx);
    const item = await requireOwnedItem(ctx, userId, itemId);
    await ctx.db.patch("shopping_list_items", item._id, { checked });
    return null;
  },
});

export const remove = mutation({
  args: { itemId: v.id("shopping_list_items") },
  handler: async (ctx, { itemId }) => {
    const userId = await requireUserId(ctx);
    const item = await requireOwnedItem(ctx, userId, itemId);
    await ctx.db.delete("shopping_list_items", item._id);
    return null;
  },
});

/**
 * Puts a recipe's ingredient lines on the list. A line that is already there is left
 * alone, so planning a recipe again keeps the lines the user has checked off.
 */
export const addForRecipe = mutation({
  args: { recipeId: v.id("recipes"), lines: v.array(v.string()) },
  handler: async (ctx, { recipeId, lines }) => {
    const userId = await requireUserId(ctx);
    const recipe = await ctx.db.get("recipes", recipeId);
    if (!recipe || recipe.user_id !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Recipe not found." });
    }

    const existing = await ctx.db
      .query("shopping_list_items")
      .withIndex("by_user_id_and_recipe_id", (q) => q.eq("user_id", userId).eq("recipe_id", recipeId))
      .take(MAX_LISTED_ITEMS);
    const seen = new Set(existing.map((item) => item.ingredient_text));

    for (const line of lines.slice(0, MAX_LINES_PER_RECIPE)) {
      const text = line.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      await ctx.db.insert("shopping_list_items", {
        user_id: userId,
        recipe_id: recipeId,
        ingredient_text: text,
        checked: false,
      });
    }
    return null;
  },
});

export const removeForRecipe = mutation({
  args: { recipeId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    // A plan made before the move to Convex can still name an old recipe id.
    const recipeId = ctx.db.normalizeId("recipes", args.recipeId);
    if (!recipeId) return null;

    for await (const item of ctx.db
      .query("shopping_list_items")
      .withIndex("by_user_id_and_recipe_id", (q) => q.eq("user_id", userId).eq("recipe_id", recipeId))) {
      await ctx.db.delete("shopping_list_items", item._id);
    }
    return null;
  },
});
