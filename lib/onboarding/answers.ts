import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_ANSWERS_KEY = "@meal_planner_onboarding_answers";

export type ReligionPreference = "islam" | "none" | "other";
export type CookingFrequency = "rarely" | "sometimes" | "often";

export type OnboardingAnswers = {
  source?: string;
  goals?: string[];
  country?: string;
  religion?: ReligionPreference;
  family?: {
    adults: number;
    children: number;
    infants: number;
  };
  frequency?: CookingFrequency;
};

export async function getOnboardingAnswers(): Promise<OnboardingAnswers> {
  const value = await AsyncStorage.getItem(ONBOARDING_ANSWERS_KEY);

  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value) as OnboardingAnswers;
  } catch {
    return {};
  }
}

export async function saveOnboardingAnswers(partial: Partial<OnboardingAnswers>) {
  const existing = await getOnboardingAnswers();
  await AsyncStorage.setItem(ONBOARDING_ANSWERS_KEY, JSON.stringify({ ...existing, ...partial }));
}
