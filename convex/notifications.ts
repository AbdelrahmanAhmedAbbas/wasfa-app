import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { requireUserId } from "./authz";
import {
  importFinishedMessage,
  isExpoPushToken,
  unregisteredTokens,
  type ImportFinishedRecipe,
  type PushLanguage,
} from "./lib/pushMessages";
import { appLanguage, devicePlatform } from "./schema";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_DEVICES_PER_USER = 10;
// The Android channel the app creates for import results (lib/notifications/native.ts).
const IMPORTS_CHANNEL = "imports";

/**
 * Registers this phone to receive the signed-in user's notifications, written in the
 * given language. A phone belongs to whoever signed in on it last.
 */
export const registerDevice = mutation({
  args: { token: v.string(), platform: devicePlatform, language: appLanguage },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (!isExpoPushToken(args.token)) {
      throw new ConvexError({ code: "INVALID_PUSH_TOKEN", message: "This is not a push token." });
    }

    const [existing, ...duplicates] = await ctx.db
      .query("push_devices")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .take(5);
    for (const duplicate of duplicates) await ctx.db.delete("push_devices", duplicate._id);

    const fields = { user_id: userId, token: args.token, platform: args.platform, language: args.language };
    if (existing) {
      const unchanged =
        existing.user_id === userId && existing.platform === args.platform && existing.language === args.language;
      if (!unchanged) await ctx.db.replace("push_devices", existing._id, fields);
      return null;
    }

    // The oldest phone makes room once a user has more than a household's worth.
    const mine = await ctx.db
      .query("push_devices")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .take(MAX_DEVICES_PER_USER);
    if (mine.length >= MAX_DEVICES_PER_USER) await ctx.db.delete("push_devices", mine[0]._id);

    await ctx.db.insert("push_devices", fields);
    return null;
  },
});

/** Stops sending the signed-in user's notifications to this phone. Called when they sign out. */
export const unregisterDevice = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const userId = await requireUserId(ctx);
    const devices = await ctx.db
      .query("push_devices")
      .withIndex("by_token", (q) => q.eq("token", token))
      .take(5);
    for (const device of devices) {
      if (device.user_id === userId) await ctx.db.delete("push_devices", device._id);
    }
    return null;
  },
});

type ImportFinishedDetails = {
  recipe: (ImportFinishedRecipe & { id: Id<"recipes"> }) | null;
  devices: { token: string; language: PushLanguage }[];
};

/** Who to tell that an import is over, and the recipe it saved. Null when there is no one to tell. */
export const importFinishedDetails = internalQuery({
  args: { jobId: v.id("import_jobs") },
  handler: async (ctx, { jobId }): Promise<ImportFinishedDetails | null> => {
    const job = await ctx.db.get("import_jobs", jobId);
    if (!job || (job.status !== "confirmed" && job.status !== "failed")) return null;

    const devices = await ctx.db
      .query("push_devices")
      .withIndex("by_user_id", (q) => q.eq("user_id", job.user_id))
      .take(MAX_DEVICES_PER_USER);
    if (devices.length === 0) return null;

    const recipe =
      job.status === "confirmed"
        ? await ctx.db
            .query("recipes")
            .withIndex("by_draft_job_id", (q) => q.eq("draft_job_id", jobId))
            .unique()
        : null;

    return {
      recipe: recipe
        ? {
            id: recipe._id,
            title: recipe.title,
            titles: {
              en: recipe.localized_json.en?.title ?? null,
              ar: recipe.localized_json.ar?.title ?? null,
            },
          }
        : null,
      devices: devices.map((device) => ({ token: device.token, language: device.language })),
    };
  },
});

export const forgetDevices = internalMutation({
  args: { tokens: v.array(v.string()) },
  handler: async (ctx, { tokens }) => {
    for (const token of tokens) {
      const devices = await ctx.db
        .query("push_devices")
        .withIndex("by_token", (q) => q.eq("token", token))
        .take(5);
      for (const device of devices) await ctx.db.delete("push_devices", device._id);
    }
    return null;
  },
});

/**
 * Notifies the owner's phones that an import is over: the saved recipe by name, or that
 * it failed. Scheduled by the write that ends the job, so it is sent once per outcome.
 */
export const sendImportFinished = internalAction({
  args: { jobId: v.id("import_jobs") },
  handler: async (ctx, { jobId }) => {
    const details: ImportFinishedDetails | null = await ctx.runQuery(
      internal.notifications.importFinishedDetails,
      { jobId }
    );
    if (!details) return null;

    const tokens = details.devices.map((device) => device.token);
    const messages = details.devices.map((device) => ({
      to: device.token,
      ...importFinishedMessage({ language: device.language, recipe: details.recipe }),
      sound: "default",
      channelId: IMPORTS_CHANNEL,
      // What the app reads when the notification is tapped (lib/notifications/targets.ts).
      data: { type: "import_finished", jobId, recipeId: details.recipe?.id ?? null },
    }));

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(messages),
      });
      if (!response.ok) {
        console.error(`Push for import ${jobId} was refused: ${response.status} ${await response.text()}`);
        return null;
      }
      const gone = unregisteredTokens(tokens, await response.json());
      if (gone.length > 0) await ctx.runMutation(internal.notifications.forgetDevices, { tokens: gone });
    } catch (error) {
      // The recipe is saved either way; the user finds it in the library.
      console.error(`Push for import ${jobId} could not be sent: ${String(error)}`);
    }
    return null;
  },
});
