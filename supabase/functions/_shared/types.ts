export type SourcePlatform = "instagram" | "tiktok" | "unknown";

export type ImportEntrypoint = "paste_url" | "share_intent" | "manual_retry";

export type ImportStatus =
  | "queued"
  | "processing"
  | "awaiting_user_review"
  | "confirmed"
  | "failed";

export type IngredientItem = {
  name: string;
  quantity?: string;
  unit?: string;
  notes?: string;
};

export type StepItem = {
  order: number;
  text: string;
  duration_minutes?: number;
};

export type NutritionEstimate = {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  confidence: number;
  disclaimer: string;
  estimated: true;
};

export type LocalizedRecipeText = {
  title: string;
  description?: string;
  ingredients: Array<{
    name: string;
    notes?: string;
  }>;
  steps: Array<{
    order: number;
    text: string;
  }>;
};

export type RecipeDraft = {
  title: string;
  description?: string;
  servings?: number;
  prep_minutes?: number;
  cook_minutes?: number;
  ingredients: IngredientItem[];
  steps: StepItem[];
  nutrition_estimate?: NutritionEstimate;
  source: {
    platform: SourcePlatform;
    url: string;
    language?: string;
  };
  localized?: Partial<Record<"en" | "ar", LocalizedRecipeText>>;
};

export type ImportJobRow = {
  id: string;
  user_id: string | null;
  client_id: string | null;
  access_token: string;
  source_platform: SourcePlatform;
  entrypoint: ImportEntrypoint;
  source_url: string;
  status: ImportStatus;
  error_code: string | null;
  error_message: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type ImportCreateInput = {
  source_url?: string;
  shared_text?: string;
  entrypoint?: ImportEntrypoint;
  client_id?: string;
};

export type ImportCreateResponse = {
  job_id: string;
  access_token: string;
  status: ImportStatus;
  deduplicated: boolean;
};
