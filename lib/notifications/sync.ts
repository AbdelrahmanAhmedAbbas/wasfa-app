import type { AppLanguage } from "@/lib/i18n/translations";

import { registerDeviceForPush, unregisterDeviceForPush } from "./push";
import { cancelDailyReminders, refreshDailyReminders } from "./reminders";

/**
 * Brings this phone's notifications in line with the signed-in user: registers it for
 * import results and lays out the coming reminders. Safe to call often; it does
 * nothing until the user has allowed notifications.
 */
export async function syncNotifications(language: AppLanguage): Promise<void> {
  await Promise.all([registerDeviceForPush(language), refreshDailyReminders(language)]);
}

/** Leaves the phone with no notifications for the user who is signing out. */
export async function stopNotifications(): Promise<void> {
  await Promise.all([unregisterDeviceForPush(), cancelDailyReminders()]);
}
