import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

// Where the app is reopened after Google sign-in. Any other destination is refused.
const APP_REDIRECT_URL = "mealplanner://auth/callback";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    // Without this prompt Google silently reuses the account already signed in to the
    // browser, so nobody could switch to a different email.
    Google({ authorization: { params: { prompt: "select_account" } } }),
    // Email accounts are created by us for App Review and beta testers (see
    // users.createPasswordAccount), so the app can sign in but never sign up.
    Password({
      profile(params) {
        if (params.flow !== "signIn") throw new Error("Email sign-up is not available.");
        if (typeof params.email !== "string" || !params.email.trim()) throw new Error("Email is required.");
        return { email: params.email.trim().toLowerCase() };
      },
    }),
  ],
  callbacks: {
    async redirect({ redirectTo }) {
      if (redirectTo !== APP_REDIRECT_URL) throw new Error(`Invalid redirectTo ${redirectTo}`);
      return redirectTo;
    },
  },
});
