-- The chat onboarding also asks for household size and disliked ingredients.
ALTER TABLE public.onboarding_profiles
  ADD COLUMN IF NOT EXISTS household_size text NULL,
  ADD COLUMN IF NOT EXISTS dislikes text[] NOT NULL DEFAULT '{}';
