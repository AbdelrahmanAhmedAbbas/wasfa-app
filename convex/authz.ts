import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

/** The signed-in user's id. Every function that touches a user's data starts here. */
export async function requireUserId(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in is required." });
  return userId;
}
