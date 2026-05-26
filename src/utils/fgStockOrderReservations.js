/**
 * Cases reserved against FG opening stock from the distributor's own orders.
 * Rejected orders do not reserve; canceled/deleted orders are absent from the list.
 */

function normalizeStatus(status) {
  return String(status ?? "pending")
    .trim()
    .toLowerCase();
}

/** Pending / in-flight / approved orders still count against availability; rejected does not. */
export function orderReservesFgStock(status) {
  return normalizeStatus(status) !== "rejected";
}

/**
 * @param {Array} orders
 * @param {(order: object) => string} getOrderStatus
 * @param {{ excludeOrderKey?: string | null, getOrderKey?: (order: object) => string }} [opts]
 * @returns {Record<string, number>} sku name -> total cases
 */
export function sumReservedCasesBySku(orders, getOrderStatus, opts = {}) {
  const exclude = opts.excludeOrderKey != null ? String(opts.excludeOrderKey) : null;
  const getKey = opts.getOrderKey;
  const map = {};
  if (!Array.isArray(orders)) return map;

  for (const order of orders) {
    const st = getOrderStatus ? getOrderStatus(order) : order?.status;
    if (!orderReservesFgStock(st)) continue;
    if (exclude && getKey && getKey(order) === exclude) continue;

    const data = order?.data;
    if (!Array.isArray(data)) continue;
    for (const line of data) {
      const sku = line?.sku;
      if (!sku) continue;
      const cases = Number(line?.cases ?? line?.finalCases ?? 0);
      if (!Number.isFinite(cases) || cases <= 0) continue;
      map[sku] = (map[sku] || 0) + cases;
    }
  }

  return map;
}
