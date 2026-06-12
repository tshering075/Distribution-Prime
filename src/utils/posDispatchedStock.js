/**
 * Delivered / dispatched orders as inbound stock for distributor POS.
 */

import { coerceOrderLineData } from "../services/deliveredOrderAchievement";
import { normalizeForStockMatch } from "./fgStockSkuMatch";
import { ORDER_STATUS, normalizeOrderStatus } from "./orderStatus";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function resolveOrderId(order) {
  return String(
    order?.orderNumber ?? order?.order_number ?? order?.id ?? ""
  ).trim();
}

export function resolveOrderDeliveredLabel(order) {
  const raw =
    order?.delivered_at ??
    order?.deliveredAt ??
    order?.dispatched_at ??
    order?.dispatchedAt ??
    order?.status_updated_at ??
    order?.statusUpdatedAt ??
    order?.createdAt ??
    order?.created_at;
  if (!raw) return "—";
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function getDeliveredOrdersForDistributor(orders, distributorCode) {
  const code = String(distributorCode || "").trim();
  if (!code) return [];

  return (orders || [])
    .filter((order) => normalizeOrderStatus(order?.status) === ORDER_STATUS.DELIVERED)
    .filter((order) => {
      const oc = String(order?.distributorCode ?? order?.distributor_code ?? "").trim();
      return oc === code;
    })
    .sort((a, b) => {
      const ta = new Date(
        a?.delivered_at ?? a?.deliveredAt ?? a?.createdAt ?? a?.created_at ?? 0
      ).getTime();
      const tb = new Date(
        b?.delivered_at ?? b?.deliveredAt ?? b?.createdAt ?? b?.created_at ?? 0
      ).getTime();
      return tb - ta;
    });
}

function matchCatalogSku(orderSku, catalogSkuNames) {
  const orderNorm = normalizeForStockMatch(orderSku);
  if (!orderNorm) return String(orderSku || "").trim();
  for (const name of catalogSkuNames || []) {
    const catNorm = normalizeForStockMatch(name);
    if (!catNorm) continue;
    if (orderNorm === catNorm || orderNorm.includes(catNorm) || catNorm.includes(orderNorm)) {
      return String(name).trim();
    }
  }
  return String(orderSku).trim();
}

/** Aggregate inbound cases per catalogue SKU from delivered orders. */
export function buildDispatchedInboundBySku(deliveredOrders, catalogSkuNames) {
  const map = new Map();
  for (const order of deliveredOrders || []) {
    for (const line of coerceOrderLineData(order?.data)) {
      const qty = num(line?.cases) || num(line?.quantity);
      if (qty <= 0) continue;
      const sku = matchCatalogSku(line?.sku, catalogSkuNames);
      if (!sku) continue;
      const key = sku.toUpperCase();
      const prev = map.get(key) || { sku, qty: 0, orderIds: new Set() };
      prev.qty += qty;
      prev.orderIds.add(resolveOrderId(order));
      map.set(key, prev);
    }
  }
  return map;
}

/** Flat list of delivered orders with normalized line items for POS UI. */
export function buildDispatchedOrderCards(deliveredOrders, catalogSkuNames) {
  return (deliveredOrders || []).map((order) => {
    const lines = coerceOrderLineData(order?.data)
      .map((line) => {
        const qty = num(line?.cases) || num(line?.quantity);
        if (qty <= 0) return null;
        return {
          sku: matchCatalogSku(line?.sku, catalogSkuNames),
          qty,
          category: line?.category || "",
        };
      })
      .filter(Boolean);

    const totalCases = lines.reduce((s, l) => s + l.qty, 0);

    return {
      orderId: resolveOrderId(order),
      invoiceNumber: order?.invoiceNumber ?? order?.invoice_number ?? "",
      deliveredLabel: resolveOrderDeliveredLabel(order),
      lines,
      totalCases,
    };
  });
}
