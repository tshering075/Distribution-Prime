/**
 * POS stock helpers — sellable qty from physical stock, dispatch primary intake,
 * and FIFO deduction that updates physical + secondary sale.
 */

import { normalizeForStockMatch } from "./fgStockSkuMatch";
import {
  createEmptyFifoLot,
  getLotsFromProductRow,
  getRawPhysicalStockFromDistributor,
  normalizePhysicalStockPayload,
  resolvePhysicalStockProductLines,
} from "./physicalStockTemplate";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function hasQty(value) {
  return value !== "" && value != null && Number.isFinite(Number(value));
}

/** Balance cases available for retail (primary intake minus secondary / POS sales). */
export function lotBalanceQty(lot) {
  const opening = num(lot.openingStockQty);
  const primary = num(lot.primarySale);
  const secondary = num(lot.secondarySale);
  return Math.max(0, Math.round(opening + primary - secondary));
}

/** Secondary sale = opening + primary − physical (matches physical stock grid). */
export function recomputeLotSecondary(lot) {
  const opening = num(lot.openingStockQty);
  const primary = num(lot.primarySale);
  const physical = hasQty(lot.physicalStockQty) ? num(lot.physicalStockQty) : null;

  if (physical == null) {
    return { ...lot, secondarySale: hasQty(lot.secondarySale) ? num(lot.secondarySale) : "" };
  }

  return {
    ...lot,
    secondarySale: Math.max(0, Math.round(opening + primary - physical)),
  };
}

/** Undo POS retail on a lot: reduce secondary, restore physical balance. */
export function reversePosSaleOnLot(lot, qtySold) {
  const take = Math.max(0, Math.floor(num(qtySold)));
  if (take <= 0) return lot;

  const opening = num(lot.openingStockQty);
  const primary = num(lot.primarySale);
  const nextSecondary = Math.max(0, num(lot.secondarySale) - take);
  const balance = Math.max(0, Math.round(opening + primary - nextSecondary));

  return {
    ...lot,
    secondarySale: nextSecondary,
    physicalStockQty: balance,
  };
}

/** After POS retail: increase secondary, set physical stock to remaining balance. */
export function applyPosSaleToLot(lot, qtySold) {
  const take = Math.max(0, Math.floor(num(qtySold)));
  if (take <= 0) return lot;

  const opening = num(lot.openingStockQty);
  const primary = num(lot.primarySale);
  const nextSecondary = num(lot.secondarySale) + take;
  const balance = Math.max(0, Math.round(opening + primary - nextSecondary));

  return {
    ...lot,
    secondarySale: nextSecondary,
    physicalStockQty: balance,
  };
}

/**
 * When physical count is missing, derive it from opening + primary − secondary
 * so dispatched (primary) stock is sellable via POS.
 */
export function ensureLotPhysicalInitialized(lot) {
  if (hasQty(lot.physicalStockQty)) return lot;
  const opening = num(lot.openingStockQty);
  const primary = num(lot.primarySale);
  const secondary = num(lot.secondarySale);
  const derived = Math.max(0, Math.round(opening + primary - secondary));
  return { ...lot, physicalStockQty: derived };
}

/** Sellable cases in one FIFO lot (balance from primary minus secondary / POS). */
export function lotSellableQty(lot) {
  const initialized = ensureLotPhysicalInitialized(lot);
  return lotBalanceQty(initialized);
}

/** Sum sellable cases for a product row. */
export function rowSellableQty(row) {
  return getLotsFromProductRow(row).reduce((s, lot) => s + lotSellableQty(lot), 0);
}

/** Sum recorded secondary sale for a product row. */
export function rowSecondaryQty(row) {
  return getLotsFromProductRow(row).reduce((s, lot) => s + num(lot.secondarySale), 0);
}

/** Map SKU (uppercase) → sellable cases for POS. */
export function buildStockAvailabilityMap(physicalStockRows) {
  const map = new Map();
  for (const row of physicalStockRows || []) {
    const sku = String(row?.productSku || "").trim();
    if (!sku) continue;
    map.set(sku.toUpperCase(), rowSellableQty(row));
  }
  return map;
}

/** Map SKU (uppercase) → secondary sale qty (after POS / retail). */
export function buildSecondarySaleMap(physicalStockRows) {
  const map = new Map();
  for (const row of physicalStockRows || []) {
    const sku = String(row?.productSku || "").trim();
    if (!sku) continue;
    map.set(sku.toUpperCase(), rowSecondaryQty(row));
  }
  return map;
}

export function getPhysicalStockRowsFromDistributor(distributor, productRates) {
  const raw = getRawPhysicalStockFromDistributor(distributor);
  const lines = resolvePhysicalStockProductLines(productRates);
  return normalizePhysicalStockPayload(raw, lines).rows;
}

function findRowForSkuKey(rows, skuKey) {
  return (rows || []).find((r) => String(r.productSku || "").trim().toUpperCase() === skuKey) || null;
}

