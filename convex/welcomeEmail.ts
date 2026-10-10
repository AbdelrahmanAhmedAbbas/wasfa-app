import { v } from "convex/values";

import { internal } from "./_generated/api";
import { env, internalAction, internalQuery } from "./_generated/server";
import { welcomeEmail } from "./lib/welcomeEmail";

export const recipient = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get("users", userId);
    if (!user?.email) return null;
    return { email: user.email, name: user.name ?? null };
  },
});

/** Triggered once, when a newly signed-in user first saves an onboarding profile. */
export const send = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const apiKey = env.RESEND_API_KEY;
    const from = env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      console.warn("Wasfa welcome email skipped: Resend is not configured");
      return null;
    }
    const user = await ctx.runQuery(internal.welcomeEmail.recipient, { userId });
    if (!user) return null;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `wasfa-welcome:${userId}`,
      },
      body: JSON.stringify(welcomeEmail(user, from)),
    });
    if (!response.ok) throw new Error(`Resend welcome email failed with HTTP ${response.status}`);
    return null;
  },
});
