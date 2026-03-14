import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_DONE_KEY = "@meal_planner_onboarding_done";
const ONBOARDING_STEP_KEY = "@meal_planner_onboarding_step";

export async function getOnboardingDone() {
  const value = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
  return value === "true";
}

export async function setOnboardingDone(done: boolean) {
  await AsyncStorage.setItem(ONBOARDING_DONE_KEY, done ? "true" : "false");
}

export async function getOnboardingStep(): Promise<number> {
  const value = await AsyncStorage.getItem(ONBOARDING_STEP_KEY);
  if (!value) return 0;
  const step = parseInt(value, 10);
  return isNaN(step) ? 0 : step;
}

export async function setOnboardingStep(step: number): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_STEP_KEY, String(step));
}

export async function clearOnboardingStep(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_STEP_KEY);
}
