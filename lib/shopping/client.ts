import { supabase } from "@/lib/supabase/client";

import { normalizeLocalizedRecipeText, type LocalizedRecipeText, type RecipeDetail } from "@/lib/recipes/client";
import { assessRecipeIngredients, type RecipePreferenceInput } from "@/lib/recipes/ingredient-warnings";

export type ShoppingListItem = {
  id: string;
  recipe_id: string;
  ingredient_text: string;
  checked: boolean;
  created_at: string;
  recipe?: {
    id: string;
    title: string;
    localized: Partial<Record<"en" | "ar", LocalizedRecipeText>>;
    source_thumbnail_url: string | null;
  } | null;
};

type ShoppingListRecipeRow = {
  id: string;
  title: string;
  localized_json?: unknown;
  source_thumbnail_url: string | null;
};

type ShoppingListRow = {
  id: string;
  recipe_id: string;
  ingredient_text: string;
  checked: boolean;
  created_at: string;
  // PostgREST returns a to-one embed as an object; older typings describe it as an array.
  recipe: ShoppingListRecipeRow | ShoppingListRecipeRow[] | null;
};

function formatIngredient(item: {
  name: string;
  quantity?: string;
  unit?: string;
  notes?: string;
}) {
  const base = [item.quantity, item.unit, item.name].filter(Boolean).join(" ").trim();
  return item.notes ? `${base} (${item.notes})` : base;
}

export async function listShoppingListItems(): Promise<ShoppingListItem[]> {
  const { data, error } = await supabase
    .from("shopping_list_items")
    .select("id,recipe_id,ingredient_text,checked,created_at,recipe:recipes(id,title,localized_json,source_thumbnail_url)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as ShoppingListRow[]).map((row) => {
    const recipe = Array.isArray(row.recipe) ? row.recipe[0] : row.recipe;
    return {
      id: row.id,
      recipe_id: row.recipe_id,
      ingredient_text: row.ingredient_text,
      checked: row.checked,
      created_at: row.created_at,
      recipe: recipe
        ? {
            id: recipe.id,
            title: recipe.title,
            localized: normalizeLocalizedRecipeText(recipe.localized_json),
            source_thumbnail_url: recipe.source_thumbnail_url,
          }
        : null,
    };
  });
}

export async function toggleShoppingListItemChecked(
  itemId: string,
  checked: boolean
): Promise<void> {
  const { error } = await supabase
    .from("shopping_list_items")
    .update({ checked })
    .eq("id", itemId);
  if (error) throw error;
}

export async function deleteShoppingListItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("shopping_list_items").delete().eq("id", itemId);
  if (error) throw error;
}

/**
 * Puts a recipe's ingredients on the shopping list. With `preferences`, a
 * non-halal ingredient is listed as its halal swap (unless the user chose to
 * keep the original), so the list matches what the recipe screen shows.
 */
export async function addRecipeIngredientsToShoppingList(
  recipe: Pick<RecipeDetail, "id" | "ingredients_json" | "localized">,
  preferences?: RecipePreferenceInput
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("Sign in is required to use shopping list.");

  // Shopping items are written in the recipe's own language.
  const recipeLanguage = /[\u0600-\u06FF]/.test(recipe.ingredients_json[0]?.name ?? "") ? "ar" : "en";
  const assessments = preferences ? assessRecipeIngredients(recipe, preferences, recipeLanguage) : [];

  const rows = recipe.ingredients_json
    .map((ingredient, index) => {
      const halal = assessments[index]?.halal;
      return formatIngredient(
        halal?.swapped && halal.alternative ? { ...ingredient, name: halal.alternative } : ingredient
      );
    })
    .filter((text) => text.length > 0)
    .map((ingredient_text) => ({
      user_id: userId,
      recipe_id: recipe.id,
      ingredient_text,
      // `checked` means "already in the basket", so new items start unchecked.
      checked: false,
    }));

  if (rows.length === 0) return;

  // Ignore duplicates so re-planning a recipe keeps items the user already checked off.
  const { error } = await supabase
    .from("shopping_list_items")
    .upsert(rows, { onConflict: "user_id,recipe_id,ingredient_text", ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeRecipeFromShoppingList(recipeId: string): Promise<void> {
  const { error } = await supabase.from("shopping_list_items").delete().eq("recipe_id", recipeId);
  if (error) throw error;
}
