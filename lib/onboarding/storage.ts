import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_DONE_KEY = "@meal_planner_onboarding_done";
const ONBOARDING_STEP_KEY = "@meal_planner_onboarding_step";
const QUESTIONNAIRE_DONE_KEY = "@wasfa/questionnaire_done";
// v2: the step index now points into the redesigned route list (lib/onboarding/flow.ts),
// so indexes saved by the old 11-screen flow must not be resumed.
const QUESTIONNAIRE_STEP_KEY = "@wasfa/questionnaire_step_v2";
const PAYWALL_SEEN_KEY = "@wasfa/paywall_seen";

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

export async function getQuestionnaireComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(QUESTIONNAIRE_DONE_KEY);
  return value === "true";
}

export async function setQuestionnaireComplete(done: boolean): Promise<void> {
  await AsyncStorage.setItem(QUESTIONNAIRE_DONE_KEY, done ? "true" : "false");
}

export async function getQuestionnaireStep(): Promise<number> {
  const value = await AsyncStorage.getItem(QUESTIONNAIRE_STEP_KEY);
  if (!value) return 0;
  const step = parseInt(value, 10);
  return isNaN(step) ? 0 : step;
}

export async function setQuestionnaireStep(step: number): Promise<void> {
  await AsyncStorage.setItem(QUESTIONNAIRE_STEP_KEY, String(step));
}

export async function getPaywallSeen(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PAYWALL_SEEN_KEY);
  return value === "true";
}

export async function setPaywallSeen(seen: boolean): Promise<void> {
  await AsyncStorage.setItem(PAYWALL_SEEN_KEY, seen ? "true" : "false");
}
