import type { TranslationKey } from "@/lib/i18n/translations";
import type { GlyphName } from "@/lib/theme/glyphs";

import type {
  AllergyOption,
  DietOption,
  DislikeOption,
  GoalOption,
  HouseholdSize,
  OnboardingAnswers,
  PainPoint,
} from "./answers";

// Screens inside app/(questionnaire), in flow order. The saved questionnaire
// step is an index into this list. Sign up and the paywall live in their own
// route groups and sit between "demo" and "ready".
export const STEP_ROUTES = ["language", "intro", "chat", "kitchen", "demo", "ready"] as const;

export type QuestionnaireRoute = (typeof STEP_ROUTES)[number];

export function getStepIndex(route: QuestionnaireRoute): number {
  return STEP_ROUTES.indexOf(route);
}

/** Route to resume at for a saved step, or null when the flow should start from the top. */
export function getResumeRoute(step: number): QuestionnaireRoute | null {
  if (!Number.isInteger(step) || step <= 0 || step >= STEP_ROUTES.length) {
    return null;
  }

  return STEP_ROUTES[step];
}

export type LaunchState = {
  signedIn: boolean;
  /** Setup has been finished on this device. */
  onboardingDone: boolean;
  questionnaireDone: boolean;
  questionnaireStep: number;
  paywallSeen: boolean;
};

export type LaunchRoute = QuestionnaireRoute | "login" | "paywall" | "app";

/**
 * The screen the app opens on, from what is saved on the device. Sign up is
 * never one of them: it is only reached by walking on from the demo.
 */
export function getLaunchRoute(state: LaunchState): LaunchRoute {
  const resume = getResumeRoute(state.questionnaireStep);

  if (state.signedIn) {
    if (state.onboardingDone) return "app";
    // A new account that signed in on the login screen answers the questions
    // afterwards, so it carries on from the screen it stopped at.
    if (!state.questionnaireDone) return resume ?? "language";
    return state.paywallSeen ? "ready" : "paywall";
  }

  // Someone has finished setting up on this device before, so they are
  // coming back (signed out, or an expired session), not signing up.
  if (state.onboardingDone) return "login";
  if (state.questionnaireDone) return "demo";
  // Setup needs an account, so without one it is never resumed.
  return resume === null || resume === "ready" ? "language" : resume;
}

type ChatOption<Id extends string> = {
  id: Id;
  labelKey: TranslationKey;
  icon: GlyphName;
};

export const GOAL_OPTIONS: ChatOption<GoalOption>[] = [
  { id: "save_social", labelKey: "qGoalSaveSocial", icon: "mobile-phone" },
  { id: "meal_plan", labelKey: "qGoalMealPlan", icon: "spiral-calendar" },
  { id: "eat_better", labelKey: "qGoalEatBetter", icon: "green-salad" },
  { id: "save_money", labelKey: "qGoalSaveMoney", icon: "money-bag" },
  { id: "family", labelKey: "qGoalFamily", icon: "house-with-garden" },
];

export const HOUSEHOLD_OPTIONS: (ChatOption<HouseholdSize> & { servings: number })[] = [
  { id: "one", labelKey: "obHouseOne", icon: "bust-in-silhouette", servings: 1 },
  { id: "two", labelKey: "obHouseTwo", icon: "busts-in-silhouette", servings: 2 },
  { id: "three_four", labelKey: "obHouseThreeFour", icon: "house", servings: 4 },
  { id: "five_plus", labelKey: "obHouseFivePlus", icon: "house-with-garden", servings: 5 },
];

// Each pain point carries the "fix" shown for it on the kitchen card.
export const PAIN_OPTIONS: (ChatOption<PainPoint> & {
  problemKey: TranslationKey;
  answerKey: TranslationKey;
})[] = [
  {
    id: "lost_recipes",
    labelKey: "qPainLostRecipes",
    icon: "bookmark",
    problemKey: "qSolutionLostRecipesProblem",
    answerKey: "obSolLostRecipes",
  },
  {
    id: "daily_decisions",
    labelKey: "qPainDailyDecisions",
    icon: "alarm-clock",
    problemKey: "qSolutionDailyProblem",
    answerKey: "obSolDaily",
  },
  {
    id: "grocery_waste",
    labelKey: "qPainGroceryWaste",
    icon: "wastebasket",
    problemKey: "qSolutionWasteProblem",
    answerKey: "obSolWaste",
  },
  {
    id: "picky_family",
    labelKey: "qPainPickyFamily",
    icon: "shallow-pan-of-food",
    problemKey: "qSolutionFamilyProblem",
    answerKey: "obSolFamily",
  },
  {
    id: "no_time",
    labelKey: "qPainNoTime",
    icon: "hourglass-done",
    problemKey: "qSolutionTimeProblem",
    answerKey: "obSolTime",
  },
];

