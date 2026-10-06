/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authz from "../authz.js";
import type * as grocery from "../grocery.js";
import type * as http from "../http.js";
import type * as importPipeline from "../importPipeline.js";
import type * as imports from "../imports.js";
import type * as lib_ai from "../lib/ai.js";
import type * as lib_cache from "../lib/cache.js";
import type * as lib_groceryPrices from "../lib/groceryPrices.js";
import type * as lib_ingredientDetails from "../lib/ingredientDetails.js";
import type * as lib_mp4Audio from "../lib/mp4Audio.js";
import type * as lib_pipeline from "../lib/pipeline.js";
import type * as lib_pipelineErrors from "../lib/pipelineErrors.js";
import type * as lib_plans from "../lib/plans.js";
import type * as lib_pushMessages from "../lib/pushMessages.js";
import type * as lib_sanityCheck from "../lib/sanityCheck.js";
import type * as lib_stepRewriter from "../lib/stepRewriter.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_validation from "../lib/validation.js";
import type * as lib_youtube from "../lib/youtube.js";
import type * as notifications from "../notifications.js";
import type * as profiles from "../profiles.js";
import type * as recipeAi from "../recipeAi.js";
import type * as recipes from "../recipes.js";
import type * as shopping from "../shopping.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authz: typeof authz;
  grocery: typeof grocery;
  http: typeof http;
  importPipeline: typeof importPipeline;
  imports: typeof imports;
  "lib/ai": typeof lib_ai;
  "lib/cache": typeof lib_cache;
  "lib/groceryPrices": typeof lib_groceryPrices;
  "lib/ingredientDetails": typeof lib_ingredientDetails;
  "lib/mp4Audio": typeof lib_mp4Audio;
  "lib/pipeline": typeof lib_pipeline;
  "lib/pipelineErrors": typeof lib_pipelineErrors;
  "lib/plans": typeof lib_plans;
  "lib/pushMessages": typeof lib_pushMessages;
  "lib/sanityCheck": typeof lib_sanityCheck;
  "lib/stepRewriter": typeof lib_stepRewriter;
  "lib/types": typeof lib_types;
  "lib/validation": typeof lib_validation;
  "lib/youtube": typeof lib_youtube;
  notifications: typeof notifications;
  profiles: typeof profiles;
  recipeAi: typeof recipeAi;
  recipes: typeof recipes;
  shopping: typeof shopping;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
