-- Onboarding profiles table
-- Stores user onboarding preferences linked to their authenticated account

CREATE TABLE IF NOT EXISTS public.onboarding_profiles (
  user_id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  diet               text[]      NOT NULL DEFAULT '{}',
  allergies          text[]      NOT NULL DEFAULT '{}',
  referral_source    text        NULL,
  invite_code        text        NULL,
  age_range          text        NULL,
  measurement_system text        NULL,
  nutrition_display  text        NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own profile
CREATE POLICY "users_select_own_profile" ON public.onboarding_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_profile" ON public.onboarding_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_profile" ON public.onboarding_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Index on user_id (already indexed as primary key, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_onboarding_profiles_user_id ON public.onboarding_profiles(user_id);

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_onboarding_profiles_updated
  BEFORE UPDATE ON public.onboarding_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