export const DEFAULT_SOLUTION: { problemKey: TranslationKey; answerKey: TranslationKey } = {
  problemKey: "qSolutionDefaultProblem",
  answerKey: "obSolDefault",
};

// Diet chips use the photos in dietImages (keyed by id) instead of a glyph.
export const DIET_OPTIONS: { id: DietOption; labelKey: TranslationKey }[] = [
  { id: "halal", labelKey: "dietHalal" },
  { id: "omnivore", labelKey: "obDietOmnivore" },
  { id: "vegetarian", labelKey: "dietVegetarian" },
  { id: "vegan", labelKey: "dietVegan" },
  { id: "keto", labelKey: "dietKeto" },
  { id: "pescatarian", labelKey: "obDietPescatarian" },
];

export const MAX_DIETS = 2;

export const ALLERGY_OPTIONS: ChatOption<AllergyOption>[] = [
  { id: "shellfish", labelKey: "obAllergyShellfish", icon: "shrimp" },
  { id: "seafood", labelKey: "obAllergySeafood", icon: "fish" },
  { id: "dairy", labelKey: "obAllergyDairy", icon: "glass-of-milk" },
  { id: "peanut", labelKey: "obAllergyPeanut", icon: "peanuts" },
  { id: "tree_nut", labelKey: "obAllergyTreeNut", icon: "chestnut" },
  { id: "egg", labelKey: "obAllergyEgg", icon: "egg" },
  { id: "gluten", labelKey: "obAllergyGluten", icon: "bread" },
  { id: "wheat", labelKey: "obAllergyWheat", icon: "sheaf-of-rice" },
];

export const DISLIKE_OPTIONS: ChatOption<DislikeOption>[] = [
  { id: "onion", labelKey: "dislikeOnion", icon: "onion" },
  { id: "garlic", labelKey: "dislikeGarlic", icon: "garlic" },
  { id: "mushroom", labelKey: "dislikeMushroom", icon: "mushroom" },
  { id: "eggplant", labelKey: "dislikeEggplant", icon: "eggplant" },
  { id: "cilantro", labelKey: "dislikeCilantro", icon: "herb" },
  { id: "olives", labelKey: "dislikeOlives", icon: "olive" },
  { id: "spicy", labelKey: "dislikeSpicy", icon: "hot-pepper" },
  { id: "okra", labelKey: "dislikeOkra", icon: "leafy-green" },
  { id: "liver", labelKey: "dislikeLiver", icon: "cut-of-meat" },
  { id: "fish", labelKey: "dislikeFish", icon: "fish" },
  { id: "coconut", labelKey: "dislikeCoconut", icon: "coconut" },
  { id: "raisins", labelKey: "dislikeRaisins", icon: "grapes" },
];

// Used wherever the household answer is missing (e.g. a resumed demo).
export const DEFAULT_HOUSEHOLD_SIZE: HouseholdSize = "three_four";

export function getHouseholdOption(size: HouseholdSize | null) {
  return (
    HOUSEHOLD_OPTIONS.find((option) => option.id === (size ?? DEFAULT_HOUSEHOLD_SIZE)) ??
    HOUSEHOLD_OPTIONS[2]
  );
}

/** Scales a demo ingredient amount to the household, rounded to the nearest quarter. */
export function scaleDemoQuantity(quantity: number, servings: number, baseServings: number): number {
  return Math.round(((quantity * servings) / baseServings) * 4) / 4;
}

export type ChatAnswers = Pick<
  OnboardingAnswers,
  "goal" | "householdSize" | "painPoints" | "diet" | "allergies" | "dislikes"
>;

/** The answers the chat collects, without the rest of the profile. */
export function pickChatAnswers(answers: ChatAnswers): ChatAnswers {
  return {
    goal: answers.goal,
    householdSize: answers.householdSize,
    painPoints: answers.painPoints,
    diet: answers.diet,
    allergies: answers.allergies,
    dislikes: answers.dislikes,
  };
}

/** False when the chat was skipped entirely (the "I already have an account" path). */
export function hasQuestionnaireAnswers(answers: ChatAnswers): boolean {
  return (
    answers.goal !== null ||
    answers.householdSize !== null ||
    answers.painPoints.length > 0 ||
    answers.diet.length > 0 ||
    answers.allergies.length > 0 ||
    answers.dislikes.length > 0
  );
}
