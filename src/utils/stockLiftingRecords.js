import { ORDER_STATUS, resolveOrderStatus } from "./orderStatus";
import {
  coerceOrderLineData,
  getOrderAchievementTotals,
  normalizeOrderProductsForSalesData,
  resolveOrderDistributorCode,
  resolveOrderNumber,
} from "../services/deliveredOrderAchievement";

function read(row, keys, fallback = null) {
  for (const key of keys) {
    if (row && Object.prototype.hasOwnProperty.call(row, key) && row[key] !== undefined && row[key] != null) {
      return row[key];
    }
  }
  return fallback;
}

/** Normalize a sales_data row (or order-derived row) for StockLiftingRecordsTable. */
export function mapStockLiftingRecord(record) {
  if (!record) return null;
  const inv = read(record, ["invoiceDate", "invoice_date"], null);
  const dateIso = inv ? new Date(inv).toISOString() : null;
  return {
    id: record.id,
    date: dateIso ? dateIso.split("T")[0] : null,
    invoiceDate: inv,
    timestamp: inv,
    created_at: read(record, ["created_at", "createdAt"], inv),
    orderNumber: read(record, ["orderNumber", "order_number"], null),
    invoiceNumber: read(record, ["invoiceNumber", "invoice_number"], null),
    csdPC: Number(read(record, ["csdPC", "csd_pc"], 0) || 0),
    csdUC: Number(read(record, ["csdUC", "csd_uc"], 0) || 0),
    waterPC: Number(read(record, ["waterPC", "water_pc"], 0) || 0),
    waterUC: Number(read(record, ["waterUC", "water_uc"], 0) || 0),
    products: Array.isArray(record.products) ? record.products : [],
    source: record.source || null,
  };
}

function liftInvoiceKey(record) {
  const inv = String(
    record?.invoiceNumber ?? record?.invoice_number ?? record?.orderNumber ?? record?.order_number ?? ""
  ).trim();
  return inv ? inv.toUpperCase() : "";
}

function resolveDispatchTimestamp(order) {
  return (
    order?.delivered_at ||
    order?.deliveredAt ||
    order?.dispatched_at ||
    order?.dispatchedAt ||
    order?.status_updated_at ||
    order?.statusUpdatedAt ||
    order?.created_at ||
    order?.createdAt ||
    new Date().toISOString()
  );
}

/** Build lifting rows from dispatched/delivered orders when sales_data is unavailable. */
export function buildStockLiftingRecordsFromDeliveredOrders(orders, distributorCode) {
  const code = String(distributorCode || "").trim();
  const records = [];

  for (const order of orders || []) {
    if (resolveOrderStatus(order) !== ORDER_STATUS.DELIVERED) continue;

    const orderCode = resolveOrderDistributorCode(order);
    if (code && orderCode && orderCode.toUpperCase() !== code.toUpperCase()) continue;

    const totals = getOrderAchievementTotals(order);
    if (totals.csdPC + totals.csdUC + totals.waterPC + totals.waterUC <= 0) continue;

    const orderNumber = resolveOrderNumber(order);
    const deliveredAt = resolveDispatchTimestamp(order);
    const lines = coerceOrderLineData(order.data);

    records.push(
      mapStockLiftingRecord({
        id: order.id || (orderNumber ? `order-${orderNumber}` : undefined),
        invoiceDate: deliveredAt,
        orderNumber,
        invoiceNumber:
          order.invoiceNumber ??
          order.invoice_number ??
          order.invoiceNo ??
          order.invoice_no ??
          orderNumber,
        csdPC: totals.csdPC,
        csdUC: totals.csdUC,
        waterPC: totals.waterPC,
        waterUC: totals.waterUC,
        products: normalizeOrderProductsForSalesData(lines),
        source: "order_delivery",
      })
    );
  }

  return records.sort((a, b) => {
    const ta = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
    const tb = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
    return tb - ta;
  });
}

/**
 * Prefer sales_data rows; add delivered orders not already represented (by invoice/order number).
 */
export function mergeStockLiftingWithDeliveredOrders(salesRecords, orders, distributorCode) {
  const fromSales = (salesRecords || []).map(mapStockLiftingRecord).filter(Boolean);
  const keys = new Set(fromSales.map(liftInvoiceKey).filter(Boolean));

  const supplemental = buildStockLiftingRecordsFromDeliveredOrders(orders, distributorCode).filter((row) => {
    const key = liftInvoiceKey(row);
    return !key || !keys.has(key);
  });

  return [...fromSales, ...supplemental].sort((a, b) => {
    const ta = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
    const tb = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
    return tb - ta;
  });
}
