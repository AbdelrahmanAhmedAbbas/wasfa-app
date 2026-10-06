import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import { getCurrentUserId } from "@/lib/auth/session";

import { EMPTY_MEAL_PLAN, normalizeMealPlan, type MealPlan } from "./plan";

// The meal plan is stored on-device only; there is no meal-plan table yet.
// Each account keeps its own plan, so switching accounts never shows (or
// prunes) someone else's.
const MEAL_PLAN_KEY = "@wasfa/meal_plan";

type PlanState = {
  plan: MealPlan;
  loaded: boolean;
  /**
   * True once a plan has been read from or saved to this device. False on a
   * fresh install, where an empty plan means "not known", not "nothing planned".
   */
  stored: boolean;
};

const listeners = new Set<(plan: MealPlan) => void>();

async function getMealPlanKey(): Promise<string | null> {
  const userId = getCurrentUserId();
  return userId ? `${MEAL_PLAN_KEY}/${userId}` : null;
}

/**
 * The plan saved on this device, or null when there is none to read: nobody is
 * signed in, this account has never saved a plan here, or the read failed.
 */
async function readStoredMealPlan(): Promise<MealPlan | null> {
  try {
    const key = await getMealPlanKey();
    if (!key) return null;

    const value = await AsyncStorage.getItem(key);
    if (value) return normalizeMealPlan(JSON.parse(value));

    // A plan saved before plans were per-account moves to the first account
    // that opens it.
    const legacy = await AsyncStorage.getItem(MEAL_PLAN_KEY);
    if (!legacy) return null;
    await AsyncStorage.setItem(key, legacy);
    await AsyncStorage.removeItem(MEAL_PLAN_KEY);
    return normalizeMealPlan(JSON.parse(legacy));
  } catch {
    return null;
  }
}

export async function getMealPlan(): Promise<MealPlan> {
  return (await readStoredMealPlan()) ?? EMPTY_MEAL_PLAN;
}

export async function saveMealPlan(plan: MealPlan): Promise<void> {
  const key = await getMealPlanKey();
  if (!key) throw new Error("Sign in is required to save the meal plan.");
  await AsyncStorage.setItem(key, JSON.stringify(plan));
  listeners.forEach((listener) => listener(plan));
}

/** Removes the signed-in account's plan from this device (account deletion). */
export async function clearMealPlan(): Promise<void> {
  const key = await getMealPlanKey();
  if (key) await AsyncStorage.removeItem(key);
}

/**
 * Shared meal plan state. Every mounted screen using this hook sees updates
 * made by any other (e.g. "Add to plan" on a recipe updates the planner tab).
 */
export function useMealPlan() {
  const [state, setState] = useState<PlanState>({
    plan: EMPTY_MEAL_PLAN,
    loaded: false,
    stored: false,
  });

  useEffect(() => {
    let isMounted = true;
    // A save always wins over the first read, whichever finishes last.
    let saved = false;
    const onSaved = (plan: MealPlan) => {
      saved = true;
      setState({ plan, loaded: true, stored: true });
    };
    listeners.add(onSaved);

    void readStoredMealPlan().then((stored) => {
      if (!isMounted || saved) return;
      setState({ plan: stored ?? EMPTY_MEAL_PLAN, loaded: true, stored: stored !== null });
    });

    return () => {
      isMounted = false;
      listeners.delete(onSaved);
    };
  }, []);

  const updatePlan = useCallback(async (update: (current: MealPlan) => MealPlan) => {
    const next = update(await getMealPlan());
    await saveMealPlan(next);
    return next;
  }, []);

  return { ...state, updatePlan };
}
