/**
 * Platform operator (SaaS owner) APIs — cross-tenant management.
 * Requires platform_admins row + supabase/platform_admin.sql (+ v2 for full metrics).
 */

import { supabase } from '../supabase';
import { clearActiveOrganization, DEFAULT_ORGANIZATION_ID } from './tenantScope';
import { firstRow } from '../utils/supabaseRows';

export { DEFAULT_ORGANIZATION_ID as PROTECTED_DEFAULT_ORG_ID };

function missingRpc(error) {
  const code = error?.code || '';
  const msg = String(error?.message || '');
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    /function.*does not exist/i.test(msg) ||
    /could not find the function/i.test(msg)
  );
}

export async function checkPlatformAdmin() {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc('is_platform_admin');
    if (error) {
      if (missingRpc(error)) {
        console.warn('Platform admin RPC missing — run supabase/platform_admin.sql');
        return false;
      }
      console.warn('checkPlatformAdmin:', error);
      return false;
    }
    return !!data;
  } catch {
    return false;
  }
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function signInPlatformAdmin(email, password) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: String(email || '').trim().toLowerCase(),
    password: String(password || ''),
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Sign in failed');

  const allowed = await checkPlatformAdmin();
  if (!allowed) {
    await supabase.auth.signOut();
    throw new Error(
      'This account is not authorized for the platform console. Ask the product owner to add you to platform_admins in Supabase.'
    );
  }

  clearActiveOrganization();

  return {
    uid: authData.user.id,
    email: authData.user.email,
    session: authData.session,
  };
}

/** @param {object} row */
export function normalizePlatformOrgRow(row) {
  if (!row) return row;
  return {
    ...row,
    distributor_count: Number(row.distributor_count ?? 0),
    admin_count: Number(row.admin_count ?? 0),
    member_count: Number(row.member_count ?? 0),
    orders_count: Number(row.orders_count ?? 0),
    sales_count: Number(row.sales_count ?? 0),
    targets_count: Number(row.targets_count ?? 0),
    schemes_count: Number(row.schemes_count ?? 0),
    pending_invites_count: Number(row.pending_invites_count ?? 0),
  };
}

export async function listPlatformOrganizations() {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase.rpc('platform_list_organizations');
  if (error) {
    if (missingRpc(error)) {
      throw new Error('Platform console is not set up. Run supabase/platform_admin.sql in Supabase SQL Editor.');
    }
    throw error;
  }
  return (data || []).map(normalizePlatformOrgRow);
}

/**
 * @param {string} organizationId
 */
export async function listTenantStaff(organizationId) {
  if (!supabase) throw new Error('Supabase not initialized');
  if (!organizationId) return [];

  const { data, error } = await supabase.rpc('platform_list_tenant_staff', {
    p_org_id: organizationId,
  });

  if (error) {
    if (missingRpc(error)) {
      console.warn('platform_list_tenant_staff missing — run supabase/platform_admin_v2.sql');
      return [];
    }
    throw error;
  }
  return data || [];
}

/**
 * @param {string} organizationId
 * @param {{ status?: string, name?: string }} patch
 */
/**
 * Permanently delete a workspace and all tenant-scoped data in Supabase.
 * @param {string} organizationId
 */
export async function deletePlatformOrganization(organizationId) {
  if (!supabase) throw new Error('Supabase not initialized');
  if (!organizationId) throw new Error('Organization id is required');

  const { data, error } = await supabase.rpc('platform_delete_organization', {
    p_org_id: organizationId,
  });

  if (error) {
    if (missingRpc(error)) {
      throw new Error(
        'Delete is not set up. Run supabase/platform_delete_organization.sql in Supabase SQL Editor.'
      );
    }
    throw error;
  }
  return !!data;
}

export async function updatePlatformOrganization(organizationId, patch) {
  if (!supabase) throw new Error('Supabase not initialized');
  if (!organizationId) throw new Error('Organization id is required');

  const { data, error } = await supabase.rpc('platform_update_organization', {
    p_org_id: organizationId,
    p_status: patch.status ?? null,
    p_plan: null,
    p_name: patch.name ?? null,
  });

  if (error) throw error;
  const row = firstRow(data);
  if (!row) throw new Error('Update failed');
  return row;
}

export function buildWorkspaceLoginUrl(slug) {
  const base = `${window.location.origin}${process.env.PUBLIC_URL || ''}`;
  return `${base}/w/${encodeURIComponent(slug)}/login`;
}