function matchCatalogSkuKey(orderSku, catalogSkuNames) {
  const orderNorm = normalizeForStockMatch(orderSku);
  if (!orderNorm) return null;
  for (const name of catalogSkuNames || []) {
    const catNorm = normalizeForStockMatch(name);
    if (!catNorm) continue;
    if (orderNorm === catNorm) return String(name).trim().toUpperCase();
    if (orderNorm.includes(catNorm) || catNorm.includes(orderNorm)) {
      return String(name).trim().toUpperCase();
    }
  }
  return String(orderSku).trim().toUpperCase();
}

/**
 * Merge dispatched-order inbound qty into availability when physical stock row is empty.
 * Primary sale from dispatch is already on physical stock rows; this helps display inbound totals.
 */
export function mergeDispatchedInboundIntoAvailability(availabilityMap, inboundMap) {
  const merged = new Map(availabilityMap);
  for (const [skuKey, inbound] of inboundMap || []) {
    const current = merged.get(skuKey) || 0;
    if (current <= 0 && inbound > 0) {
      merged.set(skuKey, inbound);
    }
  }
  return merged;
}

export function buildDispatchedInboundMap(deliveredOrders, catalogSkuNames) {
  const map = new Map();
  for (const order of deliveredOrders || []) {
    const lines = Array.isArray(order?.data) ? order.data : [];
    for (const line of lines) {
      const sku = String(line?.sku || "").trim();
      const qty = num(line?.cases) || num(line?.quantity);
      if (!sku || qty <= 0) continue;
      const key = matchCatalogSkuKey(sku, catalogSkuNames);
      map.set(key, (map.get(key) || 0) + qty);
    }
  }
  return map;
}

/**
 * Apply POS retail sales to physical stock (FIFO per SKU lot).
 * Increases secondary sale; physical stock shows remaining balance (primary − secondary).
 */
export function deductStockForPosSale(rows, lineItems) {
  const updated = (rows || []).map((row) => ({
    productSku: row.productSku,
    lots: getLotsFromProductRow(row).map((lot) => ({ ...lot })),
  }));

  const shortages = [];
  const deductions = [];

  for (const item of lineItems || []) {
    const skuKey = String(item.sku || "").trim().toUpperCase();
    const requested = Math.max(0, Math.floor(num(item.qty)));
    if (!skuKey || requested <= 0) continue;

    let row = findRowForSkuKey(updated, skuKey);
    const createdRow = !row;
    if (!row) {
      row = {
        productSku: String(item.sku || "").trim(),
        lots: [createEmptyFifoLot()],
      };
    }

    row.lots = row.lots.map((lot) => ensureLotPhysicalInitialized(lot));

    let remaining = requested;
    for (let i = 0; i < row.lots.length; i++) {
      if (remaining <= 0) break;
      const lot = row.lots[i];
      const avail = lotSellableQty(lot);
      if (avail <= 0) continue;
      const take = Math.min(avail, remaining);
      row.lots[i] = applyPosSaleToLot(lot, take);
      remaining -= take;
    }

    const deducted = requested - remaining;
    if (deducted > 0) {
      if (createdRow) updated.push(row);
      deductions.push({ sku: item.sku, qty: deducted });
    }

    if (remaining > 0) {
      shortages.push({ sku: item.sku, requested, deducted });
    }
  }

  return { rows: updated, shortages, deductions };
}

/**
 * Restore physical stock when a POS sale is deleted (reverse FIFO).
 */
export function restoreStockFromPosSale(rows, lineItems) {
  const updated = (rows || []).map((row) => ({
    productSku: row.productSku,
    lots: getLotsFromProductRow(row).map((lot) => ({ ...lot })),
  }));

  for (const item of lineItems || []) {
    const skuKey = String(item.sku || "").trim().toUpperCase();
    const restoreQty =
      item.stockDeducted != null
        ? Math.max(0, Math.floor(num(item.stockDeducted)))
        : Math.max(0, Math.floor(num(item.qty)));
    const requested = restoreQty;
    if (!skuKey || requested <= 0) continue;

    const row = findRowForSkuKey(updated, skuKey);
    if (!row) continue;

    let remaining = requested;
    const lots = row.lots;
    for (let i = lots.length - 1; i >= 0; i--) {
      if (remaining <= 0) break;
      const lot = lots[i];
      const soldHere = num(lot.secondarySale);
      if (soldHere <= 0) continue;
      const restore = Math.min(soldHere, remaining);
      lots[i] = reversePosSaleOnLot(lot, restore);
      remaining -= restore;
    }
  }

  return { rows: updated };
}

/** Map sale lines to restore payloads using recorded stock deductions when present. */
export function lineItemsForStockRestore(sale) {
  const deductionMap = new Map();
  for (const d of sale?.stockDeductions || []) {
    const key = String(d.sku || "").trim().toUpperCase();
    if (key) deductionMap.set(key, Math.max(0, Math.floor(num(d.qty))));
  }

  return (sale?.lines || []).map((line) => {
    const sku = line.sku || line.name;
    const key = String(sku || "").trim().toUpperCase();
    const stockDeducted = deductionMap.has(key) ? deductionMap.get(key) : undefined;
    return { sku, qty: line.qty, stockDeducted };
  });
}
