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
 * Where someone goes after signing in on the login screen. An account with no
 * saved profile is new, so this device runs the onboarding for it from the
 * first question; the sign-up step is skipped later because they are signed in.
 * An existing account goes to the opening screen, which sends it into the app.
 */
export async function getSignedInStart(userId: string): Promise<"/" | "/(questionnaire)/chat"> {
  const profile = await getOnboardingProfile(userId);

  if (profile === null) {
    // Progress left by another account on this device must not skip anything.
    await setOnboardingDone(false);
    await setQuestionnaireComplete(false);
    await setPaywallSeen(false);
    await setQuestionnaireStep(getStepIndex("chat"));
    return "/(questionnaire)/chat";
  }

  // On a device that has not been set up, the opening screen resumes at the
  // saved step: point it at setup rather than at questions already answered.
  if (!(await getOnboardingDone())) {
    await setQuestionnaireStep(getStepIndex("ready"));
  }
  return "/";
}
