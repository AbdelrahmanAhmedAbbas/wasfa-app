import { supabase } from "@/lib/supabase/client";

const RECIPE_SUMMARY_SELECT =
  "id,title,description,cuisine,meal_type,localized_json,servings,prep_minutes,cook_minutes,source_reel_url,source_thumbnail_url,folder_id,created_at";
const LEGACY_RECIPE_SUMMARY_SELECT =
  "id,title,description,servings,prep_minutes,cook_minutes,source_reel_url,source_thumbnail_url,folder_id,created_at";
const RECIPE_DETAIL_SELECT =
  "id,title,description,cuisine,meal_type,localized_json,servings,prep_minutes,cook_minutes,created_at,ingredients_json,steps_json,nutrition_json,source_url,source_platform,source_reel_url,source_thumbnail_url,folder_id";
const LEGACY_RECIPE_DETAIL_SELECT =
  "id,title,description,servings,prep_minutes,cook_minutes,created_at,ingredients_json,steps_json,nutrition_json,source_url,source_platform,source_reel_url,source_thumbnail_url,folder_id";

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

function isMissingRecipeClassificationColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const errObj = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  const haystack = [errObj.message, errObj.details, errObj.hint]
    .map((part) => (part == null ? "" : String(part)))
    .join(" ")
    .toLowerCase();
  const mentionsColumn = /cuisine|meal_type|localized_json/.test(haystack);
  if (!mentionsColumn) return false;
  if (errObj.code === "42703" || errObj.code === "PGRST204") return true;
  return /column .*(cuisine|meal_type|localized_json).* does not exist|could not find the .*(cuisine|meal_type|localized_json).* column/.test(
    haystack
  );
}

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
      if (name) ingredients.push({ name, notes: optionalString(ingredient.notes) });
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

function withRecipeClassificationFallback<T extends Partial<RecipeSummary>>(recipe: T): T & {
  cuisine: string;
  meal_type: string;
  localized: Partial<Record<"en" | "ar", LocalizedRecipeText>>;
} {
  return {
    ...recipe,
    cuisine: typeof recipe.cuisine === "string" && recipe.cuisine.trim() ? recipe.cuisine : "General",
    meal_type: typeof recipe.meal_type === "string" && recipe.meal_type.trim() ? recipe.meal_type : "Meal",
    localized: normalizeLocalizedRecipeText((recipe as T & { localized_json?: unknown }).localized_json),
  };
}

export async function listRecipes(params?: {
  limit?: number;
  folderId?: string | null;
}): Promise<RecipeSummary[]> {
  const runQuery = async (select: string) => {
    let query = supabase
      .from("recipes")
      .select(select)
      .order("created_at", { ascending: false });

    if (params?.folderId === null) query = query.is("folder_id", null);
    if (typeof params?.folderId === "string") query = query.eq("folder_id", params.folderId);
    if (typeof params?.limit === "number") query = query.limit(params.limit);

    return query;
  };

  const { data, error } = await runQuery(RECIPE_SUMMARY_SELECT);

  if (error && isMissingRecipeClassificationColumn(error)) {
    const legacy = await runQuery(LEGACY_RECIPE_SUMMARY_SELECT);
    if (legacy.error) throw legacy.error;
    const legacyRecipes = (legacy.data ?? []) as Partial<RecipeSummary>[];
    return legacyRecipes.map((recipe) => withRecipeClassificationFallback(recipe)) as RecipeSummary[];
  }

  if (error) throw error;
  const recipes = (data ?? []) as Partial<RecipeSummary>[];
  return recipes.map((recipe) => withRecipeClassificationFallback(recipe)) as RecipeSummary[];
}

export async function listRecipeFolders(): Promise<RecipeFolder[]> {
  const { data, error } = await supabase
    .from("recipe_folders")
    .select("id,name,created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as RecipeFolder[];
}

export async function createRecipeFolder(name: string): Promise<RecipeFolder> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("You need to sign in to create folders.");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name is required.");

  const { data, error } = await supabase
    .from("recipe_folders")
    .insert({
      user_id: userId,
      name: trimmed,
    })
    .select("id,name,created_at")
    .single();

  if (error || !data) throw error ?? new Error("Failed to create folder.");
  return data as RecipeFolder;
}

export async function assignRecipeToFolder(
  recipeId: string,
  folderId: string | null
): Promise<void> {
  const { error } = await supabase
    .from("recipes")
    .update({
      folder_id: folderId,
    })
    .eq("id", recipeId);

  if (error) throw error;
}

export async function deleteRecipeById(recipeId: string): Promise<void> {
  const { error } = await supabase.from("recipes").delete().eq("id", recipeId);
  if (error) throw error;
}

export async function updateRecipeFolder(
  folderId: string,
  name: string
): Promise<RecipeFolder> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name is required.");

  const { data, error } = await supabase
    .from("recipe_folders")
    .update({ name: trimmed })
    .eq("id", folderId)
    .select("id,name,created_at")
    .single();

  if (error || !data) throw error ?? new Error("Failed to update folder.");
  return data as RecipeFolder;
}

export async function deleteRecipeFolder(folderId: string): Promise<void> {
  // 1. Uncategorize recipes first (set folder_id = null)
  const { error: updateError } = await supabase
    .from("recipes")
    .update({ folder_id: null })
    .eq("folder_id", folderId);

  if (updateError) throw updateError;

  // 2. Delete the folder
  const { error: deleteError } = await supabase
    .from("recipe_folders")
    .delete()
    .eq("id", folderId);

  if (deleteError) throw deleteError;
}

export async function getRecipeById(id: string): Promise<RecipeDetail | null> {
  const runQuery = (select: string) =>
    supabase
      .from("recipes")
      .select(select)
      .eq("id", id)
      .maybeSingle();

  const { data, error } = await runQuery(RECIPE_DETAIL_SELECT);

  if (error && isMissingRecipeClassificationColumn(error)) {
    const legacy = await runQuery(LEGACY_RECIPE_DETAIL_SELECT);
    if (legacy.error) throw legacy.error;
    return legacy.data
      ? (withRecipeClassificationFallback(legacy.data as Partial<RecipeDetail>) as RecipeDetail)
      : null;
  }

  if (error) throw error;
  return data ? (withRecipeClassificationFallback(data as Partial<RecipeDetail>) as RecipeDetail) : null;
}

export async function recalculateRecipeServings(
  recipeId: string,
  servings: number
): Promise<RecipeDetail> {
  const { data, error } = await supabase.functions.invoke("recipe-recalculate", {
    body: {
      recipe_id: recipeId,
      servings,
    },
  });

  if (error) throw error;
  const recipe = (data as { recipe?: RecipeDetail } | null)?.recipe;
  if (!recipe) throw new Error("Recipe recalculation did not return a recipe.");
  return withRecipeClassificationFallback(recipe);
}
