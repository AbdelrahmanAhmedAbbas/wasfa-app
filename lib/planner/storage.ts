import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";

import { EMPTY_MEAL_PLAN, normalizeMealPlan, type MealPlan } from "./plan";

// The meal plan is stored on-device only; there is no meal-plan table yet.
// Each account keeps its own plan, so switching accounts never shows (or
// prunes) someone else's.
const MEAL_PLAN_KEY = "@wasfa/meal_plan";

const listeners = new Set<(plan: MealPlan) => void>();

async function getMealPlanKey(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  return userId ? `${MEAL_PLAN_KEY}/${userId}` : null;
}

export async function getMealPlan(): Promise<MealPlan> {
  try {
    const key = await getMealPlanKey();
    if (!key) return EMPTY_MEAL_PLAN;

    const value = await AsyncStorage.getItem(key);
    if (value) return normalizeMealPlan(JSON.parse(value));

    // A plan saved before plans were per-account moves to the first account
    // that opens it.
    const legacy = await AsyncStorage.getItem(MEAL_PLAN_KEY);
    if (!legacy) return EMPTY_MEAL_PLAN;
    await AsyncStorage.setItem(key, legacy);
    await AsyncStorage.removeItem(MEAL_PLAN_KEY);
    return normalizeMealPlan(JSON.parse(legacy));
  } catch {
    return EMPTY_MEAL_PLAN;
  }
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
  const [plan, setPlan] = useState<MealPlan>(EMPTY_MEAL_PLAN);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    listeners.add(setPlan);

    void getMealPlan().then((stored) => {
      if (!isMounted) return;
      setPlan(stored);
      setLoaded(true);
    });

    return () => {
      isMounted = false;
      listeners.delete(setPlan);
    };
  }, []);

  const updatePlan = useCallback(async (update: (current: MealPlan) => MealPlan) => {
    const next = update(await getMealPlan());
    await saveMealPlan(next);
    return next;
  }, []);

  return { plan, loaded, updatePlan };
}
