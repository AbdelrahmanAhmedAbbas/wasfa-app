import type { RecipeDetail } from "./client";
import { convertTemperature, type MeasurementSystem } from "./units.ts";

type RecipeIngredient = RecipeDetail["ingredients_json"][number];
type RecipeStep = RecipeDetail["steps_json"][number];

export function getEstimatedIngredientLabel(item: Pick<RecipeIngredient, "is_estimated">) {
  return item.is_estimated === true ? "Estimated" : null;
}

export function formatStepTemperature(temperature: RecipeStep["temperature"], measurementSystem: MeasurementSystem | null = null) {
  if (!temperature || typeof temperature.value !== "number" || !Number.isFinite(temperature.value)) {
    return null;
  }
  const converted = convertTemperature(temperature.value, temperature.unit, measurementSystem);
  return `${converted.value}°${converted.unit}`;
}

export function getSafeStepTitle(
  step: Pick<RecipeStep, "order" | "title" | "text">,
  index: number,
  fallback?: string
) {
  const title = step.title?.trim();
  if (title) return title;
  return fallback ?? `Step ${step.order || index + 1}`;
}

export function formatStepMetaItems(step: RecipeStep, measurementSystem: MeasurementSystem | null = null, minuteLabel = "min") {
  return [
    typeof step.duration_minutes === "number" && Number.isFinite(step.duration_minutes)
      ? `${Math.round(step.duration_minutes)} ${minuteLabel}`
      : null,
    formatStepTemperature(step.temperature, measurementSystem),
    step.equipment?.length ? step.equipment.join(", ") : null,
    step.ingredients_used?.length ? step.ingredients_used.join(", ") : null,
  ].filter((item): item is string => !!item);
}
