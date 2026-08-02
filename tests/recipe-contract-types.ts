import type { IngredientItem, StepItem } from "../lib/import/types";
import type { RecipeDetail } from "../lib/recipes/client";

const importedIngredient: IngredientItem = {
  name: "flour",
  quantity: "2",
  unit: "cups",
  source: "ai_estimate",
  is_estimated: true,
};

const importedStep: StepItem = {
  order: 1,
  title: "Mix dry ingredients",
  text: "Whisk flour and salt together.",
  temperature: { value: 180, unit: "C" },
  equipment: ["mixing bowl"],
  ingredients_used: ["flour"],
  tips: ["Do not overmix."],
};

const recipeIngredient: RecipeDetail["ingredients_json"][number] = importedIngredient;
const recipeStep: RecipeDetail["steps_json"][number] = importedStep;

void recipeIngredient;
void recipeStep;
