import test from "node:test";
import assert from "node:assert/strict";

import {
  ALLERGY_OPTIONS,
  DIET_OPTIONS,
  DISLIKE_OPTIONS,
  getHouseholdOption,
  getLaunchRoute,
  getResumeRoute,
  getStepIndex,
  GOAL_OPTIONS,
  hasQuestionnaireAnswers,
  HOUSEHOLD_OPTIONS,
  PAIN_OPTIONS,
  pickChatAnswers,
  scaleDemoQuantity,
  STEP_ROUTES,
} from "./flow.ts";

test("questionnaire steps follow the redesigned flow order", () => {
  assert.deepEqual([...STEP_ROUTES], ["language", "intro", "chat", "kitchen", "demo", "ready"]);
  assert.equal(getStepIndex("kitchen"), 3);
});

test("resume ignores the first step and out-of-range saved steps", () => {
  assert.equal(getResumeRoute(0), null);
  assert.equal(getResumeRoute(2), "chat");
  assert.equal(getResumeRoute(5), "ready");
  assert.equal(getResumeRoute(6), null);
  assert.equal(getResumeRoute(-1), null);
  assert.equal(getResumeRoute(Number.NaN), null);
});

test("chat options keep the stored answer ids in design order", () => {
  assert.deepEqual(
    GOAL_OPTIONS.map((option) => option.id),
    ["save_social", "meal_plan", "eat_better", "save_money", "family"]
  );
  assert.deepEqual(
    HOUSEHOLD_OPTIONS.map((option) => option.id),
    ["one", "two", "three_four", "five_plus"]
  );
  assert.deepEqual(
    PAIN_OPTIONS.map((option) => option.id),
    ["lost_recipes", "daily_decisions", "grocery_waste", "picky_family", "no_time"]
  );
  assert.deepEqual(
    DIET_OPTIONS.map((option) => option.id),
    ["halal", "omnivore", "vegetarian", "vegan", "keto", "pescatarian"]
  );
  assert.deepEqual(
    ALLERGY_OPTIONS.map((option) => option.id),
    ["shellfish", "seafood", "dairy", "peanut", "tree_nut", "egg", "gluten", "wheat"]
  );
  assert.deepEqual(
    DISLIKE_OPTIONS.map((option) => option.id),
    [
      "onion",
      "garlic",
      "mushroom",
      "eggplant",
      "cilantro",
      "olives",
      "spicy",
      "okra",
      "liver",
      "fish",
      "coconut",
      "raisins",
    ]
  );
});

test("demo amounts scale with the household and round to quarters", () => {
  assert.equal(getHouseholdOption("one").servings, 1);
  assert.equal(getHouseholdOption("five_plus").servings, 5);
  assert.equal(getHouseholdOption(null).id, "three_four");

  assert.equal(scaleDemoQuantity(2, 4, 4), 2);
  assert.equal(scaleDemoQuantity(2, 1, 4), 0.5);
  assert.equal(scaleDemoQuantity(1, 5, 4), 1.25);
  assert.equal(scaleDemoQuantity(1, 2, 3), 0.75);
});

test("detects a skipped chat", () => {
  const empty = {
    goal: null,
    householdSize: null,
    painPoints: [],
    diet: [],
    allergies: [],
    dislikes: [],
  };

  assert.equal(hasQuestionnaireAnswers(empty), false);
  assert.equal(hasQuestionnaireAnswers({ ...empty, householdSize: "two" }), true);
  assert.equal(hasQuestionnaireAnswers({ ...empty, allergies: ["egg"] }), true);
  assert.equal(hasQuestionnaireAnswers({ ...empty, dislikes: ["okra"] }), true);
});

test("finishing onboarding writes the chat answers and nothing else", () => {
  const answers = {
    goal: "family",
    householdSize: "two",
    painPoints: ["no_time"],
    diet: ["halal"],
    allergies: ["egg"],
    dislikes: ["okra"],
    // Not asked in the chat: must not be sent, or it would wipe a saved setting.
    measurementSystem: null,
    nutritionDisplay: null,
    referralSource: null,
    inviteCode: null,
    ageRange: null,
  };

  assert.deepEqual(pickChatAnswers(answers), {
    goal: "family",
    householdSize: "two",
    painPoints: ["no_time"],
    diet: ["halal"],
    allergies: ["egg"],
    dislikes: ["okra"],
  });
});

const launch = (state) =>
  getLaunchRoute({
    signedIn: false,
    onboardingDone: false,
    questionnaireDone: false,
    questionnaireStep: 0,
    paywallSeen: false,
    ...state,
  });

test("a signed-out device opens on onboarding, the demo or login, never on sign up or setup", () => {
  assert.equal(launch({}), "language");
  assert.equal(launch({ questionnaireStep: getStepIndex("chat") }), "chat");
  // Answered the questions without signing in: sign up is one tap on from the demo.
  assert.equal(
    launch({ questionnaireDone: true, questionnaireStep: getStepIndex("ready") }),
    "demo"
  );
  // Set up before on this device, whatever else is saved.
  assert.equal(launch({ onboardingDone: true }), "login");
  assert.equal(
    launch({ onboardingDone: true, questionnaireStep: getStepIndex("ready") }),
    "login"
  );
  assert.equal(launch({ onboardingDone: true, questionnaireDone: true }), "login");
  // Setup needs an account.
  assert.equal(launch({ questionnaireStep: getStepIndex("ready") }), "language");
});

test("a signed-in account opens on the app, or on the onboarding screen it stopped at", () => {
  const signedIn = (state) => launch({ signedIn: true, ...state });

  assert.equal(signedIn({ onboardingDone: true }), "app");
  // A new account that signed in on the login screen.
  assert.equal(signedIn({}), "language");
  assert.equal(signedIn({ questionnaireStep: getStepIndex("intro") }), "intro");
  assert.equal(signedIn({ questionnaireStep: getStepIndex("kitchen") }), "kitchen");
  // An existing account on a device that has not been set up.
  assert.equal(signedIn({ questionnaireStep: getStepIndex("ready") }), "ready");
  assert.equal(signedIn({ questionnaireDone: true }), "paywall");
  assert.equal(signedIn({ questionnaireDone: true, paywallSeen: true }), "ready");
});
