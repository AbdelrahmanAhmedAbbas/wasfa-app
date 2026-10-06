import type * as ExpoNotifications from "expo-notifications";
import { Platform } from "react-native";

function loadNotifications(): typeof ExpoNotifications | null {
  if (Platform.OS === "web") return null;
  try {
    return require("expo-notifications");
  } catch {
    return null;
  }
}

/**
 * The notifications module, or null where the app cannot notify: on the web, and in an
 * installed build made before notifications were added that received this code as an
 * update. Everything in this folder does nothing there.
 */
export const Notifications = loadNotifications();

// Android channels. The server names IMPORTS_CHANNEL when it sends an import result
// (convex/notifications.ts), and a notification for a channel that does not exist is dropped.
export const IMPORTS_CHANNEL = "imports";
export const REMINDERS_CHANNEL = "reminders";

export type NotificationPermission = "granted" | "denied" | "undetermined" | "unavailable";

function toPermission(status: ExpoNotifications.NotificationPermissionsStatus): NotificationPermission {
  if (status.granted) return "granted";
  return status.status === "undetermined" ? "undetermined" : "denied";
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!Notifications) return "unavailable";
  try {
    return toPermission(await Notifications.getPermissionsAsync());
  } catch {
    return "unavailable";
  }
}

/** Shows the system's permission prompt. It appears once; afterwards this returns the answer given. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!Notifications) return "unavailable";
  try {
    return toPermission(
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      })
    );
  } catch {
    return "unavailable";
  }
}

/**
 * Creates the Android channels, named as the user sees them in the system settings.
 * Android only shows its permission prompt once a channel exists.
 */
export async function prepareNotificationChannels(names: { imports: string; reminders: string }): Promise<void> {
  if (!Notifications || Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(IMPORTS_CHANNEL, {
      name: names.imports,
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL, {
      name: names.reminders,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch {
    // Without channels Android falls back to its default one for local reminders.
  }
}
