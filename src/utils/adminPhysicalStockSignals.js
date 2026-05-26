/**
 * Admin sidebar: badge when one or more distributors submit a newer physical stock revision.
 * Mirrors distributor-side "seen" pattern (localStorage).
 */

import { getRawPhysicalStockFromDistributor } from "./physicalStockTemplate";

const STORAGE_KEY = "admin_physical_stock_seen_v1";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { baselineSet: false, seenMaxUpdatedAt: "" };
    const o = JSON.parse(raw);
    return {
      baselineSet: o.baselineSet === true,
      seenMaxUpdatedAt: typeof o.seenMaxUpdatedAt === "string" ? o.seenMaxUpdatedAt : "",
    };
  } catch {
    return { baselineSet: false, seenMaxUpdatedAt: "" };
  }
}

function save(partial) {
  try {
    const prev = load();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...partial }));
  } catch {
    /* ignore */
  }
}

function maxPhysicalStockUpdatedAt(distributors) {
  let max = "";
  for (const d of distributors || []) {
    const raw = getRawPhysicalStockFromDistributor(d);
    const u = raw?.updatedAt;
    if (u != null && String(u).trim() !== "" && String(u) > max) {
      max = String(u);
    }
  }
  return max;
}

/** First load: treat current server state as "already seen" so old submissions don't spam the badge. */
export function ensureAdminPhysicalStockBaseline(distributors) {
  const s = load();
  if (s.baselineSet) return;
  const max = maxPhysicalStockUpdatedAt(distributors);
  save({
    baselineSet: true,
    seenMaxUpdatedAt: max || new Date(0).toISOString(),
  });
}

/** Count distributors whose physical_stock.updatedAt is newer than what the admin last acknowledged. */
export function countDistributorsWithNewPhysicalStock(distributors) {
  const { baselineSet, seenMaxUpdatedAt } = load();
  if (!baselineSet) return 0;
  const seen = seenMaxUpdatedAt || "";
  let n = 0;
  for (const d of distributors || []) {
    const raw = getRawPhysicalStockFromDistributor(d);
    const u = raw?.updatedAt;
    if (u != null && String(u).trim() !== "" && String(u) > seen) {
      n += 1;
    }
  }
  return n;
}

/** Call when admin opens Physical Stock so the badge clears until the next distributor update. */
export function markAdminPhysicalStockNotificationsSeen(distributors) {
  const max = maxPhysicalStockUpdatedAt(distributors);
  save({
    baselineSet: true,
    seenMaxUpdatedAt: max && max.trim() !== "" ? max : new Date().toISOString(),
  });
}

/** ISO timestamp admin last acknowledged (for in-dialog “who updated” banner). */
export function getAdminPhysicalStockLastSeenAt() {
  return load().seenMaxUpdatedAt || "";
}

/**
 * Distributors with physical_stock.updatedAt newer than `sinceIso` (string compare on ISO dates).
 * @returns {Array<{ distributor: object, updatedAt: string }>} newest first
 */
export function getPhysicalStockUpdatesSince(distributors, sinceIso) {
  const seen = sinceIso || "";
  const out = [];
  for (const d of distributors || []) {
    const raw = getRawPhysicalStockFromDistributor(d);
    const u = raw?.updatedAt;
    if (u != null && String(u).trim() !== "" && String(u) > seen) {
      out.push({ distributor: d, updatedAt: String(u) });
    }
  }
  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return out;
}
