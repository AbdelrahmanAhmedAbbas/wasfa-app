import Google from "@auth/core/providers/google";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth, createAccount } from "@convex-dev/auth/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

import type { DataModel } from "./_generated/dataModel";

// Where the app is reopened after Google sign-in. Any other destination is refused.
const APP_REDIRECT_URL = "mealplanner://auth/callback";

// Apple issues its sign-in token to the app's iOS bundle identifier.
const APPLE_AUDIENCE = "com.abdelrahmanahmed.mealplanner";
const appleKeys = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    // Without this prompt Google silently reuses the account already signed in to the
    // browser, so nobody could switch to a different email.
    Google({ authorization: { params: { prompt: "select_account" } } }),
    // The iPhone's own Apple sign-in sheet hands the app a token signed by Apple; the
    // app sends it here with the nonce it asked Apple to sign into it.
    ConvexCredentials<DataModel>({
      id: "apple",
      authorize: async ({ identityToken, nonce, name }, ctx) => {
        if (typeof identityToken !== "string" || typeof nonce !== "string") {
          throw new Error("Apple sign-in did not send a token.");
        }
        const { payload } = await jwtVerify(identityToken, appleKeys, {
          issuer: "https://appleid.apple.com",
          audience: APPLE_AUDIENCE,
        });
        if (!payload.sub) throw new Error("Apple sign-in token has no user.");
        if (payload.nonce !== (await sha256Hex(nonce))) {
          throw new Error("Apple sign-in token was not issued for this request.");
        }

        const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : null;
        const emailVerified =
          email !== null && (payload.email_verified === true || payload.email_verified === "true");
        // Apple gives the name to the app only the first time someone signs in.
        const fullName = typeof name === "string" ? name.trim() : "";
        // Someone who already signed up with Google under the same email keeps one account.
        const { user } = await createAccount(ctx, {
          provider: "apple",
          account: { id: payload.sub },
          profile: {
            ...(email ? { email } : null),
            ...(emailVerified ? { emailVerificationTime: Date.now() } : null),
            ...(fullName ? { name: fullName } : null),
          },
          shouldLinkViaEmail: emailVerified,
        });
        return { userId: user._id };
      },
    }),
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
