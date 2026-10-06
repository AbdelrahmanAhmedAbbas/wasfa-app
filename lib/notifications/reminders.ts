import AsyncStorage from "@react-native-async-storage/async-storage";

import { t, type AppLanguage, type TranslationKey } from "@/lib/i18n/translations";

import { Notifications, REMINDERS_CHANNEL, getNotificationPermission } from "./native";
import { getReminderDates, getReminderMessageIndex } from "./reminderSchedule";
import { DAILY_REMINDER_TYPE } from "./targets";

const REMINDER_ENABLED_KEY = "@wasfa/daily_reminder";
const REMINDER_ID_PREFIX = "daily-reminder-";

const REMINDER_MESSAGES: { title: TranslationKey; body: TranslationKey }[] = [
  { title: "reminderPlanWeekTitle", body: "reminderPlanWeekBody" },
  { title: "reminderGroceryTitle", body: "reminderGroceryBody" },
  { title: "reminderSavedRecipeTitle", body: "reminderSavedRecipeBody" },
  { title: "reminderTomorrowTitle", body: "reminderTomorrowBody" },
];

/** Whether the user wants the daily reminder. On until they turn it off in their profile. */
export async function getDailyReminderEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(REMINDER_ENABLED_KEY)) !== "off";
  } catch {
    return true;
  }
}

export async function setDailyReminderEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(REMINDER_ENABLED_KEY, enabled ? "on" : "off");
}

async function cancelScheduledReminders(): Promise<void> {
  const module = Notifications;
  if (!module) return;
  const scheduled = await module.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(REMINDER_ID_PREFIX))
      .map((request) => module.cancelScheduledNotificationAsync(request.identifier))
  );
}

async function scheduleReminders(language: AppLanguage): Promise<void> {
  const module = Notifications;
  if (!module) return;
  await cancelScheduledReminders();
  if (!(await getDailyReminderEnabled())) return;
  if ((await getNotificationPermission()) !== "granted") return;

  const dates = getReminderDates(new Date());
  await Promise.all(
    dates.map((date, index) => {
      const message = REMINDER_MESSAGES[getReminderMessageIndex(date, REMINDER_MESSAGES.length)];
      return module.scheduleNotificationAsync({
        identifier: `${REMINDER_ID_PREFIX}${index}`,
        content: {
          title: t(language, message.title),
          body: t(language, message.body),
          sound: true,
          data: { type: DAILY_REMINDER_TYPE },
        },
        trigger: {
          type: module.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: REMINDERS_CHANNEL,
        },
      });
    })
  );
}

// One change at a time: two of them interleaved could leave reminders that were meant to be cancelled.
let pending: Promise<void> = Promise.resolve();

function inTurn(change: () => Promise<void>): Promise<void> {
  pending = pending.then(change).catch(() => {
    // A reminder that could not be scheduled is laid out again the next time the app opens.
  });
  return pending;
}

/**
 * Lays out the coming days' reminders afresh, in the given language. Called whenever
 * the app is opened, which also pushes the next reminder to tomorrow. Leaves none when
 * the user has turned reminders off or has not allowed notifications.
 */
export function refreshDailyReminders(language: AppLanguage): Promise<void> {
  return inTurn(() => scheduleReminders(language));
}

/** Removes every reminder that is waiting, for a user who has signed out. */
export function cancelDailyReminders(): Promise<void> {
  return inTurn(cancelScheduledReminders);
}
