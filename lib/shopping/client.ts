import { supabase } from "@/lib/supabase/client";

import { normalizeLocalizedRecipeText, type LocalizedRecipeText, type RecipeDetail } from "@/lib/recipes/client";

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

type ShoppingListRow = {
  id: string;
  recipe_id: string;
  ingredient_text: string;
  checked: boolean;
  created_at: string;
  recipe:
    | {
        id: string;
        title: string;
        localized_json?: unknown;
        source_thumbnail_url: string | null;
      }[]
    | null;
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
  return ((data ?? []) as ShoppingListRow[]).map((row) => ({
    id: row.id,
    recipe_id: row.recipe_id,
    ingredient_text: row.ingredient_text,
    checked: row.checked,
    created_at: row.created_at,
    recipe: Array.isArray(row.recipe) && row.recipe[0]
      ? {
          id: row.recipe[0].id,
          title: row.recipe[0].title,
          localized: normalizeLocalizedRecipeText(row.recipe[0].localized_json),
          source_thumbnail_url: row.recipe[0].source_thumbnail_url,
        }
      : null,
  }));
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

export async function addRecipeIngredientsToShoppingList(
  recipe: Pick<RecipeDetail, "id" | "ingredients_json">
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("Sign in is required to use shopping list.");

  const rows = recipe.ingredients_json
    .map((ingredient) => formatIngredient(ingredient))
    .filter((text) => text.length > 0)
    .map((ingredient_text) => ({
      user_id: userId,
      recipe_id: recipe.id,
      ingredient_text,
      checked: true,
    }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("shopping_list_items")
    .upsert(rows, { onConflict: "user_id,recipe_id,ingredient_text" });
  if (error) throw error;
}
