import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { requireUserId } from "./authz";
import { ingredient, localized, step } from "./schema";

const MAX_LISTED_RECIPES = 300;
const MAX_FOLDERS = 200;

/** A recipe as the app's library reads it. The ingredients come along so it can be searched. */
function toSummary(recipe: Doc<"recipes">) {
  return {
    id: recipe._id,
    title: recipe.title,
    description: recipe.description ?? null,
    cuisine: recipe.cuisine,
    meal_type: recipe.meal_type,
    localized_json: recipe.localized_json,
    ingredients_json: recipe.ingredients_json,
    servings: recipe.servings ?? null,
    prep_minutes: recipe.prep_minutes ?? null,
    cook_minutes: recipe.cook_minutes ?? null,
    source_reel_url: recipe.source_reel_url ?? null,
    source_thumbnail_url: recipe.source_thumbnail_url ?? null,
    folder_id: recipe.folder_id ?? null,
    created_at: new Date(recipe._creationTime).toISOString(),
  };
}

export function toDetail(recipe: Doc<"recipes">) {
  return {
    ...toSummary(recipe),
    steps_json: recipe.steps_json,
    nutrition_json: recipe.nutrition_json,
    source_url: recipe.source_url,
    source_platform: recipe.source_platform,
  };
}

function toFolder(folder: Doc<"recipe_folders">) {
  return {
    id: folder._id,
    name: folder.name,
    created_at: new Date(folder._creationTime).toISOString(),
  };
}

/** The recipe when it exists and belongs to the user, otherwise null. */
async function findOwnedRecipe(ctx: QueryCtx, userId: Id<"users">, recipeId: string) {
  // The app can still hold ids from before the move to Convex; those are simply not found.
  const id = ctx.db.normalizeId("recipes", recipeId);
  if (!id) return null;
  const recipe = await ctx.db.get("recipes", id);
  return recipe && recipe.user_id === userId ? recipe : null;
}

async function requireOwnedRecipe(ctx: QueryCtx, userId: Id<"users">, recipeId: Id<"recipes">) {
  const recipe = await ctx.db.get("recipes", recipeId);
  if (!recipe || recipe.user_id !== userId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Recipe not found." });
  }
  return recipe;
}

async function requireOwnedFolder(ctx: QueryCtx, userId: Id<"users">, folderId: Id<"recipe_folders">) {
  const folder = await ctx.db.get("recipe_folders", folderId);
  if (!folder || folder.user_id !== userId) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Folder not found." });
  }
  return folder;
}

/**
 * The user's recipes, newest first. `folderId` narrows to one folder; null means the
 * recipes that are in no folder.
 */
export const list = query({
  args: {
    folderId: v.optional(v.union(v.id("recipe_folders"), v.null())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { folderId, limit }) => {
    const userId = await requireUserId(ctx);
    const count = Math.min(Math.max(1, Math.trunc(limit ?? MAX_LISTED_RECIPES)), MAX_LISTED_RECIPES);

    const recipes =
      folderId === undefined
        ? await ctx.db
            .query("recipes")
            .withIndex("by_user_id", (q) => q.eq("user_id", userId))
            .order("desc")
            .take(count)
        : await ctx.db
            .query("recipes")
            .withIndex("by_user_id_and_folder_id", (q) =>
              q.eq("user_id", userId).eq("folder_id", folderId ?? undefined)
            )
            .order("desc")
            .take(count);

    return recipes.map(toSummary);
  },
});

export const get = query({
  args: { recipeId: v.string() },
  handler: async (ctx, { recipeId }) => {
    const userId = await requireUserId(ctx);
    const recipe = await findOwnedRecipe(ctx, userId, recipeId);
    return recipe ? toDetail(recipe) : null;
  },
});

export const remove = mutation({
  args: { recipeId: v.id("recipes") },
  handler: async (ctx, { recipeId }) => {
    const userId = await requireUserId(ctx);
    const recipe = await requireOwnedRecipe(ctx, userId, recipeId);

    // A recipe's shopping lines go with it.
    for await (const item of ctx.db
      .query("shopping_list_items")
      .withIndex("by_recipe_id", (q) => q.eq("recipe_id", recipe._id))) {
      await ctx.db.delete("shopping_list_items", item._id);
    }
    await ctx.db.delete("recipes", recipe._id);
    return null;
  },
});

export const assignFolder = mutation({
  args: { recipeId: v.id("recipes"), folderId: v.union(v.id("recipe_folders"), v.null()) },
  handler: async (ctx, { recipeId, folderId }) => {
    const userId = await requireUserId(ctx);
    const recipe = await requireOwnedRecipe(ctx, userId, recipeId);
    if (folderId) await requireOwnedFolder(ctx, userId, folderId);
    await ctx.db.patch("recipes", recipe._id, { folder_id: folderId ?? undefined });
    return null;
  },
});

/** Records whether an ingredient keeps its original form instead of its halal swap. */
export const setIngredientUseOriginal = mutation({
  args: { recipeId: v.id("recipes"), index: v.number(), useOriginal: v.boolean() },
  handler: async (ctx, { recipeId, index, useOriginal }) => {
    const userId = await requireUserId(ctx);
    const recipe = await requireOwnedRecipe(ctx, userId, recipeId);

    const ingredients = recipe.ingredients_json.map((entry, position) => {
      if (position !== index) return entry;
      const { use_original: _previous, ...rest } = entry;
      return useOriginal ? { ...rest, use_original: true } : rest;
    });
    await ctx.db.patch("recipes", recipe._id, { ingredients_json: ingredients });
    return ingredients;
  },
});

export const listFolders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const folders = await ctx.db
      .query("recipe_folders")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .take(MAX_FOLDERS);
    return folders.map(toFolder);
  },
});

