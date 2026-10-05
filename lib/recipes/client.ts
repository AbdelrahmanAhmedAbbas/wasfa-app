import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convex } from "@/lib/convex/client";

export type RecipeSummary = {
  id: string;
  title: string;
  description: string | null;
  cuisine: string;
  meal_type: string;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  source_reel_url: string | null;
  source_thumbnail_url: string | null;
  folder_id: string | null;
  created_at: string;
  /** Ingredient names as imported, before translation. */
  ingredient_names: string[];
  localized: Partial<Record<"en" | "ar", LocalizedRecipeText>>;
};

export type LocalizedRecipeText = {
  title: string;
  description?: string;
  cuisine?: string;
  meal_type?: string;
  ingredients: Array<{
    name: string;
    notes?: string;
    /** The halal alternative for a non-halal ingredient, in this language. */
    suggested_alternative?: string;
  }>;
  steps: Array<{
    order: number;
    title?: string;
    text: string;
    duration_minutes?: number;
    temperature?: {
      value: number;
      unit: "C" | "F";
    };
    equipment?: string[];
    ingredients_used?: string[];
    tips?: string[];
  }>;
};

export type RecipeFolder = {
  id: string;
  name: string;
  created_at: string;
};

export type RecipeDetail = RecipeSummary & {
  ingredients_json: Array<{
    name: string;
    quantity?: string;
    unit?: string;
    notes?: string;
    preparation?: string;
    size?: string;
    dietary_flags?: string[];
    allergen_hints?: string[];
    is_halal?: boolean | null;
    halal_concern?: string;
    suggested_alternative?: string;
    /** Set when the user keeps a non-halal ingredient instead of its halal swap. */
    use_original?: boolean;
    source?: "caption" | "transcript" | "web_research" | "ai_estimate" | "user_edit";
    confidence?: number;
    evidence_text?: string;
    citation_url?: string;
    needs_review?: boolean;
    is_estimated?: boolean;
  }>;
  steps_json: Array<{
    order: number;
    title?: string;
    text: string;
    duration_minutes?: number;
    temperature?: {
      value: number;
      unit: "C" | "F";
    };
    equipment?: string[];
    ingredients_used?: string[];
    tips?: string[];
  }>;
  nutrition_json: Record<string, unknown>;
  source_url: string | null;
  source_platform: string | null;
  source_reel_url: string | null;
  source_thumbnail_url: string | null;
  folder_id: string | null;
};

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.map((entry) => optionalString(entry)).filter((entry): entry is string => !!entry);
  return entries.length ? entries : undefined;
}

export function normalizeLocalizedRecipeText(input: unknown): Partial<Record<"en" | "ar", LocalizedRecipeText>> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const result: Partial<Record<"en" | "ar", LocalizedRecipeText>> = {};

  for (const language of ["en", "ar"] as const) {
    const value = source[language];
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const title = optionalString(item.title);
    if (!title) continue;

    const ingredientsRaw = Array.isArray(item.ingredients) ? item.ingredients : [];
    const stepsRaw = Array.isArray(item.steps) ? item.steps : [];
    const ingredients: LocalizedRecipeText["ingredients"] = [];
    for (const entry of ingredientsRaw) {
      if (!entry || typeof entry !== "object") continue;
      const ingredient = entry as Record<string, unknown>;
      const name = optionalString(ingredient.name);
      if (name) {
        ingredients.push({
          name,
          notes: optionalString(ingredient.notes),
          suggested_alternative: optionalString(ingredient.suggested_alternative),
        });
      }
    }

    const steps: LocalizedRecipeText["steps"] = [];
    stepsRaw.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      const step = entry as Record<string, unknown>;
      const text = optionalString(step.text);
      if (!text) return;
      const order = typeof step.order === "number" && Number.isFinite(step.order) ? Math.trunc(step.order) : index + 1;
      const temperatureRaw = step.temperature;
      const temperature = temperatureRaw && typeof temperatureRaw === "object"
        ? (temperatureRaw as Record<string, unknown>)
        : null;
      steps.push({
        order,
        title: optionalString(step.title),
        text,
        duration_minutes: typeof step.duration_minutes === "number" && Number.isFinite(step.duration_minutes)
          ? Math.trunc(step.duration_minutes)
          : undefined,
        temperature:
          typeof temperature?.value === "number" && (temperature.unit === "C" || temperature.unit === "F")
            ? { value: temperature.value, unit: temperature.unit }
            : undefined,
        equipment: stringArray(step.equipment),
        ingredients_used: stringArray(step.ingredients_used),
        tips: stringArray(step.tips),
      });
    });

    result[language] = {
      title,
      description: optionalString(item.description),
      cuisine: optionalString(item.cuisine),
      meal_type: optionalString(item.meal_type),
      ingredients,
      steps,
    };
  }

  return result;
}

