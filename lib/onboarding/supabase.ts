import { supabase } from "@/lib/supabase/client";
import {
  EMPTY_ONBOARDING_ANSWERS,
  getCachedProfile,
  setCachedProfile,
  type OnboardingAnswers,
} from "./answers";
import {
  buildOnboardingProfilePayload,
  getMissingOnboardingProfileColumn,
  mapOnboardingProfileRow,
  type OnboardingProfileColumn,
} from "./supabase-compat";

/**
 * Saves the given profile fields for the user and leaves every other field as
 * it is. The device copy is updated as well.
 */
export async function saveOnboardingProfile(
  userId: string,
  fields: Partial<OnboardingAnswers>
): Promise<void> {
  const omitted: OnboardingProfileColumn[] = [];

  for (;;) {
    const { error } = await supabase
      .from("onboarding_profiles")
      .upsert(buildOnboardingProfilePayload(userId, fields, omitted));

    if (!error) break;

    const missingColumn = getMissingOnboardingProfileColumn(error);
    if (!missingColumn || omitted.includes(missingColumn)) throw error;
    omitted.push(missingColumn);
  }

  const cached = (await getCachedProfile(userId)) ?? EMPTY_ONBOARDING_ANSWERS;
  await setCachedProfile(userId, { ...cached, ...fields });
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

  const cached = (await getCachedProfile(userId)) ?? EMPTY_ONBOARDING_ANSWERS;
  const profile = mapOnboardingProfileRow(data, cached);
  await setCachedProfile(userId, profile);
  return profile;
}
