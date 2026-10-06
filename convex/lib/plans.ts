/**
 * What each plan allows. Every account is on the free plan until it is given another
 * one (see users.setPlan). A limit of null means there is no limit.
 */
export const PLANS = {
  free: { importsPerDay: 4 },
  premium: { importsPerDay: null },
} as const satisfies Record<string, { importsPerDay: number | null }>;

export type PlanName = keyof typeof PLANS;

export const DEFAULT_PLAN: PlanName = "free";

export const DAY_MS = 24 * 60 * 60 * 1000;

export type ImportAllowance = {
  plan: PlanName;
  /** Imports allowed in any 24 hours, or null when the plan has no limit. */
  limit: number | null;
  used: number;
  remaining: number | null;
  /** When the next import opens up. Null while there is still one left. */
  resetsAt: number | null;
};

/**
 * How much of a plan's daily imports are used. "Daily" is the 24 hours before `now`,
 * so the count never depends on the user's time zone. An import that failed gave the
 * user nothing and does not count.
 */
export function importAllowance(
  plan: PlanName,
  recentImports: { createdAt: number; status: string }[],
  now: number
): ImportAllowance {
  const limit = PLANS[plan].importsPerDay;
  const counted = recentImports
    .filter((job) => job.status !== "failed" && job.createdAt > now - DAY_MS && job.createdAt <= now)
    .map((job) => job.createdAt)
    .sort((a, b) => a - b);
  const used = counted.length;

  if (limit === null) return { plan, limit, used, remaining: null, resetsAt: null };
  if (used < limit) return { plan, limit, used, remaining: limit - used, resetsAt: null };
  // The next import opens up when enough of the oldest ones are a day old.
  return { plan, limit, used, remaining: 0, resetsAt: counted[used - limit] + DAY_MS };
}
