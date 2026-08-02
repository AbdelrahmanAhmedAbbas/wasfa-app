import type { AllergyOption, DietOption } from "@/lib/onboarding/answers";

export type IngredientWarningInput = {
  name: string;
  dietary_flags?: string[];
  allergen_hints?: string[];
  is_halal?: boolean | null;
  halal_concern?: string;
  suggested_alternative?: string;
};

export type RecipePreferenceInput = {
  diet: DietOption[];
  allergies: AllergyOption[];
};

export type IngredientWarning = {
  kind: "allergy" | "halal" | "diet";
  tone: "danger" | "warning";
  label: string;
  detail?: string;
  suggestion?: string;
};

const allergyLabels: Record<AllergyOption, string> = {
  shellfish: "Shellfish allergy",
  seafood: "Seafood allergy",
  dairy: "Dairy allergy",
  peanut: "Peanut allergy",
  tree_nut: "Tree nut allergy",
  egg: "Egg allergy",
  gluten: "Gluten allergy",
  wheat: "Wheat allergy",
};

export function getIngredientWarnings(
  ingredient: IngredientWarningInput,
  preferences: RecipePreferenceInput
): IngredientWarning[] {
  const warnings: IngredientWarning[] = [];
  const allergenHints = new Set((ingredient.allergen_hints ?? []).map((hint) => hint.toLowerCase()));

  for (const allergy of preferences.allergies) {
    if (allergenHints.has(allergy)) {
      warnings.push({
        kind: "allergy",
        tone: "danger",
        label: allergyLabels[allergy],
      });
    }
  }

  if (preferences.diet.includes("halal") && ingredient.is_halal === false) {
    warnings.push({
      kind: "halal",
      tone: "danger",
      label: "Not halal",
      detail: ingredient.halal_concern,
      suggestion: ingredient.suggested_alternative,
    });
  }

  return warnings;
}
