import {
  getTenantScopedStorageKey,
  mayReadLegacyStorage,
  readTenantJson,
  writeTenantJson,
} from "./tenantLocalStorage";
import { getActiveOrganizationId } from "../services/tenantScope";

export const GLOBAL_GST_STORAGE_KEY = "coke_global_gst_enabled";

/** All regions shown in GST settings (includes Northern even if no distributors yet). */
export const DEFAULT_GST_REGIONS = ["Southern", "Western", "Eastern", "Northern"];

export function normalizeGstRegionName(region) {
  const r = String(region || "").trim();
  if (r === "North") return "Northern";
  return r;
}

const DEFAULT_GST_POLICY = {
  defaultEnabled: true,
  regionEnabled: {},
  distributorEnabled: {},
};

export function normalizeGlobalGstEnabled(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "on" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "off" || v === "no") return false;
  }
  return fallback;
}

export function normalizeGlobalGstPolicy(input) {
  if (!input || typeof input !== "object") return { ...DEFAULT_GST_POLICY };
  const defaultEnabled = normalizeGlobalGstEnabled(input.defaultEnabled, true);
  const regionEnabled = {};
  const distributorEnabled = {};
  const rawMap = input.regionEnabled;
  if (rawMap && typeof rawMap === "object") {
    Object.entries(rawMap).forEach(([region, enabled]) => {
      if (!region) return;
      regionEnabled[String(region)] = normalizeGlobalGstEnabled(enabled, defaultEnabled);
    });
  }
  const rawDistributorMap = input.distributorEnabled;
  if (rawDistributorMap && typeof rawDistributorMap === "object") {
    Object.entries(rawDistributorMap).forEach(([code, enabled]) => {
      if (!code) return;
      distributorEnabled[String(code)] = normalizeGlobalGstEnabled(enabled, defaultEnabled);
    });
  }
  return { defaultEnabled, regionEnabled, distributorEnabled };
}

export function resolveGstEnabledForRegion(policy, regionName, distributorCode) {
  const normalized = normalizeGlobalGstPolicy(policy);
  const codeKey = distributorCode != null ? String(distributorCode).trim() : "";
  if (codeKey && Object.prototype.hasOwnProperty.call(normalized.distributorEnabled, codeKey)) {
    return !!normalized.distributorEnabled[codeKey];
  }
  const key = normalizeGstRegionName(regionName);
  if (key && Object.prototype.hasOwnProperty.call(normalized.regionEnabled, key)) {
    return !!normalized.regionEnabled[key];
  }
  return !!normalized.defaultEnabled;
}

function parseLegacyGstRaw(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return normalizeGlobalGstPolicy(parsed);
    }
  } catch {
    // Older boolean-only local format.
  }
  return {
    defaultEnabled: normalizeGlobalGstEnabled(raw, true),
    regionEnabled: {},
    distributorEnabled: {},
  };
}

export function readGlobalGstPolicyFromLocalStorage(organizationId) {
  try {
    const orgId = organizationId ?? getActiveOrganizationId();
    const scopedKey = getTenantScopedStorageKey(GLOBAL_GST_STORAGE_KEY, orgId);
    let raw = localStorage.getItem(scopedKey);
    if (!raw && mayReadLegacyStorage(orgId)) {
      raw = localStorage.getItem(GLOBAL_GST_STORAGE_KEY);
    }
    if (!raw) {
      const fromJson = readTenantJson(GLOBAL_GST_STORAGE_KEY, orgId);
      if (fromJson) return normalizeGlobalGstPolicy(fromJson);
      return { ...DEFAULT_GST_POLICY };
    }
    return parseLegacyGstRaw(raw);
  } catch {
    return { ...DEFAULT_GST_POLICY };
  }
}

export function writeGlobalGstPolicyToLocalStorage(policy, organizationId) {
  writeTenantJson(
    GLOBAL_GST_STORAGE_KEY,
    normalizeGlobalGstPolicy(policy),
    organizationId
  );
}

// Backward-compatible helpers used in some places.
export function readGlobalGstEnabledFromLocalStorage(defaultValue = true) {
  return normalizeGlobalGstEnabled(
    readGlobalGstPolicyFromLocalStorage().defaultEnabled,
    defaultValue
  );
}

export function writeGlobalGstEnabledToLocalStorage(enabled) {
  writeGlobalGstPolicyToLocalStorage({
    defaultEnabled: !!enabled,
    regionEnabled: {},
    distributorEnabled: {},
  });
}
