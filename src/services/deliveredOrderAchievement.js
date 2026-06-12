import {
  getDistributorByCode,
  updateDistributor,
  saveSalesData,
  patchOrderFields,
  findSalesDataForDispatchedOrder,
  supabase,
} from "./supabaseService";
import { aggregateOrderLineTotals } from "../utils/orderLineCalculation";
import { getDistributors, saveDistributors } from "../utils/distributorAuth";
import { ORDER_STATUS, resolveOrderStatus } from "../utils/orderStatus";
import { applyDispatchLinesToPrimarySales } from "../utils/dispatchPrimarySales";
import { getRawPhysicalStockFromDistributor } from "../utils/physicalStockTemplate";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Coerce Supabase/json `data` into a line-item array. */
export function coerceOrderLineData(data) {
  if (Array.isArray(data)) return data;
  if (data == null || data === "") return [];
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function isOrderAchievementApplied(order) {
  return Boolean(order?.achievementApplied || order?.achievement_applied);
}

export function resolveOrderDistributorCode(order) {
  return String(
    order?.distributorCode ?? order?.distributor_code ?? order?.distributor ?? ""
  ).trim();
}

export function resolveOrderNumber(order) {
  return String(order?.orderNumber ?? order?.order_number ?? "").trim();
}

/** Map order line items to sales_data.products JSON for reports. */
export function normalizeOrderProductsForSalesData(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => {
      const sku = String(line?.sku || "").trim();
      if (!sku) return null;
      const categoryRaw = String(line?.category || "CSD").trim();
      const category = categoryRaw.toLowerCase() === "water" ? "water" : "csd";
      const quantity = num(line.cases) || num(line.quantity);
      if (quantity <= 0) return null;
      return {
        sku,
        category,
        quantity,
        uc: line.totalUC != null ? num(line.totalUC) : undefined,
      };
    })
    .filter(Boolean);
}

/** PC/UC totals from order header fields or line `data`. */
export function getOrderAchievementTotals(order) {
  if (!order) {
    return { csdPC: 0, csdUC: 0, waterPC: 0, waterUC: 0, totalUC: 0 };
  }

  const header = {
    csdPC: num(order.csdPC ?? order.csd_pc),
    csdUC: num(order.csdUC ?? order.csd_uc),
    waterPC: num(order.waterPC ?? order.water_pc),
    waterUC: num(order.waterUC ?? order.water_uc),
  };
  const headerHasValues =
    header.csdPC > 0 ||
    header.csdUC > 0 ||
    header.waterPC > 0 ||
    header.waterUC > 0;

  if (headerHasValues) {
    return { ...header, totalUC: header.csdUC + header.waterUC };
  }

  const lines = coerceOrderLineData(order.data);
  if (lines.length > 0) {
    const fromLines = aggregateOrderLineTotals(lines);
    return {
      csdPC: num(fromLines.csdPC),
      csdUC: num(fromLines.csdUC),
      waterPC: num(fromLines.waterPC),
      waterUC: num(fromLines.waterUC),
      totalUC: num(fromLines.totalUC) || num(fromLines.csdUC) + num(fromLines.waterUC),
    };
  }

  return { ...header, totalUC: header.csdUC + header.waterUC };
}

function mergeAchieved(current, totals) {
  const base = current || { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 };
  return {
    CSD_PC: num(base.CSD_PC) + totals.csdPC,
    CSD_UC: num(base.CSD_UC) + totals.csdUC,
    Water_PC: num(base.Water_PC) + totals.waterPC,
    Water_UC: num(base.Water_UC) + totals.waterUC,
  };
}

function updateLocalDistributorRecord(distributorCode, patch, distributorName) {
  const distributors = getDistributors();
  const code = String(distributorCode || "").trim();
  const updated = distributors.map((d) => {
    if (String(d.code || "").trim() === code || (distributorName && d.name === distributorName)) {
      return { ...d, ...patch };
    }
    return d;
  });
  saveDistributors(updated);
}

function buildSalesDataPayload(order, totals, distributorName) {
  const distributorCode = resolveOrderDistributorCode(order);
  const orderNumber = resolveOrderNumber(order);
  const deliveredAt =
    order.delivered_at ||
    order.deliveredAt ||
    order.dispatched_at ||
    order.dispatchedAt ||
    order.status_updated_at ||
    order.statusUpdatedAt ||
    new Date().toISOString();

  return {
    distributorCode,
    distributorName: order.distributorName || order.distributor_name || distributorName || distributorCode,
    orderNumber,
    invoiceNumber:
      order.invoiceNumber ??
      order.invoice_number ??
      order.invoiceNo ??
      order.invoice_no ??
      orderNumber,
    invoiceDate: deliveredAt,
    csdPC: totals.csdPC,
    csdUC: totals.csdUC,
    waterPC: totals.waterPC,
    waterUC: totals.waterUC,
    totalUC: totals.totalUC || totals.csdUC + totals.waterUC,
    source: "order_delivery",
    orderId: order.id ?? null,
    products: normalizeOrderProductsForSalesData(coerceOrderLineData(order.data)),
  };
}

