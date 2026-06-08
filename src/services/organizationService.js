/**
 * Organization (tenant) resolution, signup, and membership.
 */

import { supabase } from '../supabase';
import {
  DEFAULT_ORGANIZATION_SLUG,
  setActiveOrganization,
} from './tenantScope';
import { firstRow, isSingleRowCoerceError } from '../utils/supabaseRows';
import { brandSettingsFromForm } from '../utils/organizationBrand';
import { BRAND_MARK_SRC, BRAND_PRIMARY } from '../constants/brand';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export function normalizeOrganizationSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isValidOrganizationSlug(slug) {
  return SLUG_RE.test(slug);
}

/**
 * @param {string} slug
 * @returns {Promise<{ id: string, slug: string, name: string, plan?: string, status?: string }|null>}
 */
function isMissingRpcError(error) {
  const code = error?.code || '';
  const msg = String(error?.message || '');
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    /function.*does not exist/i.test(msg) ||
    /could not find the function/i.test(msg)
  );
}

export async function getOrganizationBySlug(slug) {
  if (!supabase) return null;
  const normalized = normalizeOrganizationSlug(slug);
  if (!normalized) return null;

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_organization_by_slug', {
    p_slug: normalized,
  });
  if (!rpcError) return firstRow(rpcData);
  if (!isMissingRpcError(rpcError)) {
    if (rpcError.code === '42P01') {
      console.warn('organizations table missing — run MULTI_TENANT_MIGRATION.sql');
      return null;
    }
    throw rpcError;
  }

  const { data, error } = await supabase
    .from('organizations')
    .select('id, slug, name, plan, status, settings')
    .eq('slug', normalized)
    .limit(1);

  if (error) {
    if (error.code === '42P01') {
      console.warn('organizations table missing — run MULTI_TENANT_MIGRATION.sql');
      return null;
    }
    if (isSingleRowCoerceError(error)) return firstRow(data);
    throw error;
  }
  return firstRow(data);
}

/**
 * Resolve tenant from login slug; falls back to default org when column/table missing.
 * @param {string} [slugInput]
 */
export async function resolveOrganizationForLogin(slugInput) {
  const slug = normalizeOrganizationSlug(slugInput) || DEFAULT_ORGANIZATION_SLUG;
  const org = await getOrganizationBySlug(slug);
  if (org) {
    if (org.status === 'suspended') {
      throw new Error('This organization has been suspended. Contact support.');
    }
    setActiveOrganization(org);
    return org;
  }

  if (slug === DEFAULT_ORGANIZATION_SLUG) {
    const fallback = {
      id: '00000000-0000-4000-8000-000000000001',
      slug: DEFAULT_ORGANIZATION_SLUG,
      name: 'Default Organization',
    };
    setActiveOrganization(fallback);
    return fallback;
  }

  throw new Error(`Organization "${slug}" was not found. Check the workspace ID or sign up.`);
}

/**
 * @param {string} organizationId
 */
export async function fetchOrganizationById(organizationId) {
  if (!supabase || !organizationId) return null;

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_organization_by_id', {
    p_id: organizationId,
  });
  if (!rpcError) return firstRow(rpcData);
  if (!isMissingRpcError(rpcError)) {
    if (rpcError.code === '42P01') return null;
    throw rpcError;
  }

  const { data, error } = await supabase
    .from('organizations')
    .select('id, slug, name, plan, status, settings')
    .eq('id', organizationId)
    .limit(1);
  if (error) {
    if (error.code === '42P01') return null;
    if (isSingleRowCoerceError(error)) return firstRow(data);
    throw error;
  }
  return firstRow(data);
}

export async function loadOrganizationContext(organizationId) {
  const data = await fetchOrganizationById(organizationId);
  if (!data) return null;
  if (data.status === 'suspended') {
    throw new Error('This organization has been suspended.');
  }
  setActiveOrganization(data);
  return data;
}

/**
 * Merge partial settings into organizations.settings (shallow merge at top level).
 * @param {string} organizationId
 * @param {Record<string, unknown>} patch
 */
