/**
 * Utility functions for managing target periods
 */

const TARGET_PERIOD_KEY = "coke_target_period";
const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_INDEX = MONTHS.reduce((acc, m, i) => {
  acc[m] = i;
  return acc;
}, {});

/**
 * Official target-closing calendar (shared by user) through 2029.
 * Value format:
 * - "29"  => closes on this target month's calendar month day 29
 * - "4/2" => closes on April 2 (same year row)
 */
const TARGET_CLOSING_CALENDAR = {
  2025: {
    JAN: "24", FEB: "21", MAR: "28", APR: "25", MAY: "23", JUN: "27",
    JUL: "25", AUG: "22", SEP: "26", OCT: "24", NOV: "21", DEC: "31",
  },
  2026: {
    JAN: "30", FEB: "27", MAR: "4/3", APR: "5/1", MAY: "29", JUN: "7/3",
    JUL: "31", AUG: "28", SEP: "10/2", OCT: "30", NOV: "27", DEC: "31",
  },
  2027: {
    JAN: "29", FEB: "26", MAR: "4/2", APR: "30", MAY: "28", JUN: "7/2",
    JUL: "30", AUG: "27", SEP: "10/1", OCT: "29", NOV: "26", DEC: "31",
  },
  2028: {
    JAN: "28", FEB: "25", MAR: "31", APR: "28", MAY: "26", JUN: "30",
    JUL: "28", AUG: "25", SEP: "29", OCT: "27", NOV: "24", DEC: "31",
  },
  2029: {
    JAN: "26", FEB: "23", MAR: "30", APR: "27", MAY: "25", JUN: "29",
    JUL: "27", AUG: "24", SEP: "28", OCT: "26", NOV: "23", DEC: "31",
  },
};

/** Format a Date as YYYY-MM-DD in local time (avoids UTC shift from toISOString). */
export function toLocalYmd(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addLocalDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + Number(days || 0));
  return x;
}

function isSameYmd(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseClosingToken(token, targetYear, targetMonthIndex) {
  const raw = String(token || "").trim();
  if (!raw) return null;
  const slash = raw.match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
  if (slash) {
    const mm = Number(slash[1]);
    const dd = Number(slash[2]);
    if (!Number.isFinite(mm) || !Number.isFinite(dd)) return null;
    return new Date(targetYear, mm - 1, dd, 0, 0, 0, 0);
  }
  const dd = Number(raw);
  if (!Number.isFinite(dd)) return null;
  return new Date(targetYear, targetMonthIndex, dd, 0, 0, 0, 0);
}

function buildScheduledPeriods() {
  const years = Object.keys(TARGET_CLOSING_CALENDAR)
    .map((y) => Number(y))
    .sort((a, b) => a - b);
  const periods = [];
  let previousEnd = null;

  for (const year of years) {
    const byMonth = TARGET_CLOSING_CALENDAR[year];
    for (const mon of MONTHS) {
      const monthIdx = MONTH_INDEX[mon];
      const end = parseClosingToken(byMonth?.[mon], year, monthIdx);
      if (!end || Number.isNaN(end.getTime())) continue;

      const start = previousEnd
        ? addLocalDays(startOfLocalDay(previousEnd), 1)
        : new Date(year, 0, 1, 0, 0, 0, 0);

      periods.push({
        label: `${mon}-${year}`,
        start: startOfLocalDay(start),
        end: startOfLocalDay(end),
      });
      previousEnd = end;
    }
  }

  return periods;
}

const SCHEDULED_PERIODS = buildScheduledPeriods();

function getScheduledPeriodForDate(dateLike) {
  const d = startOfLocalDay(dateLike instanceof Date ? dateLike : new Date(dateLike));
  if (!SCHEDULED_PERIODS.length || Number.isNaN(d.getTime())) return null;

  for (const p of SCHEDULED_PERIODS) {
    if (d.getTime() >= p.start.getTime() && d.getTime() <= p.end.getTime()) {
      return { start: toLocalYmd(p.start), end: toLocalYmd(p.end) };
    }
  }
  return null;
}

/** Fallback when nothing is saved: first through last day of the current calendar month (neutral default). */
function defaultTargetPeriodWhenUnset() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 0, 0, 0, 0);
  return {
    start: toLocalYmd(start),
    end: toLocalYmd(end),
  };
}

function daysInclusive(start, end) {
  const a = startOfLocalDay(start).getTime();
  const b = startOfLocalDay(end).getTime();
  return Math.max(1, Math.floor((b - a) / DAY_MS) + 1);
}

function classifyMonthlyRule(start, end) {
  // Rule A: calendar month (1st -> last day of same month)
  if (start.getDate() === 1) {
    const lastOfStartMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    if (isSameYmd(end, lastOfStartMonth)) return "calendarMonth";
  }
  // Rule B: month start -> next month start (1st -> 1st of next month)
  if (start.getDate() === 1 && end.getDate() === 1) {
    const nextMonthStart = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    if (isSameYmd(end, nextMonthStart)) return "monthToNextMonthStart";
  }
  return "custom";
}

