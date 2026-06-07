/** Backup / offline cache for product catalogue (mirrors Supabase payload). */
import { ensureProductCatalog, normalizeProductCatalogPayload } from "./productCatalog";
import { getActiveOrganizationId } from "../services/tenantScope";
import {
  getTenantScopedStorageKey,
  mayReadLegacyStorage,
  readTenantJson,
  writeTenantJson,
} from "./tenantLocalStorage";

/** Legacy global key (pre–multi-tenant). */
export const PRODUCT_RATES_STORAGE_KEY = "coke_product_rates";

/** Per-workspace localStorage key. */
export function getProductRatesStorageKey(organizationId) {
  return getTenantScopedStorageKey(PRODUCT_RATES_STORAGE_KEY, organizationId);
}

export function normalizeProductRatesPayload(parsed) {
  return normalizeProductCatalogPayload(parsed);
}

export function readProductRatesMetaFromLocalStorage(organizationId) {
  try {
    const parsed = readTenantJson(PRODUCT_RATES_STORAGE_KEY, organizationId);
    if (!parsed) return null;
    return parsed?.savedAt ? { savedAt: parsed.savedAt } : null;
  } catch {
    return null;
  }
}

export function readProductRatesFromLocalStorage(organizationId) {
  try {
    const orgId = organizationId ?? getActiveOrganizationId();
    const scopedKey = getProductRatesStorageKey(orgId);
    let raw = localStorage.getItem(scopedKey);
    if (!raw && mayReadLegacyStorage(orgId)) {
      raw = localStorage.getItem(PRODUCT_RATES_STORAGE_KEY);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return ensureProductCatalog(parsed);
  } catch (e) {
    console.warn("readProductRatesFromLocalStorage:", e);
    return null;
  }
}

export function writeProductRatesToLocalStorage(data, organizationId) {
  try {
    const catalog = ensureProductCatalog(data);
    writeTenantJson(
      PRODUCT_RATES_STORAGE_KEY,
      {
        ...catalog,
        savedAt: new Date().toISOString(),
      },
      organizationId
    );
  } catch (e) {
    console.error("writeProductRatesToLocalStorage:", e);
  }
}
