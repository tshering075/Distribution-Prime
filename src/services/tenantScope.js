/**
 * Active-tenant context for multi-tenant SaaS.
 * Stored in session + localStorage so distributor sessions survive browser restarts.
 */

export const DEFAULT_ORGANIZATION_SLUG = 'default';
export const DEFAULT_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';

const ORG_ID_KEY = 'active_organization_id';
const ORG_SLUG_KEY = 'active_organization_slug';
const ORG_NAME_KEY = 'active_organization_name';
const LAST_WORKSPACE_SLUG_KEY = 'last_workspace_slug';

function persist(key, value) {
  if (value == null || value === '') {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
    return;
  }
  const s = String(value);
  sessionStorage.setItem(key, s);
  localStorage.setItem(key, s);
}

/** @returns {string|null} */
export function getActiveOrganizationId() {
  return sessionStorage.getItem(ORG_ID_KEY) || localStorage.getItem(ORG_ID_KEY) || null;
}

/** @returns {string|null} */
export function getActiveOrganizationSlug() {
  return sessionStorage.getItem(ORG_SLUG_KEY) || localStorage.getItem(ORG_SLUG_KEY) || null;
}

/** @returns {string|null} */
export function getActiveOrganizationName() {
  return sessionStorage.getItem(ORG_NAME_KEY) || localStorage.getItem(ORG_NAME_KEY) || null;
}

/** Last workspace slug used at sign-in (kept across logout). */
export function getLastWorkspaceSlug() {
  return localStorage.getItem(LAST_WORKSPACE_SLUG_KEY) || null;
}

/** Tenant-branded login path for the active or last-used workspace. */
export function getWorkspaceLoginPath(slug) {
  const resolved = slug || getLastWorkspaceSlug() || DEFAULT_ORGANIZATION_SLUG;
  return `/w/${encodeURIComponent(resolved)}/login`;
}

/**
 * @param {{ id: string, slug?: string, name?: string }} org
 */
export function setActiveOrganization(org) {
  if (!org?.id) return;
  persist(ORG_ID_KEY, org.id);
  if (org.slug) {
    persist(ORG_SLUG_KEY, org.slug);
    localStorage.setItem(LAST_WORKSPACE_SLUG_KEY, String(org.slug));
  }
  if (org.name) persist(ORG_NAME_KEY, org.name);
}

export function clearActiveOrganization() {
  [ORG_ID_KEY, ORG_SLUG_KEY, ORG_NAME_KEY].forEach((key) => {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
}

/**
 * Chain .eq('organization_id', …) on a filter builder (after .select / .update / .delete).
 * @param {object} query
 * @param {string} [organizationIdOverride]
 */
export function applyOrgFilter(query, organizationIdOverride) {
  const orgId = organizationIdOverride ?? getActiveOrganizationId();
  if (!orgId || !query) return query;
  if (typeof query.eq !== 'function') {
    console.warn(
      'applyOrgFilter: .eq is not available — use wrapTenantTableQuery(supabase.from(table)) or call after .select()'
    );
    return query;
  }
  return query.eq('organization_id', orgId);
}

function withOrgRows(data, orgId) {
  if (!orgId || data == null) return data;
  if (Array.isArray(data)) {
    return data.map((row) =>
      row && typeof row === 'object' ? { ...row, organization_id: orgId } : row
    );
  }
  if (typeof data === 'object') {
    return { ...data, organization_id: orgId };
  }
  return data;
}

/**
 * Wraps supabase.from(table) so organization_id is applied after .select/.update/.delete
 * and merged into .insert/.upsert payloads. Required because .eq() is not on the raw query builder.
 * @param {object} tableQuery supabase.from('table')
 * @param {string} [organizationIdOverride]
 */
export function wrapTenantTableQuery(tableQuery, organizationIdOverride) {
  const orgId = organizationIdOverride ?? getActiveOrganizationId();
  if (!orgId || !tableQuery) return tableQuery;

  const addOrgEq = (filterBuilder) => applyOrgFilter(filterBuilder, orgId);

  return new Proxy(tableQuery, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value !== 'function') return value;

      if (prop === 'select') {
        return (...args) => addOrgEq(value.apply(target, args));
      }
      if (prop === 'update') {
        return (...args) => addOrgEq(value.apply(target, args));
      }
      if (prop === 'delete') {
        return (...args) => addOrgEq(value.apply(target, args));
      }
      if (prop === 'insert') {
        return (data, ...args) => value.apply(target, [withOrgRows(data, orgId), ...args]);
      }
      if (prop === 'upsert') {
        return (data, ...args) => value.apply(target, [withOrgRows(data, orgId), ...args]);
      }
      return value.bind(target);
    },
  });
}

/**
 * @param {Record<string, unknown>} payload
 * @param {string} [organizationIdOverride]
 */
export function withOrgPayload(payload, organizationIdOverride) {
  const orgId = organizationIdOverride ?? getActiveOrganizationId();
  if (!orgId) return payload;
  return { ...payload, organization_id: orgId };
}