export function buildWorkspaceSignupUrl() {
  return `${window.location.origin}${process.env.PUBLIC_URL || ''}/signup`;
}

/**
 * @param {Array<object>} orgs
 */
export function exportTenantsCsv(orgs) {
  const headers = [
    'name',
    'slug',
    'status',
    'distributors',
    'admins',
    'members',
    'orders',
    'sales_rows',
    'pending_invites',
    'created_at',
    'updated_at',
  ];
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(','),
    ...orgs.map((o) =>
      [
        o.name,
        o.slug,
        o.status,
        o.distributor_count,
        o.admin_count,
        o.member_count,
        o.orders_count,
        o.sales_count,
        o.pending_invites_count,
        o.created_at,
        o.updated_at,
      ]
        .map(escape)
        .join(',')
    ),
  ];
  return lines.join('\n');
}

export function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const PLATFORM_STATUSES = ['active', 'trial', 'suspended'];

export const PLATFORM_ADMIN_ROLES = ['owner', 'operator', 'support'];

export const STATUS_LABELS = {
  active: 'Active',
  trial: 'Trial',
  suspended: 'Suspended',
};

export const PLATFORM_ROLE_LABELS = {
  owner: 'Owner',
  operator: 'Operator',
  support: 'Support',
};

function isAuthEmailAlreadyRegistered(error) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('user already registered')
  );
}

export async function listPlatformAdmins() {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase.rpc('platform_list_admins');
  if (error) {
    if (missingRpc(error)) {
      throw new Error(
        'Platform user management is not set up. Run supabase/add_platform_admin_users.sql in Supabase SQL Editor.'
      );
    }
    throw error;
  }
  return data || [];
}

async function registerPlatformAdminRow(userId, email, role) {
  const { data, error } = await supabase.rpc('platform_register_admin', {
    p_user_id: userId,
    p_email: email,
    p_role: role,
  });

  if (error) {
    if (missingRpc(error)) {
      throw new Error(
        'Platform user management is not set up. Run supabase/add_platform_admin_users.sql in Supabase SQL Editor.'
      );
    }
    throw error;
  }

  const row = firstRow(Array.isArray(data) ? data : data ? [data] : []);
  if (!row) throw new Error('Failed to save platform operator');
  return row;
}

/**
 * Create a platform console operator (Supabase Auth + platform_admins row).
 * @param {{ email: string, password: string, role?: string }} params
 */
export async function createPlatformAdminAccount({ email, password, role = 'operator' }) {
  if (!supabase) throw new Error('Supabase not initialized');

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedRole = String(role || 'operator').trim().toLowerCase();

  if (!normalizedEmail || !password) {
    throw new Error('Email and password are required');
  }
  if (!PLATFORM_ADMIN_ROLES.includes(normalizedRole)) {
    throw new Error('Invalid role');
  }

  const existing = await listPlatformAdmins();
  if (existing.some((row) => String(row.email || '').toLowerCase() === normalizedEmail)) {
    throw new Error('This email is already a platform operator');
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: String(password),
    options: {
      data: {
        platform_role: normalizedRole,
      },
    },
  });

  if (authError) {
    if (isAuthEmailAlreadyRegistered(authError)) {
      const { data, error } = await supabase.rpc('platform_link_auth_user_as_platform_admin', {
        p_email: normalizedEmail,
        p_role: normalizedRole,
      });
      if (error) {
        if (missingRpc(error)) {
          throw new Error(
            'Platform user management is not set up. Run supabase/add_platform_admin_users.sql in Supabase SQL Editor.'
          );
        }
        throw error;
      }
      const row = firstRow(Array.isArray(data) ? data : data ? [data] : []);
      if (!row) throw new Error('Failed to link existing Auth user as platform operator');
      return row;
    }
    throw authError;
  }

  if (!authData?.user?.id) {
    throw new Error('Failed to create Supabase Auth user');
  }

  return registerPlatformAdminRow(authData.user.id, normalizedEmail, normalizedRole);
}

/**
 * Remove platform operator access (Auth user is kept).
 * @param {string} userId
 */
export async function removePlatformAdmin(userId) {
  if (!supabase) throw new Error('Supabase not initialized');
  if (!userId) throw new Error('User id is required');

  const { data, error } = await supabase.rpc('platform_remove_admin', {
    p_user_id: userId,
  });

  if (error) {
    if (missingRpc(error)) {
      throw new Error(
        'Platform user management is not set up. Run supabase/add_platform_admin_users.sql in Supabase SQL Editor.'
      );
    }
    throw error;
  }

  return !!data;
}