/**
 * Auto-roll saved periods forward when they are already over.
 * Preserves the user's chosen pattern:
 * - 1st -> last day of month
 * - 1st -> 1st of next month
 * - Otherwise: preserve inclusive length by rolling forward in fixed windows.
 */
function rollTargetPeriodForwardIfExpired(period, now = new Date()) {
  const scheduledNow = getScheduledPeriodForDate(now);
  if (scheduledNow) {
    const same =
      String(period?.start || "") === String(scheduledNow.start) &&
      String(period?.end || "") === String(scheduledNow.end);
    return { period: scheduledNow, changed: !same };
  }

  const { start: startDate, end: endDate } = parseTargetPeriodBounds(period?.start, period?.end);
  if (!startDate || !endDate) return { period: defaultTargetPeriodWhenUnset(), changed: true };

  const today = startOfLocalDay(now);
  const endDay = startOfLocalDay(endDate);
  if (today.getTime() <= endDay.getTime()) return { period, changed: false };

  const rule = classifyMonthlyRule(startDate, endDate);
  if (rule === "calendarMonth") {
    const y = today.getFullYear();
    const m = today.getMonth();
    const s = new Date(y, m, 1);
    const e = new Date(y, m + 1, 0);
    return { period: { start: toLocalYmd(s), end: toLocalYmd(e) }, changed: true };
  }

  if (rule === "monthToNextMonthStart") {
    const y = today.getFullYear();
    const m = today.getMonth();
    const s = new Date(y, m, 1);
    const e = new Date(y, m + 1, 1);
    return { period: { start: toLocalYmd(s), end: toLocalYmd(e) }, changed: true };
  }

  // Custom: fixed-size rolling window, keeping the same inclusive length.
  const len = daysInclusive(startDate, endDate);
  let nextStart = addLocalDays(endDay, 1);
  let nextEnd = addLocalDays(nextStart, len - 1);
  while (today.getTime() > startOfLocalDay(nextEnd).getTime()) {
    nextStart = addLocalDays(nextEnd, 1);
    nextEnd = addLocalDays(nextStart, len - 1);
  }
  return { period: { start: toLocalYmd(nextStart), end: toLocalYmd(nextEnd) }, changed: true };
}

/**
 * Parse saved period strings (YYYY-MM-DD) as local start-of-day / end-of-day.
 * Matches invoice dates parsed from Excel (local calendar dates) and avoids UTC-only Date parsing skew.
 */
export function parseTargetPeriodBounds(startYmd, endYmd) {
  if (!startYmd || !endYmd) return { start: null, end: null };
  const m1 = String(startYmd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const m2 = String(endYmd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m1 || !m2) {
    const start = new Date(startYmd);
    const end = new Date(endYmd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { start: null, end: null };
    }
    const endInclusive = new Date(end);
    endInclusive.setHours(23, 59, 59, 999);
    return { start, end: endInclusive };
  }
  const start = new Date(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3]), 0, 0, 0, 0);
  const end = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]), 23, 59, 59, 999);
  return { start, end };
}

export function getTargetPeriod() {
  const todayScheduled = getScheduledPeriodForDate(new Date());
  try {
    const stored = localStorage.getItem(TARGET_PERIOD_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.start && parsed.end) {
        const { start: s, end: e } = parseTargetPeriodBounds(parsed.start, parsed.end);
        const today = startOfLocalDay(new Date());
        if (s && e) {
          const startDay = startOfLocalDay(s);
          const endDay = startOfLocalDay(e);
          // Keep admin-customized period untouched while it's still active.
          if (today.getTime() >= startDay.getTime() && today.getTime() <= endDay.getTime()) {
            return parsed;
          }
        }

        const { period, changed } = rollTargetPeriodForwardIfExpired(parsed);
        if (changed) {
          try {
            localStorage.setItem(TARGET_PERIOD_KEY, JSON.stringify(period));
          } catch {
            // ignore
          }
        }
        return period;
      }
    }
  } catch (error) {
    // Fall through to default
  }

  const fallback = todayScheduled || defaultTargetPeriodWhenUnset();
  try {
    localStorage.setItem(TARGET_PERIOD_KEY, JSON.stringify(fallback));
  } catch {
    // ignore
  }
  return fallback;
}

/**
 * Save target period to localStorage
 */
export function saveTargetPeriod(start, end) {
  try {
    const period = { start, end };
    localStorage.setItem(TARGET_PERIOD_KEY, JSON.stringify(period));
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Format date for display (e.g., "Oct 2025")
 */
export function formatTargetPeriodDisplay(start, end) {
  try {
    const { start: startDate, end: endDate } = parseTargetPeriodBounds(start, end);
    if (!startDate || !endDate) return "Invalid Date";

    const sameMonth =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth();
    if (sameMonth) {
      return startDate.toLocaleString("en-US", { month: "short", year: "numeric" });
    }
    const d1 = startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const d2 = endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return `${d1} – ${d2}`;
  } catch (error) {
    return "Invalid Date";
  }
}

/**
 * Calculate days remaining until target end date
 */
export function getDaysRemaining(endDate) {
  try {
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  } catch (error) {
    return 0;
  }
}
