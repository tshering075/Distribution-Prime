/** Backup / offline cache for product rates + custom catalogue (mirrors Supabase payload). */
export const PRODUCT_RATES_STORAGE_KEY = "coke_product_rates";

export function normalizeProductRatesPayload(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  return {
    skuRates: parsed.skuRates || {},
    canRate: parsed.canRate,
    customProducts: Array.isArray(parsed.customProducts) ? parsed.customProducts : [],
  };
}

export function readProductRatesFromLocalStorage() {
  try {
    const raw = localStorage.getItem(PRODUCT_RATES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalizeProductRatesPayload(parsed);
  } catch (e) {
    console.warn("readProductRatesFromLocalStorage:", e);
    return null;
  }
}

export function writeProductRatesToLocalStorage(data) {
  try {
    const payload = normalizeProductRatesPayload(data);
    if (!payload) return;
    localStorage.setItem(
      PRODUCT_RATES_STORAGE_KEY,
      JSON.stringify({
        ...payload,
        savedAt: new Date().toISOString(),
      })
    );
  } catch (e) {
    console.error("writeProductRatesToLocalStorage:", e);
  }
}