function getIngredientNames(ingredients: unknown): string[] {
  if (!Array.isArray(ingredients)) return [];
  return ingredients
    .map((entry) => (entry && typeof entry === "object" ? optionalString((entry as { name?: unknown }).name) : undefined))
    .filter((name): name is string => !!name);
}

function withRecipeClassificationFallback<T extends Partial<RecipeSummary>>(recipe: T): T & {
  cuisine: string;
  meal_type: string;
  ingredient_names: string[];
  localized: Partial<Record<"en" | "ar", LocalizedRecipeText>>;
} {
  return {
    ...recipe,
    ingredient_names: getIngredientNames((recipe as T & { ingredients_json?: unknown }).ingredients_json),
    cuisine: typeof recipe.cuisine === "string" && recipe.cuisine.trim() ? recipe.cuisine : "General",
    meal_type: typeof recipe.meal_type === "string" && recipe.meal_type.trim() ? recipe.meal_type : "Meal",
    localized: normalizeLocalizedRecipeText((recipe as T & { localized_json?: unknown }).localized_json),
  };
}

export async function listRecipes(params?: {
  limit?: number;
  folderId?: string | null;
}): Promise<RecipeSummary[]> {
  const recipes = await convex.query(api.recipes.list, {
    folderId: params?.folderId as Id<"recipe_folders"> | null | undefined,
    limit: params?.limit,
  });
  return recipes.map((recipe) => withRecipeClassificationFallback(recipe)) as RecipeSummary[];
}

export async function listRecipeFolders(): Promise<RecipeFolder[]> {
  return await convex.query(api.recipes.listFolders, {});
}

export async function createRecipeFolder(name: string): Promise<RecipeFolder> {
  return await convex.mutation(api.recipes.createFolder, { name });
}

export async function assignRecipeToFolder(
  recipeId: string,
  folderId: string | null
): Promise<void> {
  await convex.mutation(api.recipes.assignFolder, {
    recipeId: recipeId as Id<"recipes">,
    folderId: folderId as Id<"recipe_folders"> | null,
  });
}

/** Deletes a recipe together with its lines on the shopping list. */
export async function deleteRecipeById(recipeId: string): Promise<void> {
  await convex.mutation(api.recipes.remove, { recipeId: recipeId as Id<"recipes"> });
}

export async function updateRecipeFolder(
  folderId: string,
  name: string
): Promise<RecipeFolder> {
  return await convex.mutation(api.recipes.renameFolder, {
    folderId: folderId as Id<"recipe_folders">,
    name,
  });
}

/** Deletes a folder. Its recipes stay in the library, in no folder. */
export async function deleteRecipeFolder(folderId: string): Promise<void> {
  await convex.mutation(api.recipes.removeFolder, { folderId: folderId as Id<"recipe_folders"> });
}

export async function getRecipeById(id: string): Promise<RecipeDetail | null> {
  const recipe = await convex.query(api.recipes.get, { recipeId: id });
  return recipe ? (withRecipeClassificationFallback(recipe) as RecipeDetail) : null;
}

export async function recalculateRecipeServings(
  recipeId: string,
  servings: number
): Promise<RecipeDetail> {
  const recipe = await convex.action(api.recipeAi.recalculateServings, { recipeId, servings });
  return withRecipeClassificationFallback(recipe) as RecipeDetail;
}

/**
 * Asks the server to write the English or Arabic version a recipe is missing.
 * Returns the updated recipe, or null when nothing could be added.
 */
export async function localizeRecipe(recipeId: string): Promise<RecipeDetail | null> {
  const recipe = await convex.action(api.recipeAi.localize, { recipeId });
  return recipe ? (withRecipeClassificationFallback(recipe) as RecipeDetail) : null;
}

/** Records whether an ingredient keeps its original form instead of its halal swap. */
export async function setIngredientUseOriginal(
  recipe: Pick<RecipeDetail, "id" | "ingredients_json">,
  index: number,
  useOriginal: boolean
): Promise<RecipeDetail["ingredients_json"]> {
  return await convex.mutation(api.recipes.setIngredientUseOriginal, {
    recipeId: recipe.id as Id<"recipes">,
    index,
    useOriginal,
  });
}
