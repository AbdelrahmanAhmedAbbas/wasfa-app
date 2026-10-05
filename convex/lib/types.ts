export type SourcePlatform = "instagram" | "tiktok" | "youtube" | "unknown";

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
  is_estimated: boolean;
};

export type StepTemperature = {
  value: number;
  unit: "C" | "F";
};

export type StepItem = {
  order: number;
  title: string;
  text: string;
  duration_minutes?: number;
  temperature?: StepTemperature;
  equipment?: string[];
  ingredients_used?: string[];
  tips?: string[];
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
  cuisine?: string;
  meal_type?: string;
  ingredients: Array<{
    name: string;
    notes?: string;
    /** The halal alternative for a non-halal ingredient, in this language. */
    suggested_alternative?: string;
  }>;
  steps: StepItem[];
};

export type RecipeDraft = {
  title: string;
  description?: string;
  cuisine: string;
  meal_type: string;
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
