import { api } from "@/convex/_generated/api";
import { convex } from "@/lib/convex/client";

import {
  EMPTY_ONBOARDING_ANSWERS,
  getCachedProfile,
  setCachedProfile,
  type OnboardingAnswers,
} from "./answers";
import { buildProfileFields, mapProfileFields, type ProfileFields } from "./profile-fields";

/**
 * Saves the given profile fields for the signed-in user and leaves every other
 * field as it is. The device copy, kept per user, is updated as well.
 */
export async function saveOnboardingProfile(
  userId: string,
  fields: Partial<OnboardingAnswers>
): Promise<void> {
  await convex.mutation(api.profiles.save, { fields: buildProfileFields(fields) });

  const cached = (await getCachedProfile(userId)) ?? EMPTY_ONBOARDING_ANSWERS;
  await setCachedProfile(userId, { ...cached, ...fields });
}

/** The signed-in user's saved profile, or null before the first save. */
export async function getOnboardingProfile(
  userId: string
): Promise<OnboardingAnswers | null> {
  const stored = await convex.query(api.profiles.get, {});
  if (!stored) return null;

  const profile = mapProfileFields(stored as ProfileFields);
  await setCachedProfile(userId, profile);
  return profile;
}