export async function updateOrganizationSettings(organizationId, patch) {
  if (!supabase) throw new Error('Supabase not initialized');
  const current = await fetchOrganizationById(organizationId);
  if (!current) throw new Error('Organization not found');

  const nextSettings = {
    ...(current.settings && typeof current.settings === 'object' ? current.settings : {}),
    ...patch,
  };

  const { data, error } = await supabase
    .from('organizations')
    .update({ settings: nextSettings, updated_at: new Date().toISOString() })
    .eq('id', organizationId)
    .select('id, slug, name, plan, status, settings')
    .limit(1);

  if (error) throw error;
  const row = firstRow(data);
  if (!row) throw new Error('Organization not found');
  setActiveOrganization(row);
  return row;
}

/**
 * Create a new SaaS tenant + owner admin (Supabase Auth).
 * @param {{ organizationName: string, organizationSlug: string, ownerName: string, ownerEmail: string, ownerPassword: string }}
 */
export async function signUpOrganization({
  organizationName,
  organizationSlug,
  ownerName,
  ownerEmail,
  ownerPassword,
  organizationAddress,
  organizationPostNo,
  organizationGstNo,
}) {
  if (!supabase) throw new Error('Supabase not initialized');

  const name = String(organizationName || '').trim();
  const slug = normalizeOrganizationSlug(organizationSlug);
  const email = String(ownerEmail || '').trim().toLowerCase();
  const password = String(ownerPassword || '');
  const displayName = String(ownerName || '').trim() || email.split('@')[0];
  const address = String(organizationAddress || '').trim();
  const postNo = String(organizationPostNo || '').trim();
  const gstNo = String(organizationGstNo || '').trim();

  if (!name) throw new Error('Organization name is required');
  if (!isValidOrganizationSlug(slug)) {
    throw new Error(
      'Workspace ID must be 3–64 characters: lowercase letters, numbers, and hyphens (e.g. acme-beverages).'
    );
  }
  if (!email) throw new Error('Email is required');
  if (password.length < 8) throw new Error('Password must be at least 8 characters');

  const existing = await getOrganizationBySlug(slug);
  if (existing) throw new Error('This workspace ID is already taken. Choose another.');

  let orgRowResolved = null;

  const { data: rpcOrg, error: rpcOrgError } = await supabase.rpc('create_workspace_for_signup', {
    p_slug: slug,
    p_name: name,
  });

  if (!rpcOrgError) {
    orgRowResolved = firstRow(rpcOrg);
  } else if (!isMissingRpcError(rpcOrgError)) {
    const msg = String(rpcOrgError.message || '');
    if (rpcOrgError.code === '23505' || /already taken/i.test(msg)) {
      throw new Error('This workspace ID is already taken. Choose another.');
    }
    if (/invalid workspace/i.test(msg)) {
      throw new Error(
        'Workspace ID must be 3–64 characters: lowercase letters, numbers, and hyphens (e.g. acme-beverages).'
      );
    }
    throw rpcOrgError;
  } else {
    const { error: orgError } = await supabase.from('organizations').insert([
      {
        slug,
        name,
        plan: 'trial',
        status: 'active',
        settings: {},
      },
    ]);

    if (orgError) {
      if (orgError.code === '23505') throw new Error('This workspace ID is already taken.');
      throw orgError;
    }

    orgRowResolved = await getOrganizationBySlug(slug);
  }

  const organizationId = orgRowResolved?.id;
  if (!organizationId) throw new Error('Failed to create workspace');
  setActiveOrganization(orgRowResolved);

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name: displayName, role: 'admin' },
    },
  });

  if (authError) {
    const { error: rollbackErr } = await supabase.rpc('delete_workspace_signup_rollback', {
      p_org_id: organizationId,
    });
    if (rollbackErr) {
      await supabase.from('organizations').delete().eq('id', organizationId);
    }
    throw authError;
  }
  if (!authData.user) throw new Error('Failed to create owner account');

  const uid = authData.user.id;
  const adminDoc = {
    uid,
    id: uid,
    email,
    name: displayName,
    role: 'admin',
    organization_id: organizationId,
    permissions: { read: true, write: true, delete: true, manageUsers: true },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: adminError } = await supabase.from('admins').insert([adminDoc]);
  if (adminError) {
    console.error('Owner admin row insert failed:', adminError);
    throw new Error(adminError.message || 'Failed to create admin profile');
  }

  const { error: memberError } = await supabase.from('organization_members').insert([
    {
      organization_id: organizationId,
      user_id: uid,
      role: 'owner',
    },
  ]);
  if (memberError) {
    console.warn('organization_members insert failed (non-fatal):', memberError);
  }

  try {
    const updated = await updateOrganizationSettings(
      organizationId,
      brandSettingsFromForm({
        appName: name,
        companyName: name,
        shortName: name.slice(0, 12) || name,
        markSrc: BRAND_MARK_SRC,
        primary: BRAND_PRIMARY,
        address,
        postNo,
        gstNo,
      })
    );
    if (updated) orgRowResolved = updated;
  } catch (settingsError) {
    console.warn('Initial workspace letterhead save failed (non-fatal):', settingsError);
  }

  return {
    organization: orgRowResolved,
    admin: adminDoc,
    user: authData.user,
    session: authData.session,
  };
}

function generateInviteToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Workspaces this user can access (for switcher).
 * @param {string} userId
 */
export async function listOrganizationsForUser(userId) {
  if (!supabase || !userId) return [];

  const byId = new Map();

  const attach = (row) => {
    const org = row?.organizations;
    if (!org?.id) return;
    byId.set(org.id, {
      id: org.id,
      slug: org.slug,
      name: org.name,
      plan: org.plan,
      status: org.status,
      memberRole: row.role,
    });
  };

  try {
    const { data: members } = await supabase
      .from('organization_members')
      .select('role, organizations(id, slug, name, plan, status)')
      .eq('user_id', userId);
    (members || []).forEach(attach);
  } catch (e) {
    console.warn('organization_members list failed:', e);
  }

  try {
    const { data: admins } = await supabase
      .from('admins')
      .select('role, organization_id, organizations(id, slug, name, plan, status)')
      .eq('uid', userId);
    (admins || []).forEach((row) => {
      if (row.organizations) attach(row);
      else if (row.organization_id) {
        byId.set(row.organization_id, {
          id: row.organization_id,
          slug: null,
          name: 'Workspace',
          plan: 'trial',
          memberRole: row.role || 'admin',
        });
      }
    });
  } catch (e) {
    console.warn('admins org list failed:', e);
  }

  return [...byId.values()].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''))
  );
}

/**
 * @param {{ id: string, slug?: string, name?: string }} org
 */
export async function switchActiveOrganization(org) {
  if (!org?.id) return;
  await loadOrganizationContext(org.id);
}

/**
 * @param {string} token
 */
export function inviteRoleToAppRole(inviteRole) {
  const role = String(inviteRole || 'admin').toLowerCase();
  if (role === 'viewer' || role === 'shipping') return role;
  return 'admin';
}

export async function getInviteByToken(token) {
  if (!supabase) return null;
  const t = String(token || '').trim();
  if (!t) return null;

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_invite_by_token', {
    p_token: t,
  });
  if (!rpcError) {
    const row = firstRow(rpcData);
    if (!row) return null;
    return {
      ...row,
      organizations: row.org_id
        ? { id: row.org_id, slug: row.org_slug, name: row.org_name }
        : null,
    };
  }
  if (!isMissingRpcError(rpcError)) {
    if (rpcError.code === '42P01') return null;
    throw rpcError;
  }

  const { data, error } = await supabase
    .from('organization_invites')
    .select('*, organizations(id, slug, name)')
    .eq('token', t)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .limit(1);

  if (error) {
    if (error.code === '42P01') return null;
    throw error;
  }
  return firstRow(data);
}

/**
 * @param {{ email: string, role?: string }} params
 */
