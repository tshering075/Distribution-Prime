import { getTenantScopedStorageKey } from './tenantLocalStorage';
import { getActiveOrganizationId } from '../services/tenantScope';

const SESSION_TOKEN_BASE_KEY = 'distributor_session_token';

function storageKey() {
  return getTenantScopedStorageKey(SESSION_TOKEN_BASE_KEY, getActiveOrganizationId());
}

export function setDistributorSessionToken(token) {
  const value = String(token || '').trim();
  if (!value) return;
  try {
    sessionStorage.setItem(storageKey(), value);
    localStorage.setItem(storageKey(), value);
  } catch {
    /* ignore */
  }
}

export function getDistributorSessionToken() {
  try {
    return (
      sessionStorage.getItem(storageKey()) ||
      localStorage.getItem(storageKey()) ||
      ''
    ).trim();
  } catch {
    return '';
  }
}

export function clearDistributorSessionToken() {
  try {
    const key = storageKey();
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
