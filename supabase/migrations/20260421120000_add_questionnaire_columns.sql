ALTER TABLE public.onboarding_profiles
  ADD COLUMN IF NOT EXISTS goal text NULL,
  ADD COLUMN IF NOT EXISTS pain_points text[] NOT NULL DEFAULT '{}';
