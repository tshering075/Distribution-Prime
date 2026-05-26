/**
 * Per-distributor sidebar badge state (localStorage).
 * Tracks what the user has already "seen" so we can show dots/counts for new activity.
 */

function key(code) {
  return `dist_sidebar_v1_${code || "unknown"}`;
}

export function loadSidebarSignals(distributorCode) {
  try {
    const raw = localStorage.getItem(key(distributorCode));
    if (!raw) return {};
    const o = JSON.parse(raw);
    return typeof o === "object" && o ? o : {};
  } catch {
    return {};
  }
}

function save(distributorCode, partial) {
  if (!distributorCode) return;
  try {
    const prev = loadSidebarSignals(distributorCode);
    localStorage.setItem(key(distributorCode), JSON.stringify({ ...prev, ...partial }));
  } catch {
    /* ignore */
  }
}

export function fingerprintTargetAchieved(target, achieved) {
  return JSON.stringify({
    t: target || {},
    a: achieved || {},
  });
}

/** Call once data is loaded so we don't badge on first paint. */
export function ensureDashboardBaselineIfMissing(distributorCode, target, achieved) {
  const s = loadSidebarSignals(distributorCode);
  if (s.dashboardSeenFingerprint != null) return;
  save(distributorCode, {
    dashboardSeenFingerprint: fingerprintTargetAchieved(target, achieved),
  });
}

/** User opened main dashboard from sidebar — treat current target/achieved as seen. */
export function markDashboardTargetSeen(distributorCode, target, achieved) {
  save(distributorCode, {
    dashboardSeenFingerprint: fingerprintTargetAchieved(target, achieved),
  });
}

/** User acknowledged current physical stock revision (viewed dialog or saved). */
export function markPhysicalStockRevisionSeen(distributorCode, updatedAtIso) {
  save(distributorCode, {
    physicalStockSeenUpdatedAt: updatedAtIso || "",
  });
}

export function shouldShowDashboardBadge(distributorCode, target, achieved) {
  const s = loadSidebarSignals(distributorCode);
  if (s.dashboardSeenFingerprint == null) return false;
  const now = fingerprintTargetAchieved(target, achieved);
  return now !== s.dashboardSeenFingerprint;
}

export function shouldShowPhysicalStockBadge(distributorCode, physicalStockPayload) {
  const updatedAt = physicalStockPayload?.updatedAt;
  if (!updatedAt || typeof updatedAt !== "string") return false;
  const s = loadSidebarSignals(distributorCode);
  const seen = s.physicalStockSeenUpdatedAt || "";
  return updatedAt > seen;
}
