import { useConvexAuth, useQueries } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo } from "react";

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

type ShoppingListRows = FunctionReturnType<typeof api.shopping.list>;

const LIST_SUBSCRIPTION = { list: { query: api.shopping.list, args: {} } };
const NO_SUBSCRIPTION = {};

/**
 * The shopping list, kept current by the server: it changes by itself when a
 * line is added, checked or removed anywhere in the app, so no screen has to
 * ask for it again. `items` is undefined until the first answer arrives;
 * `failed` is true when the list could not be read.
 */
export function useShoppingList(): { items: ShoppingListItem[] | undefined; failed: boolean } {
  const { isAuthenticated } = useConvexAuth();
  // Asked only once the session is confirmed, and through `useQueries` so a
  // refused read comes back as a value instead of crashing the screen.
  const rows = useQueries(isAuthenticated ? LIST_SUBSCRIPTION : NO_SUBSCRIPTION).list as
    | ShoppingListRows
    | Error
    | undefined;

  return useMemo(() => {
    if (rows === undefined || rows instanceof Error) {
      return { items: undefined, failed: rows instanceof Error };
    }
    return {
      failed: false,
      items: rows.map((item) => ({
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
      })),
    };
  }, [rows]);
}

// Checking and removing show at once: the list every screen is reading is
// changed on the spot, and goes back to the server's answer if the change is refused.
export async function toggleShoppingListItemChecked(
  itemId: string,
  checked: boolean
): Promise<void> {
  await convex.mutation(
    api.shopping.setChecked,
    { itemId: itemId as Id<"shopping_list_items">, checked },
    {
      optimisticUpdate: (store) => {
        const rows = store.getQuery(api.shopping.list, {});
        if (!rows) return;
        store.setQuery(
          api.shopping.list,
          {},
          rows.map((row) => (row.id === itemId ? { ...row, checked } : row))
        );
      },
    }
  );
}

export async function deleteShoppingListItem(itemId: string): Promise<void> {
  await convex.mutation(
    api.shopping.remove,
    { itemId: itemId as Id<"shopping_list_items"> },
    {
      optimisticUpdate: (store) => {
        const rows = store.getQuery(api.shopping.list, {});
        if (!rows) return;
        store.setQuery(
          api.shopping.list,
          {},
          rows.filter((row) => row.id !== itemId)
        );
      },
    }
  );
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
  await convex.mutation(
    api.shopping.removeForRecipe,
    { recipeId },
    {
      optimisticUpdate: (store) => {
        const rows = store.getQuery(api.shopping.list, {});
        if (!rows) return;
        store.setQuery(
          api.shopping.list,
          {},
          rows.filter((row) => row.recipe_id !== recipeId)
        );
      },
    }
  );
}
