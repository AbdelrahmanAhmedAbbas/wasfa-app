import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convex } from "@/lib/convex/client";
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
  const items = await convex.query(api.shopping.list, {});
  return items.map((item) => ({
    id: item.id,
    recipe_id: item.recipe_id,
    ingredient_text: item.ingredient_text,
    checked: item.checked,
    created_at: item.created_at,
    recipe: item.recipe
      ? {
          id: item.recipe.id,
          title: item.recipe.title,
          localized: normalizeLocalizedRecipeText(item.recipe.localized_json),
          source_thumbnail_url: item.recipe.source_thumbnail_url,
        }
      : null,
  }));
}

export async function toggleShoppingListItemChecked(
  itemId: string,
  checked: boolean
): Promise<void> {
  await convex.mutation(api.shopping.setChecked, { itemId: itemId as Id<"shopping_list_items">, checked });
}

export async function deleteShoppingListItem(itemId: string): Promise<void> {
  await convex.mutation(api.shopping.remove, { itemId: itemId as Id<"shopping_list_items"> });
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
  // Shopping items are written in the recipe's own language.
  const recipeLanguage = /[\u0600-\u06FF]/.test(recipe.ingredients_json[0]?.name ?? "") ? "ar" : "en";
  const assessments = preferences ? assessRecipeIngredients(recipe, preferences, recipeLanguage) : [];

  const lines = recipe.ingredients_json
    .map((ingredient, index) => {
      const halal = assessments[index]?.halal;
      return formatIngredient(
        halal?.swapped && halal.alternative ? { ...ingredient, name: halal.alternative } : ingredient
      );
    })
    .filter((text) => text.length > 0);

  if (lines.length === 0) return;

  // New lines start unchecked; a line already on the list is left as it is, so
  // re-planning a recipe keeps what the user has checked off.
  await convex.mutation(api.shopping.addForRecipe, { recipeId: recipe.id as Id<"recipes">, lines });
}

export async function removeRecipeFromShoppingList(recipeId: string): Promise<void> {
  await convex.mutation(api.shopping.removeForRecipe, { recipeId });
}
