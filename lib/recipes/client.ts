import { supabase } from "@/lib/supabase/client";

export type RecipeSummary = {
  id: string;
  title: string;
  description: string | null;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  source_reel_url: string | null;
  source_thumbnail_url: string | null;
  folder_id: string | null;
  created_at: string;
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
  }>;
  steps_json: Array<{
    order: number;
    text: string;
    duration_minutes?: number;
  }>;
  nutrition_json: Record<string, unknown>;
  source_url: string | null;
  source_platform: string | null;
  source_reel_url: string | null;
  source_thumbnail_url: string | null;
  folder_id: string | null;
};

export async function listRecipes(params?: {
  limit?: number;
  folderId?: string | null;
}): Promise<RecipeSummary[]> {
  let query = supabase
    .from("recipes")
    .select(
      "id,title,description,servings,prep_minutes,cook_minutes,source_reel_url,source_thumbnail_url,folder_id,created_at"
    )
    .order("created_at", { ascending: false });

  if (params?.folderId === null) query = query.is("folder_id", null);
  if (typeof params?.folderId === "string") query = query.eq("folder_id", params.folderId);
  if (typeof params?.limit === "number") query = query.limit(params.limit);

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as RecipeSummary[];
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

export async function getRecipeById(id: string): Promise<RecipeDetail | null> {
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id,title,description,servings,prep_minutes,cook_minutes,created_at,ingredients_json,steps_json,nutrition_json,source_url,source_platform,source_reel_url,source_thumbnail_url,folder_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as RecipeDetail | null) ?? null;
}
