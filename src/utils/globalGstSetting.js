export const GLOBAL_GST_STORAGE_KEY = "coke_global_gst_enabled";

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
  const key = regionName != null ? String(regionName).trim() : "";
  if (key && Object.prototype.hasOwnProperty.call(normalized.regionEnabled, key)) {
    return !!normalized.regionEnabled[key];
  }
  return !!normalized.defaultEnabled;
}

export function readGlobalGstPolicyFromLocalStorage() {
  try {
    const raw = localStorage.getItem(GLOBAL_GST_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GST_POLICY };
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
  } catch {
    return { ...DEFAULT_GST_POLICY };
  }
}

export function writeGlobalGstPolicyToLocalStorage(policy) {
  try {
    localStorage.setItem(
      GLOBAL_GST_STORAGE_KEY,
      JSON.stringify(normalizeGlobalGstPolicy(policy))
    );
  } catch {
    /* ignore */
  }
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
