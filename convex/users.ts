import { createAccount, getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { requireUserId } from "./authz";

const PURGE_BATCH = 200;

/** The signed-in user, or null when signed out. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get("users", userId);
    if (!user) return null;
    return {
      id: user._id,
      email: user.email ?? null,
      name: user.name ?? null,
      avatar_url: user.image ?? null,
    };
  },
});

/**
 * Deletes the signed-in user's account. Sign-in is revoked at once; the user's recipes,
 * lists and imports are then removed in batches.
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .take(PURGE_BATCH);
    for (const session of sessions) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .take(PURGE_BATCH);
      for (const token of tokens) await ctx.db.delete("authRefreshTokens", token._id);
      await ctx.db.delete("authSessions", session._id);
    }

    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .take(PURGE_BATCH);
    for (const account of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .take(PURGE_BATCH);
      for (const code of codes) await ctx.db.delete("authVerificationCodes", code._id);
      await ctx.db.delete("authAccounts", account._id);
    }

    await ctx.scheduler.runAfter(0, internal.users.purgeUserData, { userId });
    return null;
  },
});

/** Deletes one batch of an import job's records; true when the job itself is gone. */
async function purgeImportJob(ctx: MutationCtx, jobId: Id<"import_jobs">): Promise<boolean> {
  const events = await ctx.db
    .query("job_events")
    .withIndex("by_job_id", (q) => q.eq("job_id", jobId))
    .take(PURGE_BATCH);
  for (const event of events) await ctx.db.delete("job_events", event._id);
  if (events.length === PURGE_BATCH) return false;

  const drafts = await ctx.db
    .query("recipe_drafts")
    .withIndex("by_job_id", (q) => q.eq("job_id", jobId))
    .take(PURGE_BATCH);
  for (const draft of drafts) await ctx.db.delete("recipe_drafts", draft._id);

  await ctx.db.delete("import_jobs", jobId);
  return true;
}

/**
 * Removes everything a deleted account owned, one batch per run, and the user record
 * last. It reschedules itself until nothing is left.
 */
export const purgeUserData = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const again = async () => {
      await ctx.scheduler.runAfter(0, internal.users.purgeUserData, { userId });
      return null;
    };

    const items = await ctx.db
      .query("shopping_list_items")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .take(PURGE_BATCH);
    for (const item of items) await ctx.db.delete("shopping_list_items", item._id);
    if (items.length > 0) return await again();

    const recipes = await ctx.db
      .query("recipes")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .take(50);
    for (const recipe of recipes) await ctx.db.delete("recipes", recipe._id);
    if (recipes.length > 0) return await again();

    const folders = await ctx.db
      .query("recipe_folders")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .take(PURGE_BATCH);
    for (const folder of folders) await ctx.db.delete("recipe_folders", folder._id);
    if (folders.length > 0) return await again();

    const job = await ctx.db
      .query("import_jobs")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .first();
    if (job) {
      await purgeImportJob(ctx, job._id);
      return await again();
    }

    const profiles = await ctx.db
      .query("onboarding_profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .take(PURGE_BATCH);
    for (const profile of profiles) await ctx.db.delete("onboarding_profiles", profile._id);

    if (await ctx.db.get("users", userId)) await ctx.db.delete("users", userId);
    return null;
  },
});

/**
 * Creates an email and password account, for App Review and beta testers. Run it from
 * the command line: `npx convex run users:createPasswordAccount '{"email":"...","password":"..."}'`.
 */
export const createPasswordAccount = internalAction({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: normalizedEmail, secret: password },
      profile: { email: normalizedEmail },
    });
    return { user_id: user._id, email: normalizedEmail };
  },
});
