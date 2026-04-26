import { supabase } from "@/lib/supabase/client";
import type { OnboardingAnswers } from "./answers";
import {
  buildOnboardingProfilePayload,
  shouldRetryLegacyOnboardingProfileUpsert,
} from "./supabase-compat";

export async function saveOnboardingProfile(
  userId: string,
  answers: OnboardingAnswers
): Promise<void> {
  const { error } = await supabase
    .from("onboarding_profiles")
    .upsert(buildOnboardingProfilePayload(userId, answers));

  if (!error) {
    return;
  }

  if (shouldRetryLegacyOnboardingProfileUpsert(error)) {
    const { error: legacyError } = await supabase
      .from("onboarding_profiles")
      .upsert(buildOnboardingProfilePayload(userId, answers, false));

    if (!legacyError) {
      return;
    }

    throw legacyError;
  }

  throw error;
}

export async function getOnboardingProfile(
  userId: string
): Promise<OnboardingAnswers | null> {
  const { data, error } = await supabase
    .from("onboarding_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    goal: data.goal,
    painPoints: data.pain_points || [],
    diet: data.diet || [],
    allergies: data.allergies || [],
    referralSource: data.referral_source,
    inviteCode: data.invite_code,
    ageRange: data.age_range,
    measurementSystem: data.measurement_system,
    nutritionDisplay: data.nutrition_display,
  };
}
