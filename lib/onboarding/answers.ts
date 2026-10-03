import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_ANSWERS_KEY = "@meal_planner_onboarding_answers";
const PROFILE_CACHE_KEY = "@wasfa/profile_cache";

export type DietOption = "halal" | "omnivore" | "vegetarian" | "vegan" | "keto" | "pescatarian";
export type AllergyOption = "shellfish" | "seafood" | "dairy" | "peanut" | "tree_nut" | "egg" | "gluten" | "wheat";
export type DislikeOption =
  | "onion"
  | "garlic"
  | "mushroom"
  | "eggplant"
  | "cilantro"
  | "olives"
  | "spicy"
  | "okra"
  | "liver"
  | "fish"
  | "coconut"
  | "raisins";
export type GoalOption = "save_social" | "meal_plan" | "eat_better" | "save_money" | "family";
export type PainPoint = "lost_recipes" | "daily_decisions" | "grocery_waste" | "picky_family" | "no_time";
export type HouseholdSize = "one" | "two" | "three_four" | "five_plus";
export type ReferralSource = "invite_code" | "instagram" | "facebook" | "app_store" | "tiktok" | "friend";
export type AgeRange = "<18" | "18-25" | "25-30" | "30-35" | "35-40" | "40+";
export type MeasurementSystem = "imperial" | "metric";
export type NutritionDisplay = "show" | "hide";

export type OnboardingAnswers = {
  goal: GoalOption | null;
  householdSize: HouseholdSize | null;
  painPoints: PainPoint[];
  diet: DietOption[];
  allergies: AllergyOption[];
  // DislikeOption ids, plus any ingredient the user typed in themselves in settings.
  dislikes: string[];
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
  dislikes: [],
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

// The signed-in user's profile is mirrored on the device so preferences still
// apply offline, and so answers survive a database that is missing a column.
type ProfileCache = { userId: string; profile: OnboardingAnswers };

export async function getCachedProfile(userId: string): Promise<OnboardingAnswers | null> {
  const value = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
  if (!value) return null;

  try {
    const cache = JSON.parse(value) as ProfileCache;
    if (cache.userId !== userId) return null;
    return { ...EMPTY_ONBOARDING_ANSWERS, ...cache.profile };
  } catch {
    return null;
  }
}

export async function setCachedProfile(userId: string, profile: OnboardingAnswers): Promise<void> {
  const cache: ProfileCache = { userId, profile };
  await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache));
}

export async function clearCachedProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
}
