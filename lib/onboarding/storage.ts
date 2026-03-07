import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_DONE_KEY = "@meal_planner_onboarding_done";

export async function getOnboardingDone() {
  const value = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
  return value === "true";
}

export async function setOnboardingDone(done: boolean) {
  await AsyncStorage.setItem(ONBOARDING_DONE_KEY, done ? "true" : "false");
}

