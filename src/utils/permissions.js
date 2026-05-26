/**
 * Permission utilities for role-based access control
 */

import { getCurrentUser, getAdminByUid } from '../services/supabaseService';

// Role definitions (admin panel users stored in Supabase `admins` + Auth)
export const ROLES = {
  admin: {
    label: "Admin",
    description: "Full read and write access to all features",
    color: "error",
    permissions: { read: true, write: true, delete: true, manageUsers: true },
  },
  viewer: {
    label: "Viewer",
    description: "Read-only access to view data",
    color: "info",
    permissions: { read: true, write: false, delete: false, manageUsers: false },
  },
  shipping: {
    label: "Shipping",
    description: "Shipping dashboard only — upload invoices and mark orders delivered",
    color: "primary",
    permissions: { read: true, write: false, delete: false, manageUsers: false },
  },
};

/**
 * @param {string|null|undefined} role
 * @returns {{ read: boolean, write: boolean, delete: boolean, manageUsers: boolean }}
 */
export function resolvePermissionsForRole(role) {
  const key = (role || "").toString().trim().toLowerCase();
  return ROLES[key]?.permissions || ROLES.viewer.permissions;
}

export function isShippingRole(role) {
  return (role || "").toString().trim().toLowerCase() === "shipping";
}

/**
 * Get user role from Supabase
 * @param {string} uid - User UID
 * @returns {Promise<string>} User role ('admin' or 'viewer')
 */
export async function getUserRole(uid) {
  try {
    const adminDoc = await getAdminByUid(uid);
    if (adminDoc && adminDoc.role) {
      return adminDoc.role;
    }
    // If no role found, return null (let caller decide)
    return null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null; // Return null on error, don't assume admin
  }
}

/**
 * Get current user's role
 * @returns {Promise<string>} Current user's role
 */
export async function getCurrentUserRole() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;
    return await getUserRole(currentUser.id);
  } catch (error) {
    console.error('Error getting current user role:', error);
    return null;
  }
}

/**
 * Get user permissions from Supabase
 * @param {string} uid - User UID
 * @returns {Promise<Object>} User permissions object
 */
export async function getUserPermissions(uid) {
  try {
    const adminDoc = await getAdminByUid(uid);
    if (adminDoc) {
      // If permissions exist, use them
      if (adminDoc.permissions) {
        return adminDoc.permissions;
      }
      // If no permissions but role exists, derive from role
      if (adminDoc.role) {
        return ROLES[adminDoc.role]?.permissions || ROLES.viewer.permissions;
      }
      // If no role or permissions, default to viewer (more secure)
      return ROLES.viewer.permissions;
    }
    // If no admin doc found, default to viewer (more secure)
    return ROLES.viewer.permissions;
  } catch (error) {
    console.error('Error getting user permissions:', error);
    // Default to viewer permissions on error (more secure)
    return ROLES.viewer.permissions;
  }
}

/**
 * Check if current user has specific permission
 * @param {string} permission - Permission to check ('read', 'write', 'delete', 'manageUsers')
 * @returns {Promise<boolean>} True if user has permission
 */
export async function hasPermission(permission) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return false;
    
    const permissions = await getUserPermissions(currentUser.id);
    return permissions[permission] === true;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Check if current user is admin
 * @returns {Promise<boolean>} True if user is admin
 */
export async function isAdmin() {
  try {
    const role = await getCurrentUserRole();
    return role === 'admin';
  } catch (error) {
    console.error('Error checking if admin:', error);
    return false;
  }
}

/**
 * Check if current user can write
 * @returns {Promise<boolean>} True if user can write
 */
export async function canWrite() {
  return await hasPermission('write');
}

/**
 * Check if current user can delete
 * @returns {Promise<boolean>} True if user can delete
 */
export async function canDelete() {
  return await hasPermission('delete');
}

/**
 * Check if current user can manage users
 * @returns {Promise<boolean>} True if user can manage users
 */
export async function canManageUsers() {
  return await hasPermission('manageUsers');
}
