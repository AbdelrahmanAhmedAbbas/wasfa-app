import { clearOnboardingAnswers } from "./answers";
import { getStepIndex } from "./flow";
import { getOnboardingProfile } from "./profile";
import {
  getOnboardingDone,
  setOnboardingDone,
  setPaywallSeen,
  setQuestionnaireComplete,
  setQuestionnaireStep,
} from "./storage";

/**
 * Forgets the onboarding progress and answers saved on this device, so the
 * next run starts at the first screen and nothing left by someone else is
 * skipped or reused.
 */
export async function restartOnboarding(): Promise<void> {
  await setOnboardingDone(false);
  await setQuestionnaireComplete(false);
  await setPaywallSeen(false);
  await setQuestionnaireStep(getStepIndex("language"));
  await clearOnboardingAnswers();
}

/**
 * Where someone goes after signing in on the login screen. An account with no
 * saved profile is new, so this device runs the whole onboarding for it; the
 * sign-up step is skipped later because they are signed in. An existing
 * account goes to the opening screen, which sends it into the app.
 */
export async function getSignedInStart(
  userId: string
): Promise<"/" | "/(questionnaire)/language"> {
  const profile = await getOnboardingProfile(userId);

  if (profile === null) {
    await restartOnboarding();
    return "/(questionnaire)/language";
  }

  // On a device that has not been set up, the opening screen resumes at the
  // saved step: point it at setup rather than at questions already answered.
  if (!(await getOnboardingDone())) {
    await setQuestionnaireStep(getStepIndex("ready"));
  }
  return "/";
}

/**
 * Where someone goes after signing in on the sign-up screen. A new account
 * carries on to the offer. An account that already has a profile is coming
 * back: it keeps that profile, so the answers given on this device are dropped
 * and `returning` tells the screen to mark setup as finished.
 */
export async function getSignedUpStart(
  userId: string
): Promise<{ returning: boolean; start: "/" | "/(paywall)/offer" }> {
  const profile = await getOnboardingProfile(userId);
  if (profile === null) return { returning: false, start: "/(paywall)/offer" };

  await clearOnboardingAnswers();
  await setPaywallSeen(true);
  return { returning: true, start: "/" };
}
