/**
 * Distributor POS settings: selling rates, default discount, GST toggle.
 * Persisted on distributor.pos_settings (JSONB) with localStorage fallback.
 */

import { getActiveOrganizationId } from "../services/tenantScope";
import { buildCalculatorSkus, num } from "./orderLineCalculation";

const POS_SETTINGS_KEY = "distributor_pos_settings";

export const DEFAULT_POS_SETTINGS = {
  rates: {},
  discountType: "none",
  discountValue: 0,
  gstEnabled: true,
  updatedAt: null,
};

function storageKey(distributorCode) {
  const org = getActiveOrganizationId() || "default";
  return `${POS_SETTINGS_KEY}:${org}:${String(distributorCode || "").trim().toUpperCase()}`;
}

export function readPosSettingsFromLocalStorage(distributorCode) {
  try {
    const raw = localStorage.getItem(storageKey(distributorCode));
    if (!raw) return null;
    return normalizePosSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writePosSettingsToLocalStorage(distributorCode, settings) {
  try {
    localStorage.setItem(storageKey(distributorCode), JSON.stringify(normalizePosSettings(settings)));
    return true;
  } catch {
    return false;
  }
}

export function getRawPosSettingsFromDistributor(distributor) {
  if (!distributor) return null;
  return distributor.pos_settings ?? distributor.posSettings ?? null;
}

export function normalizePosSettings(raw, productRates = null) {
  const base = raw && typeof raw === "object" ? raw : {};
  const ratesIn = base.rates && typeof base.rates === "object" ? base.rates : {};
  const rates = {};

  for (const [sku, value] of Object.entries(ratesIn)) {
    const key = String(sku || "").trim();
    if (!key) continue;
    const n = num(value, -1);
    if (n >= 0) rates[key] = n;
  }

  const discountType = ["none", "percent", "fixed"].includes(base.discountType)
    ? base.discountType
    : DEFAULT_POS_SETTINGS.discountType;
  const discountValue = Math.max(0, num(base.discountValue));

  let gstEnabled = DEFAULT_POS_SETTINGS.gstEnabled;
  if (typeof base.gstEnabled === "boolean") gstEnabled = base.gstEnabled;
  else if (base.gstEnabled != null) gstEnabled = Boolean(base.gstEnabled);

  const settings = {
    rates,
    discountType,
    discountValue,
    gstEnabled,
    updatedAt: base.updatedAt || base.updated_at || null,
  };

  if (productRates) {
    settings.rates = buildDefaultRatesMap(productRates, settings.rates);
  }

  return settings;
}

/** Seed selling rates from catalogue when missing. */
export function buildDefaultRatesMap(productRates, existingRates = {}) {
  const skus = buildCalculatorSkus(productRates);
  const rates = { ...existingRates };
  for (const sku of skus) {
    if (rates[sku.name] == null) {
      rates[sku.name] = num(sku.rate);
    }
  }
  return rates;
}

function settingsTimestamp(settings) {
  if (!settings?.updatedAt) return 0;
  const t = new Date(settings.updatedAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function resolvePosSettings(distributor, distributorCode, productRates) {
  const rawDistributor = getRawPosSettingsFromDistributor(distributor);
  const fromDistributor = rawDistributor ? normalizePosSettings(rawDistributor) : null;
  const fromLocal = readPosSettingsFromLocalStorage(distributorCode);

  let merged = DEFAULT_POS_SETTINGS;
  if (fromDistributor && fromLocal) {
    merged =
      settingsTimestamp(fromLocal) > settingsTimestamp(fromDistributor)
        ? fromLocal
        : fromDistributor;
  } else {
    merged = fromDistributor || fromLocal || DEFAULT_POS_SETTINGS;
  }

  return normalizePosSettings(merged, productRates);
}

export function applyPosRatesToSkus(skus, posSettings) {
  const rates = posSettings?.rates || {};
  return (skus || []).map((sku) => {
    const custom = rates[sku.name];
    const sellingRate = custom != null && num(custom) >= 0 ? num(custom) : num(sku.rate);
    return {
      ...sku,
      catalogRate: num(sku.rate),
      rate: sellingRate,
      hasCustomRate: custom != null && num(custom) !== num(sku.rate),
    };
  });
}

/** Persist POS settings to Supabase (session RPC or admin update) + local cache. */
export async function savePosSettings(distributorCode, settings, { isSupabaseConfigured = false } = {}) {
  const payload = normalizePosSettings(settings);
  writePosSettingsToLocalStorage(distributorCode, payload);

  if (!isSupabaseConfigured) return payload;

  try {
    const { savePosSettingsToSupabase } = await import("../services/posSupabaseService");
    return await savePosSettingsToSupabase(distributorCode, payload);
  } catch (error) {
    const msg = String(error?.message || error);
    const missing =
      error?.code === "PGRST204" ||
      /pos_settings|update_distributor_pos_settings|not found/i.test(msg);
    if (missing) {
      const err = new Error(
        "Saved on this device. Run add_distributor_pos_settings.sql and add_distributor_pos_sales.sql in Supabase."
      );
      err.localOnly = true;
      throw err;
    }
    throw error;
  }
}

export function buildPosSettingsPayload({ rates, discountType, discountValue, gstEnabled }) {
  const cleanRates = {};
  for (const [sku, value] of Object.entries(rates || {})) {
    const key = String(sku || "").trim();
    if (!key) continue;
    const n = num(value, -1);
    if (n >= 0) cleanRates[key] = n;
  }

  return normalizePosSettings({
    rates: cleanRates,
    discountType,
    discountValue,
    gstEnabled,
    updatedAt: new Date().toISOString(),
  });
}
