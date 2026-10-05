import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireUserId } from "./authz";
import { profileFields } from "./schema";

/** The signed-in user's saved profile answers, or null before the first save. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const profile = await ctx.db
      .query("onboarding_profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .unique();
    if (!profile) return null;
    const { _id, _creationTime, user_id, ...fields } = profile;
    return fields;
  },
});

/** Saves the given answers and leaves every other answer as it is. */
export const save = mutation({
  args: { fields: v.object(profileFields) },
  handler: async (ctx, { fields }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("onboarding_profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .unique();
    if (existing) {
      await ctx.db.patch("onboarding_profiles", existing._id, fields);
    } else {
      await ctx.db.insert("onboarding_profiles", { user_id: userId, ...fields });
    }
    return null;
  },
});