/**
 * When shipping marks an order dispatched, credit PC/UC to distributor achievement
 * and insert a sales_data row in Supabase (actual sales for reports & stock lifting).
 *
 * @returns {Promise<{ applied: boolean, skipped?: boolean, salesDataId?: string, totals?: object }>}
 */
export async function applyDeliveredOrderAchievement(order, identityFallback = null) {
  if (!order) {
    return { applied: false, skipped: true, reason: "no_order" };
  }

  const distributorCode = resolveOrderDistributorCode(order);
  const orderNumber = resolveOrderNumber(order);

  if (!distributorCode) {
    throw new Error("Cannot save sales data: order has no distributor code.");
  }

  const totals = getOrderAchievementTotals(order);
  if (totals.csdPC + totals.csdUC + totals.waterPC + totals.waterUC <= 0) {
    return { applied: false, skipped: true, reason: "zero_totals" };
  }

  const deliveredAt =
    order.delivered_at ||
    order.deliveredAt ||
    order.dispatched_at ||
    order.dispatchedAt ||
    order.status_updated_at ||
    order.statusUpdatedAt ||
    new Date().toISOString();

  if (supabase) {
    const existing = await findSalesDataForDispatchedOrder(distributorCode, orderNumber);
    if (existing) {
      if (!isOrderAchievementApplied(order) && (order.id || identityFallback)) {
        await patchOrderFields(
          order.id ?? null,
          {
            achievement_applied: true,
            achievementApplied: true,
            achievement_applied_at: deliveredAt,
          },
          identityFallback
        );
      }
      return {
        applied: false,
        skipped: true,
        reason: "sales_data_exists",
        salesDataId: existing.id,
        totals,
      };
    }
  }

  if (isOrderAchievementApplied(order)) {
    return { applied: false, skipped: true, reason: "already_applied" };
  }

  let updatedAchieved = mergeAchieved(null, totals);
  let salesDataId;

  if (supabase) {
    const dist = await getDistributorByCode(distributorCode);
    if (!dist) {
      throw new Error(`Distributor ${distributorCode} not found.`);
    }
    updatedAchieved = mergeAchieved(dist.achieved, totals);

    const orderLines = coerceOrderLineData(order.data);
    const physical_stock = applyDispatchLinesToPrimarySales(
      getRawPhysicalStockFromDistributor(dist),
      orderLines,
      deliveredAt
    );

    await updateDistributor(distributorCode, {
      achieved: updatedAchieved,
      physical_stock,
    });

    const saved = await saveSalesData(buildSalesDataPayload(order, totals, dist.name));
    salesDataId = saved?.id;

    const achievementFlag = {
      achievement_applied: true,
      achievementApplied: true,
      achievement_applied_at: deliveredAt,
    };

    if (order.id || identityFallback) {
      await patchOrderFields(order.id ?? null, achievementFlag, identityFallback);
    }
  } else {
    const distributors = getDistributors();
    const dist =
      distributors.find((d) => String(d.code || "").trim() === distributorCode) ||
      distributors.find((d) => d.name === order.distributorName);
    updatedAchieved = mergeAchieved(dist?.achieved, totals);
    const orderLines = coerceOrderLineData(order.data);
    const physical_stock = applyDispatchLinesToPrimarySales(
      getRawPhysicalStockFromDistributor(dist),
      orderLines,
      deliveredAt
    );
    updateLocalDistributorRecord(
      distributorCode,
      { achieved: updatedAchieved, physical_stock },
      order.distributorName
    );
  }

  return { applied: true, totals, achieved: updatedAchieved, salesDataId };
}

/**
 * Backfill sales_data for dispatched orders that never got a row (e.g. before this feature).
 * @param {Array} orders
 * @param {number} [limit=40]
 */
export async function backfillDispatchedOrdersToSalesData(orders, limit = 40) {
  if (!supabase || !Array.isArray(orders)) {
    return { processed: 0, applied: 0, skipped: 0, errors: 0 };
  }

  const candidates = orders
    .filter((o) => resolveOrderStatus(o) === ORDER_STATUS.DELIVERED)
    .filter((o) => !isOrderAchievementApplied(o))
    .slice(0, limit);

  let applied = 0;
  let skipped = 0;
  let errors = 0;

  for (const order of candidates) {
    try {
      const identityFallback = {
        distributorCode: resolveOrderDistributorCode(order),
        orderNumber: resolveOrderNumber(order),
      };
      const result = await applyDeliveredOrderAchievement(order, identityFallback);
      if (result.applied) applied += 1;
      else skipped += 1;
    } catch (e) {
      errors += 1;
      console.warn("Backfill sales_data failed for order", resolveOrderNumber(order), e);
    }
  }

  return { processed: candidates.length, applied, skipped, errors };
}
