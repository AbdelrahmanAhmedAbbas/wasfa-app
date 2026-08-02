import {
  EMPTY_ONBOARDING_ANSWERS,
  getOnboardingAnswers,
  saveOnboardingAnswers,
  type AllergyOption,
  type DietOption,
  type MeasurementSystem,
  type NutritionDisplay,
  type OnboardingAnswers,
} from "@/lib/onboarding/answers";
import { getOnboardingProfile, saveOnboardingProfile } from "@/lib/onboarding/supabase";

export type RecipePreferences = {
  diet: DietOption[];
  allergies: AllergyOption[];
  measurementSystem: MeasurementSystem | null;
  nutritionDisplay: NutritionDisplay | null;
};

export function pickRecipePreferences(answers: OnboardingAnswers): RecipePreferences {
  return {
    diet: answers.diet,
    allergies: answers.allergies,
    measurementSystem: answers.measurementSystem,
    nutritionDisplay: answers.nutritionDisplay,
  };
}

export async function loadRecipePreferences(userId?: string | null): Promise<RecipePreferences> {
  if (userId) {
    const profile = await getOnboardingProfile(userId);
    if (profile) return pickRecipePreferences(profile);
  }

  return pickRecipePreferences(await getOnboardingAnswers());
}

export async function saveRecipePreferences(
  partial: Partial<RecipePreferences>,
  userId?: string | null
): Promise<RecipePreferences> {
  const localAnswers = await getOnboardingAnswers();
  const existing = userId ? (await getOnboardingProfile(userId)) ?? localAnswers : localAnswers;
  const nextAnswers: OnboardingAnswers = {
    ...EMPTY_ONBOARDING_ANSWERS,
    ...existing,
    ...partial,
  };

  await saveOnboardingAnswers(partial);
  if (userId) {
    await saveOnboardingProfile(userId, nextAnswers);
  }

  return pickRecipePreferences(nextAnswers);
}
