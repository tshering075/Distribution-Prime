import { parseFirestoreDate } from "./dateUtils";
import { ORDER_STATUS, resolveOrderStatus } from "./orderStatus";
import {
  getOrderAchievementTotals,
  resolveOrderDistributorCode,
} from "../services/deliveredOrderAchievement";
import {
  parseTargetPeriodBounds,
  resolveDispatchAchievementPeriod,
  targetPeriodsMatch,
} from "./targetPeriod";

export const EMPTY_ACHIEVED = Object.freeze({
  CSD_PC: 0,
  CSD_UC: 0,
  Water_PC: 0,
  Water_UC: 0,
});

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeAchievedShape(raw) {
  return {
    CSD_PC: num(raw?.CSD_PC ?? raw?.csdPC),
    CSD_UC: num(raw?.CSD_UC ?? raw?.csdUC),
    Water_PC: num(raw?.Water_PC ?? raw?.waterPC),
    Water_UC: num(raw?.Water_UC ?? raw?.waterUC),
  };
}

export function addAchieved(a, b) {
  const x = normalizeAchievedShape(a);
  const y = normalizeAchievedShape(b);
  return {
    CSD_PC: x.CSD_PC + y.CSD_PC,
    CSD_UC: x.CSD_UC + y.CSD_UC,
    Water_PC: x.Water_PC + y.Water_PC,
    Water_UC: x.Water_UC + y.Water_UC,
  };
}

function resolveDistributorCode(record) {
  return String(record?.distributorCode ?? record?.distributor_code ?? "").trim();
}

function salesLiftKey(distributorCode, invoiceOrOrderNumber) {
  const code = String(distributorCode || "").trim();
  const inv = String(invoiceOrOrderNumber ?? "").trim();
  if (!code || !inv) return "";
  return `${code}::${inv}`;
}

function parseDispatchDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : parseFirestoreDate(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfLocalDay(d) {
  const x = d instanceof Date ? d : new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 0, 0, 0, 0);
}

function shouldCountLiftForViewPeriod(dispatchDate, viewPeriod) {
  if (!viewPeriod?.start || !viewPeriod?.end) return true;

  const d = startOfLocalDay(dispatchDate);
  if (Number.isNaN(d.getTime())) return false;

  const { start, end } = parseTargetPeriodBounds(viewPeriod.start, viewPeriod.end);
  if (start && end && d.getTime() >= start.getTime() && d.getTime() <= end.getTime()) {
    return true;
  }

  const assigned = resolveDispatchAchievementPeriod(dispatchDate, viewPeriod);
  return targetPeriodsMatch(assigned, viewPeriod);
}

function addLiftToMap(map, code, lift) {
  const prev = map.get(code) || { ...EMPTY_ACHIEVED };
  map.set(code, addAchieved(prev, lift));
}

/**
 * Sum achieved per distributor for the viewed target period only.
 * Dispatches after period end are assigned to the next scheduled period (next month).
 */
export function aggregateAchievedByDistributorFromSales(
  salesData,
  { viewPeriod = null, sources = ["order_delivery"] } = {}
) {
  const map = new Map();
  const allowedSources = new Set(sources.map((s) => String(s).toLowerCase()));

  for (const record of salesData || []) {
    const src = String(record?.source || "").toLowerCase();
    if (allowedSources.size > 0 && src && !allowedSources.has(src)) continue;

    const code = resolveDistributorCode(record);
    if (!code) continue;

    const invoiceDate = parseDispatchDate(record.invoiceDate ?? record.invoice_date);
    if (!invoiceDate || !shouldCountLiftForViewPeriod(invoiceDate, viewPeriod)) continue;

    addLiftToMap(map, code, {
      CSD_PC: num(record.csdPC ?? record.csd_pc),
      CSD_UC: num(record.csdUC ?? record.csd_uc),
      Water_PC: num(record.waterPC ?? record.water_pc),
      Water_UC: num(record.waterUC ?? record.water_uc),
    });
  }

  return map;
}

export function buildSalesLiftKeySet(salesData, options = {}) {
  const keys = new Set();
  const { viewPeriod = null, sources = ["order_delivery"] } = options;
  const allowedSources = new Set(sources.map((s) => String(s).toLowerCase()));

  for (const record of salesData || []) {
    const src = String(record?.source || "").toLowerCase();
    if (allowedSources.size > 0 && src && !allowedSources.has(src)) continue;

    const code = resolveDistributorCode(record);
    const inv = String(
      record.invoiceNumber ?? record.invoice_number ?? record.orderNumber ?? record.order_number ?? ""
    ).trim();
    if (!code || !inv) continue;

    const invoiceDate = parseDispatchDate(record.invoiceDate ?? record.invoice_date);
    if (!invoiceDate || !shouldCountLiftForViewPeriod(invoiceDate, viewPeriod)) continue;

    keys.add(salesLiftKey(code, inv));
  }
  return keys;
}

export function aggregateAchievedByDistributorFromOrders(
  orders,
  salesData,
  { viewPeriod = null } = {}
) {
  const map = new Map();
  const salesKeys = buildSalesLiftKeySet(salesData, { viewPeriod, sources: ["order_delivery"] });

  for (const order of orders || []) {
    if (resolveOrderStatus(order) !== ORDER_STATUS.DELIVERED) continue;

    const code = resolveOrderDistributorCode(order);
    if (!code) continue;

    const dispatchAt = parseDispatchDate(
      order.delivered_at ??
        order.deliveredAt ??
        order.dispatched_at ??
        order.dispatchedAt ??
        order.status_updated_at ??
        order.statusUpdatedAt
    );
    if (!dispatchAt || !shouldCountLiftForViewPeriod(dispatchAt, viewPeriod)) continue;

    const orderNum = String(order.orderNumber ?? order.order_number ?? "").trim();
    if (orderNum && salesKeys.has(salesLiftKey(code, orderNum))) continue;

    const totals = getOrderAchievementTotals(order);
    const lift = {
      CSD_PC: totals.csdPC,
      CSD_UC: totals.csdUC,
      Water_PC: totals.waterPC,
      Water_UC: totals.waterUC,
    };
    if (lift.CSD_PC + lift.CSD_UC + lift.Water_PC + lift.Water_UC <= 0) continue;

    addLiftToMap(map, code, lift);
  }

  return map;
}

export function mergeAchievedMaps(...maps) {
  const out = new Map();
  for (const map of maps) {
    if (!map) continue;
    for (const [code, achieved] of map.entries()) {
      const prev = out.get(code) || { ...EMPTY_ACHIEVED };
      out.set(code, addAchieved(prev, achieved));
    }
  }
  return out;
}

/**
 * Performance table achieved for the active target period view.
 * Late dispatches (after period end) count toward the next period, not the current one.
 * When sales_data is empty (e.g. after Clear data), do not fall back to delivered orders.
 */
export function buildPerformanceAchievedByDistributor(salesData, orders, { viewPeriod = null } = {}) {
  const fromSales = aggregateAchievedByDistributorFromSales(salesData, { viewPeriod });
  if (!Array.isArray(salesData) || salesData.length === 0) {
    return fromSales;
  }
  const fromOrders = aggregateAchievedByDistributorFromOrders(orders, salesData, { viewPeriod });
  return mergeAchievedMaps(fromSales, fromOrders);
}
