import type { OnboardingAnswers } from "./answers";

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
};

type OnboardingProfilePayload = {
  user_id: string;
  diet: OnboardingAnswers["diet"];
  allergies: OnboardingAnswers["allergies"];
  referral_source: OnboardingAnswers["referralSource"];
  invite_code: OnboardingAnswers["inviteCode"];
  age_range: OnboardingAnswers["ageRange"];
  measurement_system: OnboardingAnswers["measurementSystem"];
  nutrition_display: OnboardingAnswers["nutritionDisplay"];
  goal?: OnboardingAnswers["goal"];
  pain_points?: OnboardingAnswers["painPoints"];
};

export function buildOnboardingProfilePayload(
  userId: string,
  answers: OnboardingAnswers,
  includeQuestionnaireFields = true
): OnboardingProfilePayload {
  const payload: OnboardingProfilePayload = {
    user_id: userId,
    diet: answers.diet,
    allergies: answers.allergies,
    referral_source: answers.referralSource,
    invite_code: answers.inviteCode,
    age_range: answers.ageRange,
    measurement_system: answers.measurementSystem,
    nutrition_display: answers.nutritionDisplay,
  };

  if (includeQuestionnaireFields) {
    payload.goal = answers.goal;
    payload.pain_points = answers.painPoints;
  }

  return payload;
}

export function shouldRetryLegacyOnboardingProfileUpsert(error: SupabaseLikeError): boolean {
  if (error.code !== "PGRST204") {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  if (!message.includes("onboarding_profiles")) {
    return false;
  }

  return message.includes("'goal'") || message.includes("'pain_points'");
}
