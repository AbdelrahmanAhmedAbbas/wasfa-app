// When the daily reminders fire and which message each one carries.

/** The hour of the day, on the phone's clock, a reminder is shown. */
export const REMINDER_HOUR = 17;
/** How many days ahead reminders are laid out. A user away longer than this stops being reminded. */
export const REMINDER_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The times of the coming reminders: one a day at the reminder hour, starting tomorrow.
 * They are laid out again each time the app is opened, so a day the app was used has none.
 */
export function getReminderDates(now: Date, days: number = REMINDER_DAYS, hour: number = REMINDER_HOUR): Date[] {
  const dates: Date[] = [];
  for (let offset = 1; offset <= days; offset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    date.setHours(hour, 0, 0, 0);
    dates.push(date);
  }
  return dates;
}

/**
 * Which of `messageCount` messages a day's reminder shows. It follows the calendar
 * day, so laying the reminders out again keeps each day's message and neighbours differ.
 */
export function getReminderMessageIndex(date: Date, messageCount: number): number {
  const localDay = Math.floor((date.getTime() - date.getTimezoneOffset() * 60 * 1000) / DAY_MS);
  return localDay % messageCount;
}
