import { DEFAULT_SKUS, DEFAULT_SKU_NAMES, customProductLineName } from "../constants/productSkus";

/** Same list as CokeCalculator built-in CAN lines (for FG stock matching). */
export const BUILT_IN_CAN_PRODUCTS = [
  "COKE CAN 300 ML",
  "FANTA CAN 300 ML",
  "SPRITE CAN 300 ML",
  "DIET COKE CAN 300 ML",
  "COKE ZERO 300 ML",
  "LIMCA CAN 300 ML",
  "THUMS UP CAN 300 ML",
  "SCHWEPPES CAN TONIC WATER",
  "SCHWEPPES CAN SODA WATER",
];

/**
 * All SKU display names that can appear in the calculator for a given rate config.
 * @param {object | null | undefined} productRates - same shape as CokeCalculator `productRates`
 */
export function getAllCalculatorSkuNames(productRates) {
  const names = new Set(DEFAULT_SKUS.map((s) => s.name));
  const rawCustom = Array.isArray(productRates?.customProducts) ? productRates.customProducts : [];
  for (const p of rawCustom) {
    const lineName = customProductLineName(p?.name, p?.sku);
    if (!lineName || DEFAULT_SKU_NAMES.has(lineName)) continue;
    names.add(lineName);
  }
  for (const c of BUILT_IN_CAN_PRODUCTS) names.add(c);
  return [...names];
}
