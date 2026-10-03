// Date labels for the planner. Pure (Intl only) so it runs under `node --test`.

type PlannerLanguage = "en" | "ar";

// ar-EG keeps the Gregorian calendar with Arabic month names and Arabic-Indic digits.
function getLocale(language: PlannerLanguage) {
  return language === "ar" ? "ar-EG" : "en-US";
}

export function formatWeekdayLong(date: Date, language: PlannerLanguage): string {
  return new Intl.DateTimeFormat(getLocale(language), { weekday: "long" }).format(date);
}

export function formatWeekdayShort(date: Date, language: PlannerLanguage): string {
  return new Intl.DateTimeFormat(getLocale(language), { weekday: "short" }).format(date);
}

export function formatDayOfMonth(date: Date, language: PlannerLanguage): string {
  return new Intl.DateTimeFormat(getLocale(language), { day: "numeric" }).format(date);
}

/** e.g. "Sep 27 – Oct 3" for the first and last day of a week. */
export function formatWeekRange(week: Date[], language: PlannerLanguage): string {
  if (week.length === 0) return "";
  const formatter = new Intl.DateTimeFormat(getLocale(language), {
    month: language === "ar" ? "long" : "short",
    day: "numeric",
  });
  return `${formatter.format(week[0])} – ${formatter.format(week[week.length - 1])}`;
}
