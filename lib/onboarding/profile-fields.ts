import type { OnboardingAnswers } from "./answers";

/** Profile answers as the server stores them. A field that was never saved is absent. */
export type ProfileFields = {
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

const STORED_NAME: Record<keyof OnboardingAnswers, keyof ProfileFields> = {
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

/**
 * Builds what to save from the given answers only, so saving one answer never
 * overwrites the others. A cleared answer (null or an empty list) is still saved.
 */
export function buildProfileFields(answers: Partial<OnboardingAnswers>): ProfileFields {
  const fields: Record<string, unknown> = {};

  for (const answer of Object.keys(STORED_NAME) as (keyof OnboardingAnswers)[]) {
    if (answers[answer] === undefined) continue;
    fields[STORED_NAME[answer]] = answers[answer];
  }

  return fields as ProfileFields;
}

/** Maps a stored profile to answers; anything never saved reads as unanswered. */
export function mapProfileFields(fields: ProfileFields): OnboardingAnswers {
  return {
    goal: fields.goal ?? null,
    householdSize: fields.household_size ?? null,
    painPoints: fields.pain_points ?? [],
    diet: fields.diet ?? [],
    allergies: fields.allergies ?? [],
    dislikes: fields.dislikes ?? [],
    referralSource: fields.referral_source ?? null,
    inviteCode: fields.invite_code ?? null,
    ageRange: fields.age_range ?? null,
    measurementSystem: fields.measurement_system ?? null,
    nutritionDisplay: fields.nutrition_display ?? null,
  };
}
