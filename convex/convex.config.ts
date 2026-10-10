import { defineApp } from "convex/server";
import { v } from "convex/values";

export default defineApp({
  env: {
    RESEND_API_KEY: v.optional(v.string()),
    RESEND_FROM_EMAIL: v.optional(v.string()),
  },
});
