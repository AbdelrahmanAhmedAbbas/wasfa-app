// What a notification carries in its data, and where tapping it leads.

export const IMPORT_FINISHED_TYPE = "import_finished";
export const DAILY_REMINDER_TYPE = "daily_reminder";

export type NotificationTarget =
  | { kind: "recipe"; recipeId: string }
  | { kind: "planner" }
  | { kind: "home" };

type NotificationData = Record<string, unknown> | null | undefined;

/** The import a notification reports on, or null for any other notification. */
export function getFinishedImportJobId(data: NotificationData): string | null {
  if (data?.type !== IMPORT_FINISHED_TYPE) return null;
  return typeof data.jobId === "string" ? data.jobId : null;
}

/**
 * The screen a tapped notification opens: the saved recipe, the planner for a
 * reminder, and the library for an import that failed or anything unrecognised.
 */
export function getNotificationTarget(data: NotificationData): NotificationTarget {
  if (data?.type === IMPORT_FINISHED_TYPE && typeof data.recipeId === "string" && data.recipeId) {
    return { kind: "recipe", recipeId: data.recipeId };
  }
  if (data?.type === DAILY_REMINDER_TYPE) return { kind: "planner" };
  return { kind: "home" };
}
