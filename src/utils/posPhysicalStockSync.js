import { ORDER_STATUS, resolveOrderStatus } from "./orderStatus";
import { resolveOrderDistributorCode } from "../services/deliveredOrderAchievement";

function isPhysicalStockDispatchApplied(order) {
  return Boolean(order?.physicalStockDispatchApplied || order?.physical_stock_dispatch_applied);
}

/**
 * After POS saves physical stock that included uncredited dispatch primary sale,
 * flag delivered orders so primary is not double-counted on the next sale.
 */
export async function flagUncreditedDeliveredOrdersPhysicalStockApplied(
  orders,
  distributorCode,
  identityFallback = null
) {
  const code = String(distributorCode || "").trim();
  if (!code || !Array.isArray(orders) || orders.length === 0) return;

  const pending = orders.filter((order) => {
    if (resolveOrderStatus(order) !== ORDER_STATUS.DELIVERED) return false;
    if (resolveOrderDistributorCode(order) !== code) return false;
    return !isPhysicalStockDispatchApplied(order);
  });

  if (pending.length === 0) return;

  const { patchOrderFields } = await import("../services/supabaseService");
  const flag = {
    physical_stock_dispatch_applied: true,
    physicalStockDispatchApplied: true,
  };

  for (const order of pending) {
    if (!order?.id && !identityFallback) continue;
    try {
      await patchOrderFields(order.id ?? null, flag, identityFallback);
      order.physical_stock_dispatch_applied = true;
      order.physicalStockDispatchApplied = true;
    } catch (err) {
      console.warn("Could not flag order physical stock dispatch applied:", order?.id, err);
    }
  }
}
