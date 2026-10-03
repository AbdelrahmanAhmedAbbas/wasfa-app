import type { TranslationKey } from "@/lib/i18n/translations";

import type {
  AllergyOption,
  DietOption,
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

type ChatOption<Id extends string> = {
  id: Id;
  labelKey: TranslationKey;
  emoji: string;
};

export const GOAL_OPTIONS: ChatOption<GoalOption>[] = [
  { id: "save_social", labelKey: "qGoalSaveSocial", emoji: "📱" },
  { id: "meal_plan", labelKey: "qGoalMealPlan", emoji: "🗓️" },
  { id: "eat_better", labelKey: "qGoalEatBetter", emoji: "🥗" },
  { id: "save_money", labelKey: "qGoalSaveMoney", emoji: "💰" },
  { id: "family", labelKey: "qGoalFamily", emoji: "🏡" },
];

export const HOUSEHOLD_OPTIONS: (ChatOption<HouseholdSize> & { servings: number })[] = [
  { id: "one", labelKey: "obHouseOne", emoji: "👤", servings: 1 },
  { id: "two", labelKey: "obHouseTwo", emoji: "👥", servings: 2 },
  { id: "three_four", labelKey: "obHouseThreeFour", emoji: "🏠", servings: 4 },
  { id: "five_plus", labelKey: "obHouseFivePlus", emoji: "🏡", servings: 5 },
];

// Each pain point carries the "fix" shown for it on the kitchen card.
export const PAIN_OPTIONS: (ChatOption<PainPoint> & {
  problemKey: TranslationKey;
  answerKey: TranslationKey;
})[] = [
  {
    id: "lost_recipes",
    labelKey: "qPainLostRecipes",
    emoji: "🔖",
    problemKey: "qSolutionLostRecipesProblem",
    answerKey: "obSolLostRecipes",
  },
  {
    id: "daily_decisions",
    labelKey: "qPainDailyDecisions",
    emoji: "⏰",
    problemKey: "qSolutionDailyProblem",
    answerKey: "obSolDaily",
  },
  {
    id: "grocery_waste",
    labelKey: "qPainGroceryWaste",
    emoji: "🗑️",
    problemKey: "qSolutionWasteProblem",
    answerKey: "obSolWaste",
  },
  {
    id: "picky_family",
    labelKey: "qPainPickyFamily",
    emoji: "🥘",
    problemKey: "qSolutionFamilyProblem",
    answerKey: "obSolFamily",
  },
  {
    id: "no_time",
    labelKey: "qPainNoTime",
    emoji: "⌛",
    problemKey: "qSolutionTimeProblem",
    answerKey: "obSolTime",
  },
];

export const DEFAULT_SOLUTION: { problemKey: TranslationKey; answerKey: TranslationKey } = {
  problemKey: "qSolutionDefaultProblem",
  answerKey: "obSolDefault",
};

// Diet chips use the photos in dietImages (keyed by id) instead of an emoji.
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
  { id: "shellfish", labelKey: "obAllergyShellfish", emoji: "🦐" },
  { id: "seafood", labelKey: "obAllergySeafood", emoji: "🐟" },
  { id: "dairy", labelKey: "obAllergyDairy", emoji: "🥛" },
  { id: "peanut", labelKey: "obAllergyPeanut", emoji: "🥜" },
  { id: "tree_nut", labelKey: "obAllergyTreeNut", emoji: "🌰" },
  { id: "egg", labelKey: "obAllergyEgg", emoji: "🥚" },
  { id: "gluten", labelKey: "obAllergyGluten", emoji: "🍞" },
  { id: "wheat", labelKey: "obAllergyWheat", emoji: "🌾" },
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

/** False when the chat was skipped entirely (the "I already have an account" path). */
export function hasQuestionnaireAnswers(
  answers: Pick<OnboardingAnswers, "goal" | "householdSize" | "painPoints" | "diet" | "allergies">
): boolean {
  return (
    answers.goal !== null ||
    answers.householdSize !== null ||
    answers.painPoints.length > 0 ||
    answers.diet.length > 0 ||
    answers.allergies.length > 0
  );
}
