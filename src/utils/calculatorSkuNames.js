import {
  ensureProductCatalog,
  getActiveProducts,
  getAllCatalogLineNames,
  getCatalogProductsGrouped,
  getProductLineName,
} from "./productCatalog";

/**
 * All SKU display names that can appear in the calculator for a given catalogue.
 * @param {object | null | undefined} productRates
 */
export function getAllCalculatorSkuNames(productRates) {
  return getAllCatalogLineNames(productRates);
}

/** @see getCatalogProductsGrouped */
export { getCatalogProductsGrouped, getAllCatalogLineNames };

/** @deprecated Use catalogue CAN category; kept for FG stock heuristics. */
export function isCanCategoryProduct(productRates, skuName) {
  const catalog = ensureProductCatalog(productRates);
  return getActiveProducts(catalog).some(
    (p) => getProductLineName(p) === skuName && p.category === "CAN"
  );
}
