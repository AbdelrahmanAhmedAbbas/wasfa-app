import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const sourcePlatform = v.union(
  v.literal("instagram"),
  v.literal("tiktok"),
  v.literal("youtube"),
  v.literal("unknown")
);

export const importStatus = v.union(
  v.literal("queued"),
  v.literal("processing"),
  v.literal("awaiting_user_review"),
  v.literal("confirmed"),
  v.literal("failed")
);

export const importEntrypoint = v.union(
  v.literal("paste_url"),
  v.literal("share_intent"),
  v.literal("manual_retry")
);

export const appLanguage = v.union(v.literal("en"), v.literal("ar"));

export const devicePlatform = v.union(v.literal("ios"), v.literal("android"));

const stepTemperature = v.object({
  value: v.number(),
  unit: v.union(v.literal("C"), v.literal("F")),
});

export const ingredient = v.object({
  name: v.string(),
  quantity: v.optional(v.string()),
  unit: v.optional(v.string()),
  notes: v.optional(v.string()),
  preparation: v.optional(v.string()),
  size: v.optional(v.string()),
  dietary_flags: v.optional(v.array(v.string())),
  allergen_hints: v.optional(v.array(v.string())),
  is_halal: v.optional(v.union(v.boolean(), v.null())),
  halal_concern: v.optional(v.string()),
  suggested_alternative: v.optional(v.string()),
  // Set when the user keeps a non-halal ingredient instead of its halal swap.
  use_original: v.optional(v.boolean()),
  source: v.optional(
    v.union(
      v.literal("caption"),
      v.literal("transcript"),
      v.literal("web_research"),
      v.literal("ai_estimate"),
      v.literal("user_edit")
    )
  ),
  confidence: v.optional(v.number()),
  evidence_text: v.optional(v.string()),
  citation_url: v.optional(v.string()),
  needs_review: v.optional(v.boolean()),
  is_estimated: v.optional(v.boolean()),
});

export const step = v.object({
  order: v.number(),
  title: v.optional(v.string()),
  text: v.string(),
  duration_minutes: v.optional(v.number()),
  temperature: v.optional(stepTemperature),
  equipment: v.optional(v.array(v.string())),
  ingredients_used: v.optional(v.array(v.string())),
  tips: v.optional(v.array(v.string())),
});

const localizedText = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  cuisine: v.optional(v.string()),
  meal_type: v.optional(v.string()),
  ingredients: v.array(
    v.object({
      name: v.string(),
      notes: v.optional(v.string()),
      suggested_alternative: v.optional(v.string()),
    })
  ),
  steps: v.array(step),
});

export const localized = v.object({
  en: v.optional(localizedText),
  ar: v.optional(localizedText),
});

export const nutrition = v.object({
  calories: v.optional(v.number()),
  protein_g: v.optional(v.number()),
  carbs_g: v.optional(v.number()),
  fat_g: v.optional(v.number()),
  confidence: v.optional(v.number()),
  disclaimer: v.optional(v.string()),
  estimated: v.optional(v.boolean()),
});

// The plans are described in lib/plans.ts.
export const planName = v.union(v.literal("free"), v.literal("premium"));

/** The profile answers a user can save; every field is optional so one can be saved alone. */
export const profileFields = {
  goal: v.optional(v.union(v.string(), v.null())),
  household_size: v.optional(v.union(v.string(), v.null())),
  pain_points: v.optional(v.array(v.string())),
  diet: v.optional(v.array(v.string())),
  allergies: v.optional(v.array(v.string())),
  dislikes: v.optional(v.array(v.string())),
  referral_source: v.optional(v.union(v.string(), v.null())),
  invite_code: v.optional(v.union(v.string(), v.null())),
  age_range: v.optional(v.union(v.string(), v.null())),
  measurement_system: v.optional(v.union(v.string(), v.null())),
  nutrition_display: v.optional(v.union(v.string(), v.null())),
};

export default defineSchema({
  ...authTables,

  // The plan of each account that is not on the free one.
  user_plans: defineTable({
    user_id: v.id("users"),
    plan: planName,
  }).index("by_user_id", ["user_id"]),

  onboarding_profiles: defineTable({
    user_id: v.id("users"),
    ...profileFields,
  }).index("by_user_id", ["user_id"]),

  recipe_folders: defineTable({
    user_id: v.id("users"),
    name: v.string(),
  }).index("by_user_id", ["user_id"]),

  recipes: defineTable({
    user_id: v.id("users"),
    // The import that produced this recipe; importing again from one job updates it.
    draft_job_id: v.optional(v.id("import_jobs")),
    folder_id: v.optional(v.id("recipe_folders")),
    source_platform: sourcePlatform,
    source_url: v.string(),
    source_reel_url: v.optional(v.string()),
    source_thumbnail_url: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    cuisine: v.string(),
    meal_type: v.string(),
    servings: v.optional(v.number()),
    prep_minutes: v.optional(v.number()),
    cook_minutes: v.optional(v.number()),
    ingredients_json: v.array(ingredient),
    steps_json: v.array(step),
    nutrition_json: nutrition,
    localized_json: localized,
  })
    .index("by_user_id", ["user_id"])
    .index("by_user_id_and_folder_id", ["user_id", "folder_id"])
    .index("by_draft_job_id", ["draft_job_id"]),

  shopping_list_items: defineTable({
    user_id: v.id("users"),
    recipe_id: v.id("recipes"),
    ingredient_text: v.string(),
    // True once the item is in the basket.
    checked: v.boolean(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_user_id_and_recipe_id", ["user_id", "recipe_id"])
    .index("by_recipe_id", ["recipe_id"]),

  import_jobs: defineTable({
    user_id: v.id("users"),
    source_platform: sourcePlatform,
    entrypoint: importEntrypoint,
    source_url: v.string(),
    status: importStatus,
    error_code: v.optional(v.string()),
    error_message: v.optional(v.string()),
    // The pipeline stage reported last, shown on the import progress screen.
    current_stage: v.optional(v.string()),
    updated_at: v.number(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_user_id_and_source_url", ["user_id", "source_url"]),

  // A phone that receives its user's notifications, and the language to write them in.
  push_devices: defineTable({
    user_id: v.id("users"),
    token: v.string(),
    platform: devicePlatform,
    language: appLanguage,
  })
    .index("by_user_id", ["user_id"])
    .index("by_token", ["token"]),

  // One row per pipeline step, kept for diagnosing imports.
  job_events: defineTable({
    job_id: v.id("import_jobs"),
    event: v.union(
      v.literal("received"),
      v.literal("normalized"),
      v.literal("ai_extracted"),
      v.literal("confirmed"),
      v.literal("failed")
    ),
    payload: v.any(),
  }).index("by_job_id", ["job_id"]),

  recipe_drafts: defineTable({
    job_id: v.id("import_jobs"),
    user_id: v.id("users"),
    // The extracted recipe and how it was produced, as the pipeline wrote them.
    payload_json: v.any(),
    confidence_json: v.any(),
    language_detected: v.optional(v.string()),
    updated_at: v.number(),
  }).index("by_job_id", ["job_id"]),

  // Recipes already extracted from a link, shared by every user who imports it.
  recipe_extraction_cache: defineTable({
    normalized_source_url: v.string(),
    source_platform: sourcePlatform,
    source_post_id: v.optional(v.string()),
    source_thumbnail_url: v.optional(v.string()),
    payload: v.any(),
    extraction_model: v.optional(v.string()),
  }).index("by_normalized_source_url", ["normalized_source_url"]),
});
