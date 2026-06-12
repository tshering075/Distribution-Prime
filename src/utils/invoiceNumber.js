/**
 * Unique invoice numbers (INV-1000–INV-9999, separate from order numbers).
 * Counter is tenant-scoped and synced against existing orders.
 */

import { getActiveOrganizationId } from '../services/tenantScope';
import { getTenantScopedStorageKey } from './tenantLocalStorage';
import { readOrdersCache } from './ordersLocalStorage';

const INVOICE_COUNTER_KEY = 'coke_invoice_counter';
const INVOICE_PREFIX = 'INV-';
const MIN_INVOICE_SEQ = 1000;
const MAX_INVOICE_SEQ = 9999;

function counterStorageKey() {
  return getTenantScopedStorageKey(INVOICE_COUNTER_KEY, getActiveOrganizationId());
}

/** @param {string|number|null|undefined} value */
export function normalizeInvoiceNumber(value) {
  const s = String(value ?? '').trim().toUpperCase();
  if (!s) return '';
  if (/^INV-\d+$/i.test(s)) {
    const n = parseInt(s.slice(4), 10);
    if (Number.isFinite(n)) return `${INVOICE_PREFIX}${String(n).padStart(4, '0')}`;
  }
  const bare = parseInt(s, 10);
  if (Number.isFinite(bare) && bare >= 0) {
    return `${INVOICE_PREFIX}${String(bare).padStart(4, '0')}`;
  }
  return s;
}

function readCounter() {
  try {
    const stored = localStorage.getItem(counterStorageKey());
    const counter = stored ? parseInt(stored, 10) : MIN_INVOICE_SEQ - 1;
    if (!Number.isFinite(counter)) return MIN_INVOICE_SEQ - 1;
    return counter;
  } catch {
    return MIN_INVOICE_SEQ - 1;
  }
}

function writeCounter(counter) {
  try {
    localStorage.setItem(counterStorageKey(), String(counter));
  } catch {
    /* ignore */
  }
}

/** @param {Array<Record<string, unknown>>} orders */
export function collectUsedInvoiceNumbers(orders) {
  const used = new Set();
  for (const order of orders || []) {
    for (const key of ['invoiceNumber', 'invoice_number', 'invoiceNo', 'invoice_no']) {
      const normalized = normalizeInvoiceNumber(order?.[key]);
      if (normalized) used.add(normalized);
    }
  }
  return used;
}

export function loadUsedInvoiceNumbersFromLocalStorage() {
  try {
    return collectUsedInvoiceNumbers(readOrdersCache());
  } catch {
    return new Set();
  }
}

export function syncInvoiceNumberCounterFromUsed(used) {
  let max = MIN_INVOICE_SEQ - 1;
  for (const key of used) {
    const n = parseInt(String(key).replace(/^INV-/i, ''), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  const floor = max >= MAX_INVOICE_SEQ ? MIN_INVOICE_SEQ - 1 : Math.max(MIN_INVOICE_SEQ - 1, max);
  writeCounter(floor);
}

function getNextInvoiceSeq() {
  let counter = readCounter();
  counter += 1;
  if (counter > MAX_INVOICE_SEQ) counter = MIN_INVOICE_SEQ;
  writeCounter(counter);
  return counter;
}

function getNextInvoiceNumberExcluding(used) {
  const set = used instanceof Set ? used : new Set(used || []);
  syncInvoiceNumberCounterFromUsed(set);
  for (let attempt = 0; attempt < MAX_INVOICE_SEQ - MIN_INVOICE_SEQ + 2; attempt++) {
    const seq = getNextInvoiceSeq();
    const n = `${INVOICE_PREFIX}${String(seq).padStart(4, '0')}`;
    if (!set.has(n)) {
      set.add(n);
      return n;
    }
  }
  const fallback = `${INVOICE_PREFIX}${String(Date.now() % 10000).padStart(4, '0')}`;
  set.add(fallback);
  return fallback;
}

/**
 * Allocate a unique invoice number (local cache + optional remote list).
 * @param {{ fetchRemoteInvoiceNumbers?: () => Promise<Array<string|number>> }} [options]
 */
export async function allocateUniqueInvoiceNumber(options = {}) {
  const used = loadUsedInvoiceNumbersFromLocalStorage();
  if (typeof options.fetchRemoteInvoiceNumbers === 'function') {
    try {
      const remote = await options.fetchRemoteInvoiceNumbers();
      for (const raw of remote || []) {
        const key = normalizeInvoiceNumber(raw);
        if (key) used.add(key);
      }
    } catch (e) {
      console.warn('Could not load remote invoice numbers for uniqueness:', e);
    }
  }
  return getNextInvoiceNumberExcluding(used);
}
