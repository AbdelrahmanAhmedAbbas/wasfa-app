import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import { EMPTY_MEAL_PLAN, normalizeMealPlan, type MealPlan } from "./plan";

// The meal plan is stored on-device only; there is no meal-plan table yet.
const MEAL_PLAN_KEY = "@wasfa/meal_plan";

const listeners = new Set<(plan: MealPlan) => void>();

export async function getMealPlan(): Promise<MealPlan> {
  try {
    const value = await AsyncStorage.getItem(MEAL_PLAN_KEY);
    return value ? normalizeMealPlan(JSON.parse(value)) : EMPTY_MEAL_PLAN;
  } catch {
    return EMPTY_MEAL_PLAN;
  }
}

export async function saveMealPlan(plan: MealPlan): Promise<void> {
  await AsyncStorage.setItem(MEAL_PLAN_KEY, JSON.stringify(plan));
  listeners.forEach((listener) => listener(plan));
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
