import { getActiveOrganizationId } from "../services/tenantScope";

export const WORKSPACE_INVENTORY_STORAGE_KEY = "workspace_inventory";

export function getWorkspaceInventoryStorageKey(organizationId) {
  const orgId = organizationId || getActiveOrganizationId();
  return orgId ? `${WORKSPACE_INVENTORY_STORAGE_KEY}_${orgId}` : WORKSPACE_INVENTORY_STORAGE_KEY;
}

export function readWorkspaceInventoryFromLocalStorage(organizationId) {
  try {
    const key = getWorkspaceInventoryStorageKey(organizationId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeWorkspaceInventoryToLocalStorage(payload, organizationId) {
  const key = getWorkspaceInventoryStorageKey(organizationId);
  localStorage.setItem(key, JSON.stringify(payload));
}
