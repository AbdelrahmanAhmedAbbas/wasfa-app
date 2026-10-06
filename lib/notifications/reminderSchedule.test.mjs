import test from "node:test";
import assert from "node:assert/strict";

import { getReminderDates, getReminderMessageIndex } from "./reminderSchedule.ts";

test("lays out one reminder a day starting tomorrow", () => {
  const dates = getReminderDates(new Date(2026, 9, 6, 9, 30), 3, 17);
  assert.deepEqual(
    dates.map((date) => [date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]),
    [
      [9, 7, 17, 0],
      [9, 8, 17, 0],
      [9, 9, 17, 0],
    ]
  );
});

test("skips today even when the reminder hour is still ahead", () => {
  const [first] = getReminderDates(new Date(2026, 9, 6, 8, 0), 1, 17);
  assert.equal(first.getDate(), 7);
});

test("carries on across the end of a month", () => {
  const dates = getReminderDates(new Date(2026, 9, 30, 20, 0), 3, 17);
  assert.deepEqual(
    dates.map((date) => [date.getMonth(), date.getDate()]),
    [
      [9, 31],
      [10, 1],
      [10, 2],
    ]
  );
});

test("gives neighbouring days different messages and keeps a day's message", () => {
  const dates = getReminderDates(new Date(2026, 9, 6, 9, 30), 8, 17);
  const indexes = dates.map((date) => getReminderMessageIndex(date, 4));
  for (let i = 1; i < indexes.length; i++) assert.notEqual(indexes[i], indexes[i - 1]);
  assert.ok(indexes.every((index) => index >= 0 && index < 4));

  // Laid out again a day later, the same calendar days keep their messages.
  const later = getReminderDates(new Date(2026, 9, 7, 22, 0), 7, 17);
  assert.deepEqual(
    later.map((date) => getReminderMessageIndex(date, 4)),
    indexes.slice(1)
  );
});
