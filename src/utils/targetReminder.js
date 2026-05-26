/**
 * Stock-lift / target balance reminders.
 * Daily (local calendar day): once per distributor per day when the dashboard loads.
 * Legacy twice-weekly helpers remain for compatibility.
 */

const STORAGE_PREFIX_DAILY = "coke_stock_lift_daily_reminder_v1";
const STORAGE_PREFIX = "coke_target_tw_reminder_v1";

export function getLocalDateKeyYmd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Claim at most one stock-lift reminder per distributor per local calendar day.
 * @param {string} distributorCode
 * @returns {{ ymd: string } | null}
 */
export function tryClaimDailyStockLiftReminder(distributorCode) {
  if (!distributorCode || typeof distributorCode !== "string") return null;
  const ymd = getLocalDateKeyYmd();
  const key = `${STORAGE_PREFIX_DAILY}_${distributorCode}_${ymd}`;
  try {
    if (localStorage.getItem(key)) return null;
    localStorage.setItem(key, String(Date.now()));
    return { ymd };
  } catch {
    return null;
  }
}

/**
 * ISO week id for local calendar date, e.g. 2025-W11
 */
export function getIsoWeekKeyLocal(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const year = d.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * @returns {'mon'|'thu'|null}
 */
export function getTargetReminderSlotToday() {
  const day = new Date().getDay();
  if (day === 1) return "mon";
  if (day === 4) return "thu";
  return null;
}

/**
 * Atomically claim this week's reminder slot for the distributor (returns null if not due or already claimed).
 * @param {string} distributorCode
 * @returns {{ slot: 'mon'|'thu', weekKey: string } | null}
 */
export function tryClaimTwiceWeeklyTargetReminder(distributorCode) {
  if (!distributorCode || typeof distributorCode !== "string") return null;
  const slot = getTargetReminderSlotToday();
  if (!slot) return null;

  const weekKey = getIsoWeekKeyLocal(new Date());
  const key = `${STORAGE_PREFIX}_${distributorCode}_${weekKey}_${slot}`;

  try {
    if (localStorage.getItem(key)) return null;
    localStorage.setItem(key, String(Date.now()));
    return { slot, weekKey };
  } catch {
    return null;
  }
}

/**
 * @param {object} params
 * @param {number} params.remainingDays
 * @param {string} [params.periodEndYmd]
 * @param {Array<{ category: string, targetPC: number, targetUC: number, achievedPC: number, achievedUC: number }>} params.rows
 */
export function buildTargetBalanceReminderMessage({ remainingDays, periodEndYmd, rows }) {
  const lines = (rows || []).map((row) => {
    const balPC = (Number(row.targetPC) || 0) - (Number(row.achievedPC) || 0);
    const balUC = (Number(row.targetUC) || 0) - (Number(row.achievedUC) || 0);
    const pcLabel =
      balPC > 0
        ? `${balPC.toLocaleString()} PC to lift`
        : balPC < 0
          ? `${Math.abs(balPC).toLocaleString()} PC ahead`
          : "PC on target";
    const ucLabel =
      balUC > 0
        ? `${Math.round(balUC).toLocaleString()} UC to lift`
        : balUC < 0
          ? `${Math.round(Math.abs(balUC)).toLocaleString()} UC ahead`
          : "UC on target";
    return `${row.category}: ${pcLabel}, ${ucLabel}`;
  });

  const endPart = periodEndYmd ? ` Current period ends ${periodEndYmd}.` : "";
  const daysPart =
    remainingDays > 0
      ? `You have ${remainingDays} day${remainingDays === 1 ? "" : "s"} left in the target period.${endPart}`
      : `The target period has ended or you are on the last day.${endPart}`;

  return `${daysPart} Stock-lift vs target: ${lines.join(" · ")}. Record lifts regularly so your Target Balance and achievement status stay accurate.`;
}

export function getTargetReminderNotificationIconUrl() {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const path = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
    return `${base}${path}/coke-sales-icon-512.png`;
  } catch {
    return "/coke-sales-icon-512.png";
  }
}
