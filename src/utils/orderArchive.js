import { ORDER_STATUS, normalizeOrderStatus } from "./orderStatus";
import {
  getOrderArchiveRetentionFromConfig,
  saveOrderArchiveRetentionToConfig,
} from "../services/supabaseService";

export const ORDER_ARCHIVE_RETENTION_OPTIONS = [3, 7, 14, 21, 30];
export const DEFAULT_ORDER_ARCHIVE_RETENTION_DAYS = 3;
const STORAGE_KEY = "order_archive_retention_days";

function normalizeRetentionDays(days) {
  const n = Number(days);
  return ORDER_ARCHIVE_RETENTION_OPTIONS.includes(n)
    ? n
    : DEFAULT_ORDER_ARCHIVE_RETENTION_DAYS;
}

function cacheRetentionDaysLocally(days) {
  try {
    localStorage.setItem(STORAGE_KEY, String(days));
  } catch {
    /* ignore */
  }
}

/**
 * Days after delivery before an order moves to admin History (not deleted).
 * Uses local cache; call hydrateOrderArchiveRetentionDays on admin load for shared setting.
 * @returns {number}
 */
export function getOrderArchiveRetentionDays() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    if (ORDER_ARCHIVE_RETENTION_OPTIONS.includes(n)) return n;
  } catch {
    /* ignore */
  }
  return DEFAULT_ORDER_ARCHIVE_RETENTION_DAYS;
}

/**
 * Load retention from Supabase app_config (falls back to local/default).
 * @returns {Promise<number>}
 */
export async function hydrateOrderArchiveRetentionDays() {
  try {
    const remote = await getOrderArchiveRetentionFromConfig();
    if (remote != null && ORDER_ARCHIVE_RETENTION_OPTIONS.includes(remote)) {
      cacheRetentionDaysLocally(remote);
      return remote;
    }
  } catch (e) {
    console.warn("hydrateOrderArchiveRetentionDays:", e);
  }
  return getOrderArchiveRetentionDays();
}

/**
 * @param {number} days
 * @returns {Promise<number>}
 */
export async function persistOrderArchiveRetentionDays(days) {
  const safe = normalizeRetentionDays(days);
  cacheRetentionDaysLocally(safe);
  try {
    await saveOrderArchiveRetentionToConfig(safe);
  } catch (e) {
    console.warn("persistOrderArchiveRetentionDays:", e);
    throw e;
  }
  return safe;
}

/**
 * @param {number} days — updates local cache immediately; syncs to Supabase when configured.
 * @returns {number}
 */
export function setOrderArchiveRetentionDays(days) {
  const safe = normalizeRetentionDays(days);
  cacheRetentionDaysLocally(safe);
  void persistOrderArchiveRetentionDays(safe).catch(() => {});
  return safe;
}

export function isDeliveredStatus(status) {
  const s = normalizeOrderStatus(status);
  return s === ORDER_STATUS.DELIVERED;
}

/**
 * @param {object} order
 * @returns {number|null} epoch ms
 */
export function getOrderDeliveredAtMs(order) {
  if (!order || typeof order !== "object") return null;
  const raw =
    order.deliveredAt ??
    order.delivered_at ??
    order.dispatchedAt ??
    order.dispatched_at ??
    order.status_updated_at ??
    order.statusUpdatedAt ??
    order.updated_at ??
    order.updatedAt;
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

/**
 * Delivered orders older than retention move to History (UI only).
 * @param {object} order
 * @param {number} [retentionDays]
 * @param {(order: object) => string} [getOrderStatus]
 */
export function isOrderArchived(order, retentionDays, getOrderStatus) {
  const status =
    typeof getOrderStatus === "function"
      ? getOrderStatus(order)
      : normalizeOrderStatus(order?.status);
  if (!isDeliveredStatus(status)) return false;

  const deliveredMs = getOrderDeliveredAtMs(order);
  if (deliveredMs == null) return false;

  const days = retentionDays ?? getOrderArchiveRetentionDays();
  const retentionMs = days * 24 * 60 * 60 * 1000;
  return Date.now() - deliveredMs >= retentionMs;
}

/**
 * @param {object[]} orders
 * @param {(order: object) => string} getOrderStatus
 * @param {number} [retentionDays]
 */
/**
 * Distributor UI: delivered orders go to History immediately (not time-based).
 * @param {object[]} orders
 * @param {(order: object) => string} getOrderStatus
 */
export function partitionDistributorOrdersByDelivered(orders, getOrderStatus) {
  const active = [];
  const history = [];
  for (const order of orders || []) {
    const status =
      typeof getOrderStatus === "function"
        ? getOrderStatus(order)
        : normalizeOrderStatus(order?.status);
    if (isDeliveredStatus(status)) {
      history.push(order);
    } else {
      active.push(order);
    }
  }
  return { active, history };
}

function deletedOrdersStorageKey(distributorCode) {
  return `coke_deleted_order_keys_${String(distributorCode || "").trim()}`;
}

/** Keys removed by distributor cancel/delete — filtered on refresh so Supabase lag does not resurrect rows. */
export function getLocallyDeletedOrderKeys(distributorCode) {
  try {
    const raw = localStorage.getItem(deletedOrdersStorageKey(distributorCode));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function markOrderLocallyDeleted(distributorCode, orderKey) {
  if (!distributorCode || !orderKey) return;
  try {
    const key = String(orderKey);
    const set = new Set(getLocallyDeletedOrderKeys(distributorCode));
    set.add(key);
    localStorage.setItem(deletedOrdersStorageKey(distributorCode), JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function unmarkOrderLocallyDeleted(distributorCode, orderKey) {
  if (!distributorCode || !orderKey) return;
  try {
    const key = String(orderKey);
    const next = getLocallyDeletedOrderKeys(distributorCode).filter((k) => k !== key);
    localStorage.setItem(deletedOrdersStorageKey(distributorCode), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function filterLocallyDeletedOrders(orders, distributorCode, getOrderKey) {
  if (!distributorCode || typeof getOrderKey !== "function") return orders || [];
  const deleted = new Set(getLocallyDeletedOrderKeys(distributorCode));
  if (deleted.size === 0) return orders || [];
  return (orders || []).filter((o) => !deleted.has(getOrderKey(o)));
}

export function partitionOrdersByArchive(orders, getOrderStatus, retentionDays) {
  const active = [];
  const history = [];
  const days = retentionDays ?? getOrderArchiveRetentionDays();

  for (const order of orders || []) {
    if (isOrderArchived(order, days, getOrderStatus)) {
      history.push(order);
    } else {
      active.push(order);
    }
  }

  return { active, history, retentionDays: days };
}
