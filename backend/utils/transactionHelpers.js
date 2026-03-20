function clampDayOfMonth(year, monthIndex, day) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(day, lastDay);
}

function toStartOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function toEndOfMonth(date) {
  // Last day of month at 23:59:59.999
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function parseMonthToBounds(monthStr) {
  // monthStr expected as YYYY-MM
  const [y, m] = String(monthStr).split("-").map((x) => Number(x));
  const dt = new Date(y, m - 1, 1);
  return { start: toStartOfMonth(dt), end: toEndOfMonth(dt) };
}

function addMonths(year, monthIndex, deltaMonths) {
  const dt = new Date(year, monthIndex + deltaMonths, 1);
  return { year: dt.getFullYear(), monthIndex: dt.getMonth() };
}

function monthKey(year, monthIndex) {
  const mm = String(monthIndex + 1).padStart(2, "0");
  return `${year}-${mm}`;
}

/**
 * Expand recurringMonthly templates into occurrences for a given date range.
 * Recurrence day-of-month is based on the template's `date` day.
 */
function materializeRecurringMonthly(template, rangeStart, rangeEnd) {
  const startDate = new Date(template.date);
  if (startDate > rangeEnd) return [];

  const occurrences = [];
  const day = startDate.getDate();
  const base = template?.toObject ? template.toObject() : template;

  // Start from the first month that could include an occurrence >= startDate.
  let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1, 0, 0, 0, 0);
  const lastMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1, 0, 0, 0, 0);

  while (cursor <= lastMonth) {
    const year = cursor.getFullYear();
    const monthIndex = cursor.getMonth();
    const clampedDay = clampDayOfMonth(year, monthIndex, day);
    const occurrenceDate = new Date(year, monthIndex, clampedDay, 12, 0, 0, 0);

    if (occurrenceDate >= startDate && occurrenceDate >= rangeStart && occurrenceDate <= rangeEnd) {
      occurrences.push({ ...base, date: occurrenceDate, isSynthetic: true });
    }

    cursor = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  }

  return occurrences;
}

function listMonthKeys(referenceDate, countMonths) {
  // Returns array of YYYY-MM keys ending at referenceDate's month.
  const keys = [];
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  for (let i = countMonths - 1; i >= 0; i -= 1) {
    const dt = new Date(end.getFullYear(), end.getMonth() - i, 1);
    keys.push(monthKey(dt.getFullYear(), dt.getMonth()));
  }
  return keys;
}

module.exports = {
  clampDayOfMonth,
  parseMonthToBounds,
  materializeRecurringMonthly,
  listMonthKeys,
};