export async function createTeamInvite({ email, role = 'admin' }) {
  if (!supabase) throw new Error('Supabase not initialized');

  const organizationId = (await import('./tenantScope')).getActiveOrganizationId();
  if (!organizationId) throw new Error('No active workspace');

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Valid email is required');
  }

  const token = generateInviteToken();
  const { data: user } = await supabase.auth.getUser();
  const invitedBy = user?.data?.user?.id || null;

  const { data, error } = await supabase
    .from('organization_invites')
    .insert([
      {
        organization_id: organizationId,
        email: normalizedEmail,
        role: role || 'admin',
        token,
        status: 'pending',
        invited_by: invitedBy,
      },
    ])
    .select('id, email, role, token, expires_at')
    .limit(1);

  if (error) throw error;

  const row = firstRow(data);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return {
    ...row,
    inviteUrl: `${origin}/invite/${token}`,
  };
}

export async function listPendingInvites() {
  const organizationId = (await import('./tenantScope')).getActiveOrganizationId();
  if (!supabase || !organizationId) return [];

  const { data, error } = await supabase
    .from('organization_invites')
    .select('id, email, role, status, created_at, expires_at')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

export async function listOrganizationMembers() {
  const organizationId = (await import('./tenantScope')).getActiveOrganizationId();
  if (!supabase || !organizationId) return [];

  const { data: members, error: memErr } = await supabase
    .from('organization_members')
    .select('id, user_id, role, created_at')
    .eq('organization_id', organizationId);

  if (memErr && memErr.code !== '42P01') throw memErr;

  const { data: admins, error: adminErr } = await supabase
    .from('admins')
    .select('uid, email, name, role, last_active, created_at')
    .eq('organization_id', organizationId);

  if (adminErr) throw adminErr;

  return {
    members: members || [],
    admins: admins || [],
  };
}

/**
 * Accept invite after user is signed in (email must match).
 * @param {string} token
 * @param {{ id: string, email?: string }} authUser
 */
export async function acceptOrganizationInvite(token, authUser) {
  if (!supabase) throw new Error('Supabase not initialized');
  const invite = await getInviteByToken(token);
  if (!invite) throw new Error('Invite is invalid or expired');

  const userEmail = String(authUser?.email || '').trim().toLowerCase();
  const inviteEmail = String(invite.email || '').trim().toLowerCase();
  if (userEmail !== inviteEmail) {
    throw new Error(`Sign in as ${invite.email} to accept this invite`);
  }

  const orgId = invite.organization_id;
  const uid = authUser.id;
  const memberRole = invite.role || 'admin';

  await supabase.from('organization_members').upsert(
    [{ organization_id: orgId, user_id: uid, role: memberRole }],
    { onConflict: 'organization_id,user_id' }
  );

  const { data: existingForOrg } = await supabase
    .from('admins')
    .select('id, uid')
    .eq('organization_id', orgId)
    .eq('uid', uid)
    .limit(1);

  const { resolvePermissionsForRole } = await import('../utils/permissions');
  const appRole = inviteRoleToAppRole(memberRole);
  const adminRowId = existingForOrg?.[0]?.id || `${orgId}_${uid}`;

  if (!existingForOrg?.length) {
    await supabase.from('admins').insert([
      {
        uid,
        id: adminRowId,
        email: userEmail,
        name: userEmail.split('@')[0],
        role: appRole,
        organization_id: orgId,
        permissions: resolvePermissionsForRole(appRole),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  } else {
    await supabase
      .from('admins')
      .update({
        role: appRole,
        permissions: resolvePermissionsForRole(appRole),
        updated_at: new Date().toISOString(),
      })
      .eq('id', adminRowId)
      .eq('organization_id', orgId);
  }

  await supabase
    .from('organization_invites')
    .update({ status: 'accepted' })
    .eq('id', invite.id);

  const org = invite.organizations || (await fetchOrganizationById(orgId));
  if (org) setActiveOrganization(org);
  return { org, appRole };
}
