/**
 * Distributor POS sale records (tenant + distributor scoped, localStorage).
 */

import { getActiveOrganizationId } from "../services/tenantScope";
import {
  allocateUniqueInvoiceNumberSync,
  normalizeInvoiceNumber,
} from "./invoiceNumber";
import { localIsoDate } from "./physicalStockTemplate";

function saleTimestamp(sale) {
  const t = new Date(sale?.createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Local calendar date (YYYY-MM-DD) for a POS sale record. */
export function posSaleLocalDate(sale) {
  if (sale?.saleDate) return String(sale.saleDate).slice(0, 10);
  const iso = sale?.createdAt;
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mergePosSalesById(localSales, remoteSales) {
  const map = new Map();
  for (const sale of [...(localSales || []), ...(remoteSales || [])]) {
    if (!sale?.id) continue;
    const existing = map.get(sale.id);
    if (!existing || saleTimestamp(sale) >= saleTimestamp(existing)) {
      map.set(sale.id, sale);
    }
  }
  return Array.from(map.values()).sort((a, b) => saleTimestamp(b) - saleTimestamp(a));
}

function syncSaleCounterFromSales(distributorCode, sales) {
  let max = 1000;
  for (const sale of sales || []) {
    const match = String(sale?.saleNumber || "").match(/POS-(\d+)/i);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  try {
    localStorage.setItem(counterKey(distributorCode), String(max));
  } catch {
    /* ignore */
  }
}

const POS_SALES_KEY = "distributor_pos_sales";
const POS_COUNTER_KEY = "distributor_pos_counter";

function salesKey(distributorCode) {
  const org = getActiveOrganizationId() || "default";
  return `${POS_SALES_KEY}:${org}:${String(distributorCode || "").trim().toUpperCase()}`;
}

function counterKey(distributorCode) {
  const org = getActiveOrganizationId() || "default";
  return `${POS_COUNTER_KEY}:${org}:${String(distributorCode || "").trim().toUpperCase()}`;
}

function readAllSales(distributorCode) {
  try {
    const raw = localStorage.getItem(salesKey(distributorCode));
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeAllSales(distributorCode, list) {
  try {
    localStorage.setItem(salesKey(distributorCode), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** All POS sales in current tenant (every distributor). */
export function readAllPosSalesInTenant() {
  const org = getActiveOrganizationId() || "default";
  const prefix = `${POS_SALES_KEY}:${org}:`;
  const sales = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const list = JSON.parse(raw);
      if (Array.isArray(list)) sales.push(...list);
    }
  } catch {
    /* ignore */
  }
  return sales;
}

function collectUsedPosInvoiceNumbers() {
  return readAllPosSalesInTenant()
    .map((sale) => normalizeInvoiceNumber(sale?.invoiceNumber))
    .filter(Boolean);
}

function nextPosInvoiceNumber() {
  return allocateUniqueInvoiceNumberSync(collectUsedPosInvoiceNumbers());
}

function nextSaleNumber(distributorCode) {
  try {
    const key = counterKey(distributorCode);
    let n = parseInt(localStorage.getItem(key) || "1000", 10);
    if (!Number.isFinite(n)) n = 1000;
    n += 1;
    if (n > 9999) n = 1000;
    localStorage.setItem(key, String(n));
    return `POS-${String(n).padStart(4, "0")}`;
  } catch {
    return `POS-${Date.now() % 10000}`;
  }
}

/** @returns {Array} sales for distributor, newest first */
export function readPosSales(distributorCode) {
  return readAllSales(distributorCode).sort((a, b) => saleTimestamp(b) - saleTimestamp(a));
}

export function readPosSalesForDate(distributorCode, isoDate) {
  const day = String(isoDate || "").slice(0, 10);
  return readPosSales(distributorCode).filter((s) => posSaleLocalDate(s) === day);
}

/** Filter sales where createdAt date is within [fromDate, toDate] (inclusive, YYYY-MM-DD). */
export function filterPosSalesByDateRange(sales, fromDate, toDate) {
  const from = String(fromDate || "").slice(0, 10);
  const to = String(toDate || "").slice(0, 10);
  if (!from && !to) return sales || [];
  const start = from || to;
  const end = to || from;
  const rangeStart = start <= end ? start : end;
  const rangeEnd = start <= end ? end : start;
  return (sales || []).filter((sale) => {
    const day = posSaleLocalDate(sale);
    if (!day) return false;
    return day >= rangeStart && day <= rangeEnd;
  });
}

export function readPosSalesInDateRange(distributorCode, fromDate, toDate) {
  return filterPosSalesByDateRange(readPosSales(distributorCode), fromDate, toDate);
}

/**
 * Product-wise rollup for POS sales report.
 * @returns {Array<{ sku: string, name: string, category: string, qtySold: number, revenue: number, saleCount: number, avgRate: number, lines: Array }>}
 */
export function aggregatePosSalesByProduct(sales) {
  const map = new Map();

  for (const sale of sales || []) {
    for (const line of sale.lines || []) {
      const sku = String(line.sku || line.name || "").trim();
      if (!sku) continue;
      const key = sku.toUpperCase();
      const qty = Number(line.qty) || 0;
      const rate = Number(line.rate) || 0;
      const amount = Number(line.amount) || rate * qty;

      let row = map.get(key);
      if (!row) {
        row = {
          sku,
          name: String(line.name || line.sku || sku).trim(),
          category: String(line.category || "").trim(),
          qtySold: 0,
          revenue: 0,
          saleIds: new Set(),
          lines: [],
        };
        map.set(key, row);
      }

      row.qtySold += qty;
      row.revenue += amount;
      if (sale.id) row.saleIds.add(sale.id);
      if (line.category) row.category = String(line.category).trim();
      row.lines.push({
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber || sale.saleNumber,
        createdAt: sale.createdAt,
        qty,
        rate,
        amount,
        customerName: sale.customerName || "",
      });
    }
  }

  return Array.from(map.values())
    .map((row) => ({
      sku: row.sku,
      name: row.name,
      category: row.category || "—",
      qtySold: row.qtySold,
      revenue: Math.round(row.revenue * 100) / 100,
      saleCount: row.saleIds.size,
      avgRate: row.qtySold > 0 ? Math.round((row.revenue / row.qtySold) * 100) / 100 : 0,
      lines: row.lines.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    }))
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
}

/**
 * @param {string} distributorCode
 * @param {{ lines: Array, subtotal: number, paymentMethod: string, customerName?: string, note?: string }} sale
 */
export const POS_GST_RATE = 0.05;

export function resolvePosGstRate(gstEnabled, distributorName) {
  const isGelephuGrocery = String(distributorName || "").toLowerCase().includes("gelephu grocery");
  if (isGelephuGrocery || !gstEnabled) return 0;
  return POS_GST_RATE;
}

export function computePosGstAmount(taxableAmount, gstRate) {
  const base = Math.max(0, Number(taxableAmount) || 0);
  const rate = Number(gstRate) || 0;
  if (rate <= 0 || base <= 0) return 0;
  return Math.round(base * rate * 100) / 100;
}

function buildPosSaleRecord(distributorCode, sale, { saleNumber, invoiceNumber } = {}) {
  const subtotal = Number(sale.subtotal) || 0;
  const discountAmount = Math.max(0, Number(sale.discountAmount) || 0);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const gstRate = Number(sale.gstRate) || 0;
  const gstAmount =
    Number.isFinite(Number(sale.gstAmount)) && Number(sale.gstAmount) >= 0
      ? Number(sale.gstAmount)
      : computePosGstAmount(taxableAmount, gstRate);
  const total =
    Number.isFinite(Number(sale.total)) && Number(sale.total) >= 0
      ? Number(sale.total)
      : taxableAmount + gstAmount;

  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `pos_${Date.now()}`,
    saleNumber: saleNumber || nextSaleNumber(distributorCode),
    invoiceNumber: invoiceNumber || nextPosInvoiceNumber(),
    distributorCode: String(distributorCode || "").trim(),
    lines: sale.lines || [],
    subtotal,
    discountType: sale.discountType || "none",
    discountValue: Number(sale.discountValue) || 0,
    discountAmount,
    taxableAmount,
    gstRate,
    gstAmount,
    total,
    paymentMethod: sale.paymentMethod || "cash",
    amountTendered:
      sale.amountTendered == null ? null : Number(sale.amountTendered) || 0,
    changeGiven: sale.changeGiven == null ? null : Number(sale.changeGiven) || 0,
    customerName: String(sale.customerName || "").trim(),
    customerMobile: String(sale.customerMobile || "").trim(),
    customerGstin: String(sale.customerGstin || "").trim(),
    customerTpn: String(sale.customerTpn || "").trim(),
    note: String(sale.note || "").trim(),
    distributorName: String(sale.distributorName || "").trim(),
    distributorAddress: String(sale.distributorAddress || "").trim(),
    distributorGstin: String(sale.distributorGstin || "").trim(),
    stockDeductions: Array.isArray(sale.stockDeductions) ? sale.stockDeductions : [],
    saleDate: sale.saleDate || localIsoDate(),
    createdAt: new Date().toISOString(),
  };
}

function isDuplicatePosSaleError(error) {
  const msg = String(error?.message || error || "");
  const code = String(error?.code || "");
  return (
    code === "23505" ||
    /duplicate key|unique constraint|already exists/i.test(msg)
  );
}

async function resolveNextPosInvoiceNumber(distributorCode, isSupabaseConfigured) {
  const used = collectUsedPosInvoiceNumbers().map((n) => normalizeInvoiceNumber(n)).filter(Boolean);
  if (isSupabaseConfigured) {
    try {
      const { fetchPosInvoiceNumbersInTenant } = await import("../services/posSupabaseService");
      const remote = await fetchPosInvoiceNumbersInTenant(distributorCode);
      for (const raw of remote) {
        const key = normalizeInvoiceNumber(raw);
        if (key) used.push(key);
      }
    } catch (error) {
      console.warn("Could not load remote POS invoice numbers:", error);
    }
  }
  return allocateUniqueInvoiceNumberSync(used);
}

/** Save locally only (legacy). Prefer appendPosSaleAsync when Supabase is available. */
export function appendPosSale(distributorCode, sale) {
  const record = buildPosSaleRecord(distributorCode, sale);
  const all = readAllSales(distributorCode);
  all.push(record);
  writeAllSales(distributorCode, all);
  return record;
}

/** Save POS sale to Supabase (when configured) and local cache. */
export async function appendPosSaleAsync(distributorCode, sale, { isSupabaseConfigured = false } = {}) {
  let invoiceNumber = await resolveNextPosInvoiceNumber(distributorCode, isSupabaseConfigured);
  const record = buildPosSaleRecord(distributorCode, sale, { invoiceNumber });

  if (isSupabaseConfigured) {
    const { insertPosSaleToSupabase } = await import("../services/posSupabaseService");
    let saved = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        saved = await insertPosSaleToSupabase(distributorCode, record);
        break;
      } catch (error) {
        if (isDuplicatePosSaleError(error) && attempt < 2) {
          invoiceNumber = await resolveNextPosInvoiceNumber(distributorCode, true);
          record.invoiceNumber = invoiceNumber;
          continue;
        }
        throw error;
      }
    }
    if (saved) {
      Object.assign(record, saved);
    }
  }

  const all = readAllSales(distributorCode);
  const idx = all.findIndex((s) => s.id === record.id);
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  writeAllSales(distributorCode, all);
  return record;
}

function deletePosSaleLocal(distributorCode, saleId) {
  const id = String(saleId || "").trim();
  if (!id) return false;
  const next = readAllSales(distributorCode).filter((s) => s.id !== id);
  writeAllSales(distributorCode, next);
  return true;
}

/** Delete POS sale locally and from Supabase when configured. */
export async function deletePosSaleAsync(distributorCode, saleId, { isSupabaseConfigured = false } = {}) {
  const id = String(saleId || "").trim();
  if (!id || !distributorCode) return false;

  if (isSupabaseConfigured) {
    try {
      const { deletePosSaleFromSupabase } = await import("../services/posSupabaseService");
      await deletePosSaleFromSupabase(distributorCode, id);
    } catch (error) {
      console.warn("POS sale cloud delete failed:", error);
      throw error;
    }
  }

  deletePosSaleLocal(distributorCode, id);
  return true;
}

/** Pull POS sales from Supabase, upload any local-only rows, refresh cache. */
export async function syncPosSalesFromSupabase(distributorCode, isSupabaseConfigured) {
  const local = readAllSales(distributorCode);
  if (!isSupabaseConfigured || !distributorCode) return local;

  try {
    const { fetchPosSalesFromSupabase, insertPosSaleToSupabase } = await import(
      "../services/posSupabaseService"
    );

    let remote = await fetchPosSalesFromSupabase(distributorCode);
    const remoteIds = new Set(remote.map((s) => s.id));

    for (const sale of local) {
      if (!remoteIds.has(sale.id)) {
        try {
          await insertPosSaleToSupabase(distributorCode, sale);
        } catch (error) {
          console.warn("Upload local POS sale failed:", sale.id, error);
        }
      }
    }

    remote = await fetchPosSalesFromSupabase(distributorCode);
    const merged = mergePosSalesById(local, remote);
    writeAllSales(distributorCode, merged);
    syncSaleCounterFromSales(distributorCode, merged);
    return merged;
  } catch (error) {
    console.warn("POS sales sync failed:", error);
    return local;
  }
}

export function sumPosSalesTotal(sales) {
  return (sales || []).reduce((s, r) => s + saleGrandTotal(r), 0);
}

/** Grand total incl. GST when stored (falls back for older records). */
export function saleGrandTotal(sale) {
  if (!sale) return 0;
  const total = Number(sale.total);
  if (Number.isFinite(total) && total >= 0) return total;
  const taxable =
    Number.isFinite(Number(sale.taxableAmount)) && Number(sale.taxableAmount) >= 0
      ? Number(sale.taxableAmount)
      : Math.max(0, (Number(sale.subtotal) || 0) - (Number(sale.discountAmount) || 0));
  const gst = Number(sale.gstAmount) || 0;
  return taxable + gst;
}

export function sumPosSalesByPayment(sales) {
  const map = {};
  for (const sale of sales || []) {
    const key = sale.paymentMethod || "cash";
    map[key] = (map[key] || 0) + saleGrandTotal(sale);
  }
  return map;
}

export function sumPosItemCount(sales) {
  return (sales || []).reduce((sum, sale) => {
    const lines = sale.lines || [];
    return sum + lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  }, 0);
}

const HELD_SALE_KEY = "distributor_pos_held";

function heldKey(distributorCode) {
  const org = getActiveOrganizationId() || "default";
  return `${HELD_SALE_KEY}:${org}:${String(distributorCode || "").trim().toUpperCase()}`;
}

export function readHeldPosSale(distributorCode) {
  try {
    const raw = localStorage.getItem(heldKey(distributorCode));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveHeldPosSale(distributorCode, payload) {
  try {
    localStorage.setItem(heldKey(distributorCode), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearHeldPosSale(distributorCode) {
  try {
    localStorage.removeItem(heldKey(distributorCode));
  } catch {
    /* ignore */
  }
}
