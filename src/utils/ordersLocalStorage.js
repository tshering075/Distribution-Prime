import { getActiveOrganizationId } from '../services/tenantScope';
import {
  getTenantScopedStorageKey,
  readTenantJson,
  writeTenantJson,
} from './tenantLocalStorage';

export const ORDERS_STORAGE_KEY = 'coke_orders';

export function readOrdersCache() {
  const data = readTenantJson(ORDERS_STORAGE_KEY, getActiveOrganizationId());
  return Array.isArray(data) ? data : [];
}

export function writeOrdersCache(orders) {
  writeTenantJson(ORDERS_STORAGE_KEY, orders, getActiveOrganizationId());
}

export function ordersCacheStorageKey() {
  return getTenantScopedStorageKey(ORDERS_STORAGE_KEY, getActiveOrganizationId());
}
