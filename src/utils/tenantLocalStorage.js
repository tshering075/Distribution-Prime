/**
 * Per-workspace browser cache keys. Legacy global keys apply only to the migrated default org.
 */
import {
  DEFAULT_ORGANIZATION_ID,
  getActiveOrganizationId,
} from '../services/tenantScope';

export { DEFAULT_ORGANIZATION_ID };

export function getTenantScopedStorageKey(baseKey, organizationId) {
  const orgId = organizationId ?? getActiveOrganizationId();
  return orgId ? `${baseKey}:${orgId}` : baseKey;
}

/** Legacy unscoped keys may be read only for the default migrated workspace. */
export function mayReadLegacyStorage(organizationId) {
  const orgId = organizationId ?? getActiveOrganizationId();
  return !orgId || orgId === DEFAULT_ORGANIZATION_ID;
}

export function readTenantJson(baseKey, organizationId) {
  try {
    const scopedKey = getTenantScopedStorageKey(baseKey, organizationId);
    let raw = localStorage.getItem(scopedKey);
    if (!raw && scopedKey !== baseKey && mayReadLegacyStorage(organizationId)) {
      raw = localStorage.getItem(baseKey);
    }
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeTenantJson(baseKey, value, organizationId) {
  try {
    localStorage.setItem(
      getTenantScopedStorageKey(baseKey, organizationId),
      JSON.stringify(value)
    );
  } catch {
    /* ignore */
  }
}

export function removeTenantJson(baseKey, organizationId) {
  try {
    localStorage.removeItem(getTenantScopedStorageKey(baseKey, organizationId));
  } catch {
    /* ignore */
  }
}
