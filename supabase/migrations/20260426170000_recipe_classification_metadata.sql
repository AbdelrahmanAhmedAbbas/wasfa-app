ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS cuisine text NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS meal_type text NOT NULL DEFAULT 'Meal';
