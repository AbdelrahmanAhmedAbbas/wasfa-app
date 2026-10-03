import type { OnboardingAnswers } from "./answers";

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
};

export type OnboardingProfileRow = {
  user_id: string;
  goal?: OnboardingAnswers["goal"];
  household_size?: OnboardingAnswers["householdSize"];
  pain_points?: OnboardingAnswers["painPoints"];
  diet?: OnboardingAnswers["diet"];
  allergies?: OnboardingAnswers["allergies"];
  dislikes?: OnboardingAnswers["dislikes"];
  referral_source?: OnboardingAnswers["referralSource"];
  invite_code?: OnboardingAnswers["inviteCode"];
  age_range?: OnboardingAnswers["ageRange"];
  measurement_system?: OnboardingAnswers["measurementSystem"];
  nutrition_display?: OnboardingAnswers["nutritionDisplay"];
};

export type OnboardingProfileColumn = Exclude<keyof OnboardingProfileRow, "user_id">;

const COLUMN_BY_FIELD: Record<keyof OnboardingAnswers, OnboardingProfileColumn> = {
  goal: "goal",
  householdSize: "household_size",
  painPoints: "pain_points",
  diet: "diet",
  allergies: "allergies",
  dislikes: "dislikes",
  referralSource: "referral_source",
  inviteCode: "invite_code",
  ageRange: "age_range",
  measurementSystem: "measurement_system",
  nutritionDisplay: "nutrition_display",
};

// Columns added after the table was created. A database that has not run the
// newer migrations yet rejects them, so a save can retry without them.
const OPTIONAL_COLUMNS: OnboardingProfileColumn[] = ["goal", "pain_points", "household_size", "dislikes"];

/**
 * Builds an upsert payload from the given fields only, so saving one answer
 * never overwrites the others.
 */
export function buildOnboardingProfilePayload(
  userId: string,
  fields: Partial<OnboardingAnswers>,
  omitColumns: readonly OnboardingProfileColumn[] = []
): OnboardingProfileRow {
  const payload: Record<string, unknown> = { user_id: userId };

  for (const field of Object.keys(COLUMN_BY_FIELD) as (keyof OnboardingAnswers)[]) {
    const column = COLUMN_BY_FIELD[field];
    if (fields[field] === undefined || omitColumns.includes(column)) continue;
    payload[column] = fields[field];
  }

  return payload as OnboardingProfileRow;
}

/** The optional column a failed save tripped over, or null for any other error. */
export function getMissingOnboardingProfileColumn(
  error: SupabaseLikeError
): OnboardingProfileColumn | null {
  if (error.code !== "PGRST204") return null;

  const message = error.message?.toLowerCase() ?? "";
  if (!message.includes("onboarding_profiles")) return null;

  return OPTIONAL_COLUMNS.find((column) => message.includes(`'${column}'`)) ?? null;
}

/**
 * Maps a profile row to answers. Columns the database does not have yet are
 * filled from `fallback` (the copy cached on the device).
 */
export function mapOnboardingProfileRow(
  row: Partial<OnboardingProfileRow>,
  fallback: OnboardingAnswers
): OnboardingAnswers {
  return {
    goal: "goal" in row ? row.goal ?? null : fallback.goal,
    householdSize: "household_size" in row ? row.household_size ?? null : fallback.householdSize,
    painPoints: "pain_points" in row ? row.pain_points ?? [] : fallback.painPoints,
    diet: row.diet ?? [],
    allergies: row.allergies ?? [],
    dislikes: "dislikes" in row ? row.dislikes ?? [] : fallback.dislikes,
    referralSource: row.referral_source ?? null,
    inviteCode: row.invite_code ?? null,
    ageRange: row.age_range ?? null,
    measurementSystem: row.measurement_system ?? null,
    nutritionDisplay: row.nutrition_display ?? null,
  };
}
