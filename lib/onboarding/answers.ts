import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_ANSWERS_KEY = "@meal_planner_onboarding_answers";

export type DietOption = "halal" | "omnivore" | "vegetarian" | "vegan" | "keto" | "pescatarian";
export type AllergyOption = "shellfish" | "seafood" | "dairy" | "peanut" | "tree_nut" | "egg" | "gluten" | "wheat";
export type GoalOption = "save_social" | "meal_plan" | "eat_better" | "save_money" | "family";
export type PainPoint = "lost_recipes" | "daily_decisions" | "grocery_waste" | "picky_family" | "no_time";
export type HouseholdSize = "one" | "two" | "three_four" | "five_plus";
export type ReferralSource = "invite_code" | "instagram" | "facebook" | "app_store" | "tiktok" | "friend";
export type AgeRange = "<18" | "18-25" | "25-30" | "30-35" | "35-40" | "40+";
export type MeasurementSystem = "imperial" | "metric";
export type NutritionDisplay = "show" | "hide";

export type OnboardingAnswers = {
  goal: GoalOption | null;
  // Local-only: onboarding_profiles has no column for it, so it is never sent to Supabase.
  householdSize: HouseholdSize | null;
  painPoints: PainPoint[];
  diet: DietOption[];
  allergies: AllergyOption[];
  referralSource: ReferralSource | null;
  inviteCode: string | null;
  ageRange: AgeRange | null;
  measurementSystem: MeasurementSystem | null;
  nutritionDisplay: NutritionDisplay | null;
};

export const EMPTY_ONBOARDING_ANSWERS: OnboardingAnswers = {
  goal: null,
  householdSize: null,
  painPoints: [],
  diet: [],
  allergies: [],
  referralSource: null,
  inviteCode: null,
  ageRange: null,
  measurementSystem: null,
  nutritionDisplay: null,
};

export async function getOnboardingAnswers(): Promise<OnboardingAnswers> {
  const value = await AsyncStorage.getItem(ONBOARDING_ANSWERS_KEY);

  if (!value) {
    return EMPTY_ONBOARDING_ANSWERS;
  }

  try {
    return { ...EMPTY_ONBOARDING_ANSWERS, ...JSON.parse(value) } as OnboardingAnswers;
  } catch {
    return EMPTY_ONBOARDING_ANSWERS;
  }
}

export async function saveOnboardingAnswers(partial: Partial<OnboardingAnswers>): Promise<void> {
  const existing = await getOnboardingAnswers();
  await AsyncStorage.setItem(ONBOARDING_ANSWERS_KEY, JSON.stringify({ ...existing, ...partial }));
}

export async function clearOnboardingAnswers(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_ANSWERS_KEY);
}
