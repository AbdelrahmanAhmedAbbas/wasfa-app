import { ConvexError, v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { requireUserId } from "./authz";
import { normalizeFeedback } from "./lib/feedback";

/** Shared, signed-in feedback board. Authors are intentionally anonymous to other users. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const posts = await ctx.db.query("feedback_posts").order("desc").take(100);
    return await Promise.all(posts.map(async (post) => {
      const vote = await ctx.db
        .query("feedback_votes")
        .withIndex("by_user_id_and_post_id", (q) => q.eq("user_id", userId).eq("post_id", post._id))
        .unique();
      return {
        id: post._id,
        kind: post.kind,
        title: post.title,
        detail: post.detail,
        status: post.status,
        voteCount: post.vote_count,
        voted: vote !== null,
        createdAt: post._creationTime,
      };
    }));
  },
});

export const submit = mutation({
  args: {
    kind: v.union(v.literal("bug"), v.literal("feature")),
    title: v.string(),
    detail: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const content = normalizeFeedback(args.title, args.detail);
    const latest = await ctx.db
      .query("feedback_posts")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .order("desc")
      .take(3);
    if (latest.length === 3 && latest[2]._creationTime > Date.now() - 24 * 60 * 60 * 1000) {
      throw new ConvexError({ code: "FEEDBACK_RATE_LIMIT", message: "You can post up to three posts per day." });
    }
    return await ctx.db.insert("feedback_posts", {
      user_id: userId,
      kind: args.kind,
      ...content,
      status: "open",
      vote_count: 0,
    });
  },
});

/** The unique user/post index and mutation transaction make quick repeated taps safe. */
export const toggleVote = mutation({
  args: { postId: v.id("feedback_posts") },
  handler: async (ctx, { postId }) => {
    const userId = await requireUserId(ctx);
    const post = await ctx.db.get("feedback_posts", postId);
    if (!post) throw new Error("Feedback post not found.");
    const existing = await ctx.db
      .query("feedback_votes")
      .withIndex("by_user_id_and_post_id", (q) => q.eq("user_id", userId).eq("post_id", postId))
      .unique();
    if (existing) {
      await ctx.db.delete("feedback_votes", existing._id);
      await ctx.db.patch("feedback_posts", postId, { vote_count: Math.max(0, post.vote_count - 1) });
      return false;
    }
    await ctx.db.insert("feedback_votes", { user_id: userId, post_id: postId });
    await ctx.db.patch("feedback_posts", postId, { vote_count: post.vote_count + 1 });
    return true;
  },
});

/** Operator-only status update from the Convex dashboard or CLI. */
export const setStatus = internalMutation({
  args: {
    postId: v.id("feedback_posts"),
    status: v.union(v.literal("open"), v.literal("planned"), v.literal("done")),
  },
  handler: async (ctx, { postId, status }) => {
    await ctx.db.patch("feedback_posts", postId, { status });
    return null;
  },
});