function cleanFolderName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new ConvexError({ code: "INVALID_NAME", message: "Folder name is required." });
  return trimmed;
}

/** A user cannot have two folders with the same name. */
async function assertFolderNameFree(
  ctx: QueryCtx,
  userId: Id<"users">,
  name: string,
  exceptFolderId?: Id<"recipe_folders">
) {
  const folders = await ctx.db
    .query("recipe_folders")
    .withIndex("by_user_id", (q) => q.eq("user_id", userId))
    .take(MAX_FOLDERS);
  if (folders.some((folder) => folder.name === name && folder._id !== exceptFolderId)) {
    throw new ConvexError({ code: "FOLDER_EXISTS", message: "A folder with this name already exists." });
  }
}

export const createFolder = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = cleanFolderName(args.name);
    await assertFolderNameFree(ctx, userId, name);
    const folderId = await ctx.db.insert("recipe_folders", { user_id: userId, name });
    return toFolder((await ctx.db.get("recipe_folders", folderId))!);
  },
});

export const renameFolder = mutation({
  args: { folderId: v.id("recipe_folders"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const folder = await requireOwnedFolder(ctx, userId, args.folderId);
    const name = cleanFolderName(args.name);
    await assertFolderNameFree(ctx, userId, name, folder._id);
    await ctx.db.patch("recipe_folders", folder._id, { name });
    return toFolder({ ...folder, name });
  },
});

/** Deletes a folder. Its recipes stay in the library, in no folder. */
export const removeFolder = mutation({
  args: { folderId: v.id("recipe_folders") },
  handler: async (ctx, { folderId }) => {
    const userId = await requireUserId(ctx);
    const folder = await requireOwnedFolder(ctx, userId, folderId);

    for await (const recipe of ctx.db
      .query("recipes")
      .withIndex("by_user_id_and_folder_id", (q) => q.eq("user_id", userId).eq("folder_id", folder._id))) {
      await ctx.db.patch("recipes", recipe._id, { folder_id: undefined });
    }
    await ctx.db.delete("recipe_folders", folder._id);
    return null;
  },
});

/** For server actions: the recipe when `userId` owns it, otherwise null. */
export const getOwned = internalQuery({
  args: { userId: v.id("users"), recipeId: v.string() },
  handler: async (ctx, { userId, recipeId }) => {
    return await findOwnedRecipe(ctx, userId, recipeId);
  },
});

/** Saves the result of scaling a recipe to a new number of servings. */
export const applyServings = internalMutation({
  args: {
    recipeId: v.id("recipes"),
    servings: v.optional(v.number()),
    ingredients: v.array(ingredient),
    steps: v.array(step),
    localized,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("recipes", args.recipeId, {
      servings: args.servings,
      ingredients_json: args.ingredients,
      steps_json: args.steps,
      localized_json: args.localized,
    });
    return toDetail((await ctx.db.get("recipes", args.recipeId))!);
  },
});

/** Saves the English or Arabic version that was missing from a recipe. */
export const applyLocalized = internalMutation({
  args: { recipeId: v.id("recipes"), localized },
  handler: async (ctx, args) => {
    await ctx.db.patch("recipes", args.recipeId, { localized_json: args.localized });
    return toDetail((await ctx.db.get("recipes", args.recipeId))!);
  },
});
