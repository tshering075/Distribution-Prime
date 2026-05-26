/**
 * Global unique order numbers (4-digit display, 1000–9999 then wrap).
 * Counter is synced against coke_orders + optional Supabase list so numbers do not repeat.
 */

const ORDER_NUMBER_KEY = "coke_order_counter";
const MIN_ORDER_NUMBER = 1000;
const MAX_ORDER_NUMBER = 9999;

/** @param {string|number|null|undefined} value */
export function normalizeOrderNumber(value) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const n = parseInt(s, 10);
  if (Number.isFinite(n) && n >= 0) return String(n).padStart(4, "0");
  return s;
}

function readCounter() {
  try {
    const stored = localStorage.getItem(ORDER_NUMBER_KEY);
    const counter = stored ? parseInt(stored, 10) : MIN_ORDER_NUMBER - 1;
    if (!Number.isFinite(counter)) return MIN_ORDER_NUMBER - 1;
    return counter;
  } catch {
    return MIN_ORDER_NUMBER - 1;
  }
}

function writeCounter(counter) {
  try {
    localStorage.setItem(ORDER_NUMBER_KEY, String(counter));
  } catch {
    /* ignore */
  }
}

/** @param {Array<{ orderNumber?: string|number }>} orders */
export function collectUsedOrderNumbers(orders) {
  const used = new Set();
  for (const order of orders || []) {
    const key = normalizeOrderNumber(order?.orderNumber);
    if (key) used.add(key);
  }
  return used;
}

/** All order numbers already stored in this browser's coke_orders cache. */
export function loadUsedOrderNumbersFromLocalStorage() {
  try {
    const stored = localStorage.getItem("coke_orders");
    const orders = stored ? JSON.parse(stored) : [];
    return collectUsedOrderNumbers(Array.isArray(orders) ? orders : []);
  } catch {
    return new Set();
  }
}

/** Advance local counter so the next issued number is above every known order number. */
export function syncOrderNumberCounterFromUsed(used) {
  let max = MIN_ORDER_NUMBER - 1;
  for (const key of used) {
    const n = parseInt(key, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  const floor = max >= MAX_ORDER_NUMBER ? MIN_ORDER_NUMBER - 1 : Math.max(MIN_ORDER_NUMBER - 1, max);
  writeCounter(floor);
}

/**
 * Preview next available number without incrementing the counter (calculator UI).
 * @param {Set<string>|null} [used]
 */
export function peekNextUniqueOrderNumber(used = null) {
  const set = used || loadUsedOrderNumbersFromLocalStorage();
  syncOrderNumberCounterFromUsed(set);
  let counter = readCounter();
  for (let i = 0; i < MAX_ORDER_NUMBER - MIN_ORDER_NUMBER + 2; i++) {
    counter += 1;
    if (counter > MAX_ORDER_NUMBER) counter = MIN_ORDER_NUMBER;
    const n = String(counter).padStart(4, "0");
    if (!set.has(n)) return n;
  }
  return String(Date.now() % 10000).padStart(4, "0");
}

/**
 * Get the next order number (sequential, persistent, 4-digit).
 * Prefer allocateUniqueOrderNumber when creating a new order.
 */
export function getNextOrderNumber() {
  try {
    let counter = readCounter();
    counter += 1;
    if (counter > MAX_ORDER_NUMBER) counter = MIN_ORDER_NUMBER;
    writeCounter(counter);
    return String(counter).padStart(4, "0");
  } catch {
    const fallback = Math.floor(Date.now() / 1000) % 10000;
    return String(fallback).padStart(4, "0");
  }
}

/**
 * Next number guaranteed not in `used` (updates counter and adds to set).
 * @param {Set<string>} used
 */
export function getNextOrderNumberExcluding(used) {
  const set = used instanceof Set ? used : new Set(used || []);
  syncOrderNumberCounterFromUsed(set);
  for (let attempt = 0; attempt < MAX_ORDER_NUMBER - MIN_ORDER_NUMBER + 2; attempt++) {
    const n = getNextOrderNumber();
    const key = normalizeOrderNumber(n);
    if (!set.has(key)) {
      set.add(key);
      return n;
    }
  }
  const fallback = `${Date.now() % 10000}`.padStart(4, "0");
  set.add(fallback);
  return fallback;
}

/**
 * Allocate a globally unused order number (local cache + optional remote list).
 * @param {{ fetchRemoteOrderNumbers?: () => Promise<Array<string|number>> }} [options]
 */
export async function allocateUniqueOrderNumber(options = {}) {
  const used = loadUsedOrderNumbersFromLocalStorage();
  if (typeof options.fetchRemoteOrderNumbers === "function") {
    try {
      const remote = await options.fetchRemoteOrderNumbers();
      for (const raw of remote || []) {
        const key = normalizeOrderNumber(raw);
        if (key) used.add(key);
      }
    } catch (e) {
      console.warn("Could not load remote order numbers for uniqueness:", e);
    }
  }
  return getNextOrderNumberExcluding(used);
}

/** Options for global uniqueness when Supabase is enabled. */
export function supabaseOrderNumberOptions(fetchRemoteOrderNumbers) {
  return typeof fetchRemoteOrderNumbers === "function"
    ? { fetchRemoteOrderNumbers }
    : {};
}

/** True when Postgres rejected a duplicate orderNumber. */
export function isOrderNumberUniqueViolation(error) {
  if (error?.code === "23505") return true;
  const msg = String(error?.message || error?.details || "").toLowerCase();
  return (
    msg.includes("idx_orders_order_number_unique") ||
    (msg.includes("unique") && msg.includes("ordernumber"))
  );
}

/**
 * Get current order number without incrementing (4-digit format).
 */
export function getCurrentOrderNumber() {
  try {
    const counter = readCounter();
    const display = counter < MIN_ORDER_NUMBER ? MIN_ORDER_NUMBER : counter;
    return String(display).padStart(4, "0");
  } catch {
    return "1000";
  }
}

/**
 * Reset order number counter (for testing/admin purposes).
 */
export function resetOrderNumber(startFrom = 1000) {
  try {
    localStorage.setItem(ORDER_NUMBER_KEY, String(startFrom));
    return true;
  } catch {
    return false;
  }
}
