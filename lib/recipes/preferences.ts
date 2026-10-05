import {
  EMPTY_ONBOARDING_ANSWERS,
  getCachedProfile,
  getOnboardingAnswers,
  saveOnboardingAnswers,
  type OnboardingAnswers,
} from "@/lib/onboarding/answers";
import { getOnboardingProfile, saveOnboardingProfile } from "@/lib/onboarding/profile";

// Everything the user can change from settings.
export type RecipePreferences = Pick<
  OnboardingAnswers,
  | "goal"
  | "householdSize"
  | "painPoints"
  | "diet"
  | "allergies"
  | "dislikes"
  | "measurementSystem"
  | "nutritionDisplay"
>;

export function pickRecipePreferences(answers: OnboardingAnswers): RecipePreferences {
  return {
    goal: answers.goal,
    householdSize: answers.householdSize,
    painPoints: answers.painPoints,
    diet: answers.diet,
    allergies: answers.allergies,
    dislikes: answers.dislikes,
    measurementSystem: answers.measurementSystem,
    nutritionDisplay: answers.nutritionDisplay,
  };
}

export const EMPTY_RECIPE_PREFERENCES: RecipePreferences = pickRecipePreferences(EMPTY_ONBOARDING_ANSWERS);

export async function loadRecipePreferences(userId?: string | null): Promise<RecipePreferences> {
  if (!userId) return pickRecipePreferences(await getOnboardingAnswers());

  try {
    const profile = await getOnboardingProfile(userId);
    if (profile) return pickRecipePreferences(profile);
  } catch {
    // Offline or a failed request: fall back to the copy saved on the device.
  }

  return pickRecipePreferences((await getCachedProfile(userId)) ?? EMPTY_ONBOARDING_ANSWERS);
}

/** Saves only the given preferences; the rest of the profile is left alone. */
export async function saveRecipePreferences(
  partial: Partial<RecipePreferences>,
  userId?: string | null
): Promise<void> {
  if (userId) {
    await saveOnboardingProfile(userId, partial);
  } else {
    await saveOnboardingAnswers(partial);
  }
}
