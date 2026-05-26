/**
 * Supabase Service Layer
 * Provides all Supabase operations for authentication and data management
 * This replaces Firebase functionality with Supabase
 */

import { supabase } from '../supabase';
import { hashPasswordSync } from '../utils/distributorAuth';
import { resolvePermissionsForRole } from '../utils/permissions';

// Re-export supabase so other files can check if Supabase is configured
export { supabase };

function getLinkedEmailFromDistributorRow(row) {
  const e = row?.email ?? row?.Email;
  return e != null ? String(e).trim() : '';
}

/** True if password matches legacy `credentials` on the distributors row (same rules as localStorage login). */
function distributorRowPasswordMatches(row, plainPassword) {
  if (!row || plainPassword == null) return false;
  const cred = row.credentials;
  if (!cred || typeof cred !== 'object') return false;
  const hash = hashPasswordSync(String(plainPassword));
  if (cred.passwordHash != null && String(cred.passwordHash) === hash) return true;
  if (cred.password != null && cred.password === plainPassword) return true;
  return false;
}

// ==================== AUTHENTICATION ====================

/**
 * Sign in a distributor using **distributor code** + password stored on the `distributors` row (`credentials`).
 * Does not use Supabase Auth — password must match `credentials.passwordHash` (same hash as the app) or `credentials.password`.
 * Requires anon (or public) SELECT on `distributors` for lookup by `code` (including `credentials` JSON).
 * @param {string} distributorCode - Distributor code (username)
 * @param {string} password - Password matching distributors.credentials in Supabase
 * @returns {Promise<Object>} Distributor record for the dashboard
 */
function distributorLoginIdVariants(loginId) {
  const id = String(loginId || '').trim();
  if (!id) return [];
  return [...new Set([id, id.toUpperCase(), id.toLowerCase()])];
}

function isSupabasePermissionError(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    error?.code === '42501' ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('rls')
  );
}

/**
 * Resolve a distributor row for login using code, username column, or credentials.username.
 * @param {string} loginId - Code or username entered on login screen
 */
async function findDistributorForLogin(loginId) {
  if (!supabase) return null;

  const variants = distributorLoginIdVariants(loginId);
  if (variants.length === 0) return null;

  for (const variant of variants) {
    const byCode = await getDistributorByCode(variant);
    if (byCode) return byCode;
  }

  for (const variant of variants) {
    const byUsername = await getDistributorByUsername(variant);
    if (byUsername) return byUsername;
  }

  for (const variant of variants) {
    try {
      const { data, error } = await supabase
        .from('distributors')
        .select('*')
        .eq('credentials->>username', variant);
      if (error) {
        if (isSupabasePermissionError(error)) throw error;
        continue;
      }
      if (data?.length) return data[0];
    } catch (e) {
      if (isSupabasePermissionError(e)) throw e;
    }
  }

  const id = variants[0];
  try {
    const { data, error } = await supabase.from('distributors').select('*').ilike('code', id);
    if (error) {
      if (isSupabasePermissionError(error)) throw error;
      return null;
    }
    if (data?.length === 1) return data[0];
  } catch (e) {
    if (isSupabasePermissionError(e)) throw e;
  }

  return null;
}

export async function signInDistributor(distributorCode, password) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const code = String(distributorCode || '').trim();
    const pass = String(password ?? '');
    if (!code || !pass) {
      throw new Error('Distributor code and password are required');
    }

    let byCode;
    try {
      byCode = await findDistributorForLogin(code);
    } catch (lookupError) {
      if (isSupabasePermissionError(lookupError)) {
        throw new Error(
          'Cannot read distributors from the database (security policy). In Supabase SQL Editor, run FIX_DISTRIBUTORS_ANON_LOGIN.sql, or ask your admin to allow anonymous SELECT on the distributors table for login.'
        );
      }
      throw lookupError;
    }

    if (!byCode) {
      throw new Error(
        'No distributor found with this code. Check the code or ask your admin. (Admins: sign in with your email in the same field.)'
      );
    }

    if (!distributorRowPasswordMatches(byCode, pass)) {
      throw new Error(
        'Wrong password for this distributor code. The password must match the credentials saved on your distributor row in Supabase (credentials.passwordHash or credentials.password).'
      );
    }

    const linkedEmail = getLinkedEmailFromDistributorRow(byCode);

    return {
      uid: byCode.uid || null,
      email: linkedEmail || byCode.email || null,
      ...byCode
    };
  } catch (error) {
    const errorMessage = error?.message || error?.error_description || error?.toString() || 'Failed to sign in distributor';
    console.error('Sign in distributor error:', error);
    throw new Error(errorMessage);
  }
}

/**
 * Sign in an admin with email and password
 * @param {string} email - Admin email
 * @param {string} password - Admin password
 * @returns {Promise<Object>} User object with admin data
 */
export async function signInAdmin(email, password) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      // Handle email not confirmed error with helpful message
      if (authError.message?.includes('Email not confirmed') || authError.message?.includes('email_not_confirmed')) {
        throw new Error('Email not confirmed. Please check your email and click the confirmation link, or ask an admin to confirm your email in the Supabase Dashboard.');
      }
      throw authError;
    }
    if (!authData.user) throw new Error('No user returned from authentication');

    // Check if user is an admin
    let adminDoc = await getAdminByUid(authData.user.id);
    
    // If admin record doesn't exist but user authenticated successfully, create it automatically
    if (!adminDoc) {
      console.log('Admin record not found, creating automatically for authenticated user:', authData.user.email);
      
      // Create admin document in database
      const autoRole = authData.user.user_metadata?.role || 'admin';
      const newAdminDoc = {
        uid: authData.user.id,
        id: authData.user.id, // Also set id field for compatibility
        email: authData.user.email || email,
        name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'Admin',
        role: autoRole,
        permissions: resolvePermissionsForRole(autoRole),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: insertedAdmin, error: insertError } = await supabase
        .from('admins')
        .insert([newAdminDoc])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating admin record:', insertError);
        // If insert fails, still try to return basic user info
        // This allows login to work even if database insert fails
        adminDoc = {
          uid: authData.user.id,
          id: authData.user.id,
          email: authData.user.email || email,
          name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'Admin',
          role: 'admin',
          permissions: { read: true, write: true, delete: true, manageUsers: true }
        };
      } else {
        adminDoc = insertedAdmin;
        console.log('✅ Admin record created successfully');
      }
    }

    // Update lastActive timestamp
    try {
      await updateUserLastActive(authData.user.id);
    } catch (e) {
      console.warn("Could not update lastActive:", e);
    }

    return {
      uid: authData.user.id,
      email: authData.user.email,
      ...adminDoc
    };
  } catch (error) {
    const errorMessage = error?.message || error?.error_description || error?.toString() || 'Failed to sign in admin';
    console.error('Sign in admin error:', error);
    throw new Error(errorMessage);
  }
}

/**
 * Create a new distributor account with Supabase Auth
 * @param {Object} distributorData - Distributor information
 * @returns {Promise<Object>} Created distributor data
 */
export async function createDistributorAccount(distributorData) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { email, password, name, code, region, address, username, target, achieved } = distributorData;

    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    // Create distributor document in Supabase
    const distributorDoc = {
      name,
      code,
      region: region || 'Southern',
      address: address || '',
      email,
      username,
      uid: authData.user.id,
      target: target || {
        CSD_PC: 0,
        CSD_UC: 0,
        Water_PC: 0,
        Water_UC: 0
      },
      achieved: achieved || {
        CSD_PC: 0,
        CSD_UC: 0,
        Water_PC: 0,
        Water_UC: 0
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: insertError } = await supabase
      .from('distributors')
      .insert([{ ...distributorDoc, id: code }]);

    if (insertError) throw insertError;

    return distributorDoc;
  } catch (error) {
    throw new Error(error.message || 'Failed to create distributor account');
  }
}

/**
 * Sign out the current user
 */
export async function signOutUser() {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    throw new Error(error.message || 'Failed to sign out');
  }
}

/**
 * Get the current authenticated user
 * @returns {Promise<Object|null>} Current user or null
 */
export async function getCurrentUser() {
  if (!supabase) return null;
  try {
    // First check if there's a valid session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      // 403 or other auth errors - user is not authenticated
      if (sessionError.status === 403 || sessionError.message?.includes('Forbidden')) {
        console.log('User not authenticated or session expired');
        return null;
      }
      console.warn('Session error:', sessionError);
    }
    
    // If no session, return null
    if (!session) {
      return null;
    }
    
    // Get user from session (more reliable than getUser when session exists)
    if (session.user) {
      return session.user;
    }
    
    // Fallback to getUser if session.user is not available
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      // Handle 403 and other auth errors gracefully
      if (userError.status === 403 || userError.message?.includes('Forbidden')) {
        console.log('User not authenticated or session expired');
        return null;
      }
      console.warn('Error getting user:', userError);
      return null;
    }
    
    return user;
  } catch (error) {
    const message = error?.message || error?.toString() || '';

    // Treat AbortError as a benign cancellation (navigation/unmount)
    if (error?.name === 'AbortError' || message.includes('AbortError')) {
      console.warn('⚠️ getCurrentUser aborted (likely due to navigation or component unmount). Returning null.');
      return null;
    }

    // Handle network errors, CORS, etc.
    if (error.status === 403 || error.message?.includes('Forbidden')) {
      console.log('User not authenticated or session expired');
      return null;
    }
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Listen to authentication state changes
 * @param {Function} callback - Callback function that receives user object
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
  if (!supabase) {
    return () => {};
  }

  try {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      try {
        callback(session?.user || null);
      } catch (error) {
        console.error('Error in auth state change callback:', error);
      }
    });

    return () => {
      try {
        subscription?.unsubscribe();
      } catch (error) {
        console.error('Error unsubscribing from auth state:', error);
      }
    };
  } catch (error) {
    console.error('Error setting up auth state listener:', error);
    return () => {};
  }
}

/**
 * Send password reset email
 * @param {string} email - User email
 */
export async function resetPassword(email) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  } catch (error) {
    throw new Error(error.message || 'Failed to send password reset email');
  }
}

/**
 * Update user password
 * @param {string} newPassword - New password
 */
export async function updateUserPassword(newPassword) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  } catch (error) {
    throw new Error(error.message || 'Failed to update password');
  }
}

// ==================== DISTRIBUTOR MANAGEMENT ====================

/**
 * Get all distributors from Supabase
 * @returns {Promise<Array>} Array of distributor objects
 */
export async function getAllDistributors() {
  try {
    if (!supabase) {
      console.error('❌ Supabase not initialized');
      throw new Error('Supabase not initialized');
    }

    console.log('🔄 Fetching distributors from Supabase...');
    const { data, error } = await supabase
      .from('distributors')
      .select('*')
      .order('name');

    if (error) {
      // Special handling for aborted requests so they don't spam hard errors
      const message = error.message || error.toString() || '';
      if (message.includes('AbortError')) {
        console.warn('⚠️ Supabase getAllDistributors request was aborted. This usually happens when the page or subscription is closed/reloaded.', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        // Treat as benign: just return empty list so callers can continue gracefully
        return [];
      }

      console.error('❌ Supabase error getting distributors:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      // Provide helpful error messages
      if (error.code === 'PGRST301' || error.message?.includes('permission denied') || error.message?.includes('row-level security')) {
        console.error('🔒 RLS (Row Level Security) is blocking access to distributors table.');
        console.error('💡 Solution: Either disable RLS or create a policy to allow access.');
        console.error('   Run: ALTER TABLE distributors DISABLE ROW LEVEL SECURITY;');
        console.error('   Or create a policy: CREATE POLICY "Allow all" ON distributors FOR ALL USING (true);');
      }
      
      throw error;
    }

    console.log(`✅ Successfully loaded ${data?.length || 0} distributors from Supabase`);
    if (data && data.length > 0) {
      console.log('📋 Sample distributor:', data[0]);
    }
    
    return data || [];
  } catch (error) {
    const message = error?.message || error?.toString() || '';

    // Again, swallow AbortError as a benign warning
    if (message.includes('AbortError')) {
      console.warn('⚠️ getAllDistributors aborted (likely due to navigation or component unmount). Returning empty list.');
      return [];
    }

    console.error('❌ Error getting all distributors:', error);
    console.error('   Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return [];
  }
}

/**
 * Get distributor by code
 * @param {string} code - Distributor code
 * @returns {Promise<Object|null>} Distributor object or null
 */
export async function getDistributorByCode(code) {
  try {
    if (!supabase) {
      console.warn('Supabase not initialized');
      return null;
    }

    // Use array response instead of .single() to avoid 406 if multiple rows exist
    const { data, error } = await supabase
      .from('distributors')
      .select('*')
      .eq('code', code);

    if (error) {
      if (error.code === 'PGRST116') return null;
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Distributors table does not exist yet. Please create it in Supabase.');
        return null;
      }
      if (isSupabasePermissionError(error)) {
        console.error('Distributors read blocked by RLS:', error);
        return null;
      }
      throw error;
    }

    if (!data || data.length === 0) return null;

    if (data.length > 1) {
      console.warn(
        `⚠️ Multiple distributors found with code "${code}" in Supabase. Using the first one. Please clean up duplicates in Supabase.`
      );
    }

    return data[0];
  } catch (error) {
    if (isSupabasePermissionError(error)) {
      console.error('Distributors read blocked by RLS:', error);
    } else {
      console.error('Error getting distributor by code:', error);
    }
    return null;
  }
}

/**
 * Get distributor by UID
 * @param {string} uid - User UID
 * @returns {Promise<Object|null>} Distributor object or null
 */
export async function getDistributorByUid(uid) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { data, error } = await supabase
      .from('distributors')
      .select('*')
      .eq('uid', uid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error getting distributor by UID:', error);
    return null;
  }
}

/**
 * Get distributor by username
 * @param {string} username - Username
 * @returns {Promise<Object|null>} Distributor object or null
 */
export async function getDistributorByUsername(username) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { data, error } = await supabase
      .from('distributors')
      .select('*')
      .eq('username', username);

    if (error) {
      if (error.code === 'PGRST116') return null;
      if (isSupabasePermissionError(error)) {
        console.error('Distributors read blocked by RLS:', error);
        return null;
      }
      throw error;
    }

    if (!data?.length) return null;
    return data[0];
  } catch (error) {
    console.error('Error getting distributor by username:', error);
    return null;
  }
}

/**
 * Save or update a distributor in Supabase
 * @param {Object} distributorData - Distributor data
 * @returns {Promise<Object>} Saved distributor data
 */
export async function saveDistributor(distributorData) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    // Ensure code is present (required for primary key)
    if (!distributorData.code) {
      throw new Error('Distributor code is required');
    }

    // Check if distributor already exists
    const { data: existing, error: checkError } = await supabase
      .from('distributors')
      .select('id, code, created_at')
      .eq('code', distributorData.code)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      throw checkError;
    }

    const isNew = !existing;
    const now = new Date().toISOString();

    // Extract username from credentials if it exists
    let username = distributorData.username;
    if (!username && distributorData.credentials?.username) {
      username = distributorData.credentials.username;
    }

    // Prepare distributor document with only core fields that definitely exist
    // We'll save phone and credentials separately if those columns exist
    const distributorDoc = {
      id: distributorData.code, // Use code as id (primary key)
      code: distributorData.code,
      name: distributorData.name,
      email: distributorData.email || null,
      username: username || null,
      uid: distributorData.uid || null,
      region: distributorData.region || null,
      address: distributorData.address || null,
      // Note: phone and credentials excluded - will be saved separately if columns exist
      target: distributorData.target || {
        CSD_PC: 0,
        CSD_UC: 0,
        Water_PC: 0,
        Water_UC: 0
      },
      achieved: distributorData.achieved || {
        CSD_PC: 0,
        CSD_UC: 0,
        Water_PC: 0,
        Water_UC: 0
      },
      updated_at: now
    };

    // Add created_at only for new records
    if (isNew) {
      distributorDoc.created_at = now;
    }

    // Store optional fields separately for later update
    const optionalFields = {};
    if (distributorData.phone) {
      optionalFields.phone = distributorData.phone;
    }
    if (distributorData.credentials && typeof distributorData.credentials === 'object') {
      if (distributorData.credentials.username || distributorData.credentials.passwordHash) {
        optionalFields.credentials = distributorData.credentials;
      }
    }

    let data, error;
    
    try {
      // Save core distributor data first (without phone and credentials)
      const result = await supabase
        .from('distributors')
        // Use primary key (id) as the conflict target so we don't get
        // "Key (id)=(CODE) already exists" errors when the row already exists.
        .upsert(distributorDoc, { onConflict: 'id' })
        .select()
        .single();
      
      data = result.data;
      error = result.error;
      
      // If we have optional fields (phone or credentials), try to update them
      // This will fail silently if the columns don't exist, which is fine
      if (Object.keys(optionalFields).length > 0 && data) {
        try {
          // Use id (primary key) instead of code to avoid 406 errors with duplicate codes
          // data might be an object or array, handle both cases
          const savedData = Array.isArray(data) ? data[0] : data;
          const distributorId = savedData?.id || distributorData.code;
          
          if (distributorId) {
            const updateResult = await supabase
              .from('distributors')
              .update(optionalFields)
              .eq('id', distributorId)
              .select()
              .maybeSingle();
            
            if (!updateResult.error && updateResult.data) {
              console.log('✅ Optional fields (phone/credentials) also saved to Supabase');
              data = updateResult.data;
            } else {
              // Optional columns don't exist, that's okay
              const missingFields = Object.keys(optionalFields).join(', ');
              console.warn(`⚠️ Optional fields (${missingFields}) not found in Supabase schema. Core distributor data saved successfully.`);
            }
          }
        } catch (updateError) {
          // Optional fields update failed, but main save succeeded - that's okay
          const missingFields = Object.keys(optionalFields).join(', ');
          console.warn(`⚠️ Could not save optional fields (${missingFields}) to Supabase (columns may not exist). Main distributor data saved successfully.`);
        }
      }
      
    } catch (upsertError) {
      // Helper to serialize error objects
      const serializeError = (err) => {
        if (!err) return 'Unknown error';
        if (typeof err === 'string') return err;
        if (err.message) return err.message;
        if (err.toString && err.toString() !== '[object Object]') return err.toString();
        try {
          return JSON.stringify(err, Object.getOwnPropertyNames(err));
        } catch {
          return String(err);
        }
      };
      
      const errorMessage = serializeError(upsertError);
      // Treat AbortError as a benign cancellation to avoid noisy logs
      if (errorMessage.includes('AbortError') || upsertError?.name === 'AbortError') {
        console.warn(`⚠️ Supabase upsert for distributor ${distributorData.code} was aborted (likely navigation or component unmount). Skipping cloud save, local data remains.`);
        return distributorData;
      }
      
      // Check for network resource errors
      if (errorMessage.includes('ERR_INSUFFICIENT_RESOURCES') || 
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('network')) {
        console.warn(`⚠️ Network resource error saving distributor ${distributorData.code}. Local data preserved.`);
        return distributorData; // Return local data instead of throwing
      }
      
      console.error(`❌ Error saving distributor ${distributorData.code} to Supabase:`, errorMessage);
      throw upsertError;
    }

    if (error) {
      // Helper to serialize error objects
      const serializeError = (err) => {
        if (!err) return 'Unknown error';
        if (typeof err === 'string') return err;
        if (err.message) return err.message;
        if (err.toString && err.toString() !== '[object Object]') return err.toString();
        try {
          return JSON.stringify(err, Object.getOwnPropertyNames(err));
        } catch {
          return String(err);
        }
      };
      
      const errMsg = serializeError(error);
      // Treat AbortError here as benign as well
      if (error?.name === 'AbortError' || errMsg.includes('AbortError')) {
        console.warn(`⚠️ Supabase upsert for distributor ${distributorData.code} was aborted (likely navigation or component unmount). Skipping cloud save, local data remains.`);
        return distributorData;
      }
      
      // Check for network resource errors
      if (errMsg.includes('ERR_INSUFFICIENT_RESOURCES') || 
          errMsg.includes('Failed to fetch') ||
          errMsg.includes('network')) {
        console.warn(`⚠️ Network resource error saving distributor ${distributorData.code}. Local data preserved.`);
        return distributorData; // Return local data instead of throwing
      }
      
      console.error(`❌ Supabase upsert error for distributor ${distributorData.code}:`, errMsg);
      throw error;
    }

    console.log(`✅ Distributor ${isNew ? 'created' : 'updated'} in Supabase:`, distributorData.code);
    return data;
  } catch (error) {
    // Helper to serialize error objects
    const serializeError = (err) => {
      if (!err) return 'Unknown error';
      if (typeof err === 'string') return err;
      if (err.message) return err.message;
      if (err.toString && err.toString() !== '[object Object]') return err.toString();
      try {
        return JSON.stringify(err, Object.getOwnPropertyNames(err));
      } catch {
        return String(err);
      }
    };
    
    const message = serializeError(error);

    // Again, swallow AbortError as a benign warning so it doesn't spam the console
    if (message.includes('AbortError') || error?.name === 'AbortError') {
      console.warn(`⚠️ saveDistributor aborted for ${distributorData?.code || 'unknown'} (likely due to navigation or component unmount).`);
      return distributorData;
    }
    
    // Check for network resource errors
    if (message.includes('ERR_INSUFFICIENT_RESOURCES') || 
        message.includes('Failed to fetch') ||
        message.includes('network')) {
      console.warn(`⚠️ Network resource error saving distributor ${distributorData?.code || 'unknown'}. Local data preserved.`);
      return distributorData; // Return local data instead of throwing
    }

    console.error(`❌ Error saving distributor ${distributorData?.code || 'unknown'}:`, message);
    throw error;
  }
}

/**
 * Update a distributor in Supabase
 * @param {string} distributorId - Distributor code
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated distributor data
 */
export async function updateDistributor(distributorId, updates) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    // First, try to find the distributor by code to get its id (primary key)
    // This ensures we update by primary key which is always unique
    const { data: existing, error: findError } = await supabase
      .from('distributors')
      .select('id, code')
      .eq('code', distributorId)
      .limit(1); // Only get one row even if duplicates exist

    if (findError) {
      // If find fails, try using distributorId as id directly
      const { data: dataById, error: errorById } = await supabase
        .from('distributors')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', distributorId)
        .select()
        .maybeSingle();

      if (errorById) throw errorById;
      if (!dataById) {
        throw new Error(`Distributor with code/id "${distributorId}" not found`);
      }
      return dataById;
    }

    // If no distributor found by code, try using distributorId as id
    if (!existing || existing.length === 0) {
      const { data: dataById, error: errorById } = await supabase
        .from('distributors')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', distributorId)
        .select()
        .maybeSingle();

      if (errorById) throw errorById;
      if (!dataById) {
        throw new Error(`Distributor with code/id "${distributorId}" not found`);
      }
      return dataById;
    }

    // Use the id (primary key) to update - this ensures uniqueness
    const distributorIdValue = existing[0]?.id;
    if (!distributorIdValue) {
      throw new Error(`Distributor with code "${distributorId}" found but missing id field`);
    }
    
    const { data, error } = await supabase
      .from('distributors')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', distributorIdValue)
      .select()
      .maybeSingle();

    if (error) {
      // If update by id fails, log warning but don't throw if it's a 406 (duplicate issue)
      if (error.code === 'PGRST116' || error.message?.includes('406')) {
        console.warn(`⚠️ Update failed for distributor ${distributorId} due to duplicate codes. Attempting to update by code with limit.`);
        // Fallback: try updating by code (only updates first matching row)
        // Note: This may still fail with 406 if multiple rows exist, but we try anyway
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('distributors')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('code', distributorId)
          .select()
          .limit(1);
        
        if (fallbackError) {
          // If fallback also fails, log and throw
          console.error(`Failed to update distributor ${distributorId} even with fallback:`, fallbackError);
          throw fallbackError;
        }
        if (!fallbackData || fallbackData.length === 0) {
          throw new Error(`Distributor with code "${distributorId}" not found`);
        }
        return fallbackData[0];
      }
      throw error;
    }

    if (!data) {
      throw new Error(`Distributor with code "${distributorId}" not found`);
    }

    return data;
  } catch (error) {
    // Don't log AbortError as an error
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      console.log('Update request aborted for distributor:', distributorId);
      throw error;
    }
    const isMissingPhysicalStock =
      error?.code === 'PGRST204' &&
      updates &&
      Object.prototype.hasOwnProperty.call(updates, 'physical_stock') &&
      typeof error.message === 'string' &&
      error.message.includes('physical_stock');
    if (isMissingPhysicalStock) {
      console.warn(
        'Distributor update skipped on server: add column physical_stock (JSONB) to distributors. See ADD_PHYSICAL_STOCK_COLUMN.sql in the project.',
        error.message
      );
    } else {
      console.error('Error updating distributor:', error);
    }
    throw error;
  }
}

/**
 * Delete a distributor from Supabase
 * @param {string} distributorId - Distributor code
 * @returns {Promise<number>} Number of rows deleted
 */
export async function deleteDistributor(distributorId) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { data, error } = await supabase
      .from('distributors')
      .delete()
      .eq('code', distributorId)
      .select();

    if (error) throw error;
    
    const deletedCount = data?.length || 0;
    if (deletedCount === 0) {
      console.warn(`⚠️ No distributor found with code "${distributorId}" to delete`);
    } else {
      console.log(`✅ Deleted ${deletedCount} row(s) with code "${distributorId}"`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Error deleting distributor:', error);
    throw new Error(error.message || 'Failed to delete distributor');
  }
}

/**
 * Subscribe to real-time updates for all distributors
 * @param {Function} callback - Callback function that receives distributors array
 * @returns {Function} Unsubscribe function
 */
export function subscribeToDistributors(callback) {
  if (!supabase) {
    return () => {};
  }

  try {
    const subscription = supabase
      .channel('distributors-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'distributors' },
        async () => {
          try {
            const distributors = await getAllDistributors();
            callback(distributors);
          } catch (error) {
            if (error.name === 'AbortError') {
              console.log('Request aborted in subscription callback, ignoring');
              return;
            }
            console.error('Error in distributors subscription callback:', error);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error unsubscribing from distributors:', error);
        }
      }
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Subscription aborted, ignoring');
      return () => {};
    }
    console.error('Error setting up distributors subscription:', error);
    return () => {};
  }
}

/**
 * Subscribe to real-time updates for a single distributor
 * @param {string} distributorId - Distributor code
 * @param {Function} callback - Callback function that receives distributor object
 * @returns {Function} Unsubscribe function
 */
export function subscribeToDistributor(distributorId, callback) {
  if (!supabase) {
    return () => {};
  }

  try {
    const subscription = supabase
      .channel(`distributor-${distributorId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'distributors', filter: `code=eq.${distributorId}` },
        async () => {
          try {
            const distributor = await getDistributorByCode(distributorId);
            callback(distributor);
          } catch (error) {
            if (error.name === 'AbortError') {
              console.log('Request aborted in subscription callback, ignoring');
              return;
            }
            console.error('Error in distributor subscription callback:', error);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error unsubscribing from distributor:', error);
        }
      }
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Subscription aborted, ignoring');
      return () => {};
    }
    console.error('Error setting up distributor subscription:', error);
    return () => {};
  }
}

// ==================== PHYSICAL STOCK SNAPSHOTS (per report date) ====================

function isMissingPhysicalStockSnapshotsTableError(error) {
  if (!error) return false;
  const msg = typeof error.message === 'string' ? error.message : '';
  if (/distributor_physical_stock_snapshots/i.test(msg)) return true;
  if (error.code === '42P01') return true;
  return false;
}

/**
 * Upsert one snapshot row per distributor + report date (payload matches distributors.physical_stock shape).
 * @param {string} distributorCode
 * @param {{ reportDate: string, rows: unknown[], updatedAt?: string }} payload
 */
export async function upsertDistributorPhysicalStockSnapshot(distributorCode, payload) {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }
  const code = String(distributorCode || '').trim();
  if (!code || !payload || typeof payload !== 'object') {
    throw new Error('distributorCode and payload are required');
  }
  const reportDate =
    typeof payload.reportDate === 'string' && payload.reportDate
      ? payload.reportDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const row = {
    distributor_code: code,
    report_date: reportDate,
    payload: {
      reportDate,
      rows: payload.rows,
      updatedAt: payload.updatedAt || new Date().toISOString(),
    },
    saved_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('distributor_physical_stock_snapshots')
    .upsert(row, { onConflict: 'distributor_code,report_date' })
    .select()
    .maybeSingle();

  if (error) {
    if (isMissingPhysicalStockSnapshotsTableError(error)) {
      const e = new Error(
        'Table distributor_physical_stock_snapshots is missing. Run ADD_DISTRIBUTOR_PHYSICAL_STOCK_SNAPSHOTS.sql in Supabase.'
      );
      e.code = 'MISSING_SNAPSHOTS_TABLE';
      throw e;
    }
    throw error;
  }
  return data;
}

/**
 * Load physical stock snapshots for Excel / reporting.
 * @param {{ dateFrom: string, dateTo: string, distributorCodes?: string[] }} params - YYYY-MM-DD inclusive
 * @returns {Promise<Array<{ distributor_code: string, report_date: string, payload: object }>>}
 */
export async function fetchDistributorPhysicalStockSnapshots({ dateFrom, dateTo, distributorCodes } = {}) {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }
  const from = typeof dateFrom === 'string' ? dateFrom.slice(0, 10) : '';
  const to = typeof dateTo === 'string' ? dateTo.slice(0, 10) : '';
  if (!from || !to) {
    throw new Error('dateFrom and dateTo (YYYY-MM-DD) are required');
  }

  let query = supabase
    .from('distributor_physical_stock_snapshots')
    .select('distributor_code, report_date, payload')
    .gte('report_date', from)
    .lte('report_date', to)
    .order('report_date', { ascending: true })
    .order('distributor_code', { ascending: true });

  const codes = Array.isArray(distributorCodes)
    ? distributorCodes.map((c) => String(c || '').trim()).filter(Boolean)
    : [];
  if (codes.length > 0) {
    query = query.in('distributor_code', codes);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingPhysicalStockSnapshotsTableError(error)) {
      console.warn('distributor_physical_stock_snapshots not available:', error.message);
      return [];
    }
    throw error;
  }
  return Array.isArray(data) ? data : [];
}

/**
 * Latest physical stock snapshot for one distributor on one report date (YYYY-MM-DD).
 * @returns {Promise<{ reportDate: string, rows: unknown[], updatedAt?: string }|null>}
 */
export async function fetchDistributorPhysicalStockSnapshotForDate(distributorCode, reportDate) {
  const code = String(distributorCode || '').trim();
  const date = typeof reportDate === 'string' ? reportDate.slice(0, 10) : '';
  if (!code || !date) return null;
  const rows = await fetchDistributorPhysicalStockSnapshots({
    dateFrom: date,
    dateTo: date,
    distributorCodes: [code],
  });
  const hit = Array.isArray(rows)
    ? rows.find((r) => String(r?.distributor_code || '').trim() === code)
    : null;
  const payload = hit?.payload;
  if (!payload || typeof payload !== 'object') return null;
  return payload;
}

/**
 * Most recent physical stock snapshot for a distributor (by saved_at), optionally skipping one report date.
 * @returns {Promise<object|null>} payload JSON (reportDate, rows, updatedAt)
 */
export async function fetchLatestDistributorPhysicalStockSnapshot(distributorCode, excludeReportDate) {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }
  const code = String(distributorCode || '').trim();
  if (!code) return null;
  const exclude =
    typeof excludeReportDate === 'string' ? excludeReportDate.slice(0, 10) : '';

  const { data, error } = await supabase
    .from('distributor_physical_stock_snapshots')
    .select('report_date, payload, saved_at')
    .eq('distributor_code', code)
    .order('saved_at', { ascending: false })
    .limit(40);

  if (error) {
    if (isMissingPhysicalStockSnapshotsTableError(error)) {
      return null;
    }
    throw error;
  }

  for (const row of data || []) {
    const rd =
      typeof row.report_date === 'string'
        ? row.report_date.slice(0, 10)
        : String(row.report_date || '').slice(0, 10);
    if (exclude && rd === exclude) continue;
    const payload = row.payload;
    if (!payload || typeof payload !== 'object') continue;
    const reportDate =
      typeof payload.reportDate === 'string' && payload.reportDate
        ? payload.reportDate.slice(0, 10)
        : rd;
    return {
      reportDate,
      rows: payload.rows,
      updatedAt: payload.updatedAt || row.saved_at || new Date().toISOString(),
    };
  }
  return null;
}

// ==================== ORDER MANAGEMENT ====================

function distributorCodeMatchVariants(code) {
  const c = String(code || '').trim();
  if (!c) return [];
  return [...new Set([c, c.toUpperCase(), c.toLowerCase()])];
}

function orderNumberMatchVariants(orderNumber) {
  const on = String(orderNumber ?? '').trim();
  if (!on) return [];
  const variants = [on];
  if (/^\d+$/.test(on)) variants.push(parseInt(on, 10));
  return [...new Set(variants)];
}

async function fetchOrdersRowByBusinessKey(fb, selectClause) {
  if (!supabase) return null;
  for (const code of distributorCodeMatchVariants(fb.distributorCode)) {
    for (const orderNum of orderNumberMatchVariants(fb.orderNumber)) {
      const { data, error } = await supabase
        .from('orders')
        .select(selectClause)
        .eq('distributorCode', code)
        .eq('orderNumber', orderNum)
        .maybeSingle();
      if (!error && data) return data;
    }
  }
  return null;
}

async function updateOrdersRowByBusinessKey(fb, basePayload, statusCandidates = null) {
  for (const code of distributorCodeMatchVariants(fb.distributorCode)) {
    for (const orderNum of orderNumberMatchVariants(fb.orderNumber)) {
      const row =
        statusCandidates != null
          ? await updateOrdersRowMatchingWithStatusFallback(
              (q) => q.eq('distributorCode', code).eq('orderNumber', orderNum),
              basePayload,
              statusCandidates
            )
          : await updateOrdersRowMatching(
              (q) => q.eq('distributorCode', code).eq('orderNumber', orderNum),
              basePayload
            );
      if (row) return row;
    }
  }
  return null;
}

/**
 * Save an order to Supabase
 * @param {Object} orderData - Order data
 * @returns {Promise<Object>} Saved order data
 */
export async function saveOrder(orderData) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const normalizedAppStatus = normalizeWorkflowStatusForWrite(orderData.status);
    const orderDoc = {
      ...orderData,
      status: databaseStatusWriteCandidates(normalizedAppStatus)[0],
      status_updated_at: new Date().toISOString(),
      status_history: Array.isArray(orderData.statusHistory) ? orderData.statusHistory : [],
      reminder_count: Number.isFinite(Number(orderData.reminder_count)) ? Number(orderData.reminder_count) : 0,
      escalation_level: Number.isFinite(Number(orderData.escalation_level)) ? Number(orderData.escalation_level) : 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let insertPayload = { ...orderDoc };
    // Retry by stripping unknown columns for backward-compatible schemas.
    // Prevent infinite loop with a small max attempt guard.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { data, error } = await supabase
        .from('orders')
        .insert([insertPayload])
        .select()
        .single();

      if (!error) return data;

      const missingColumnMatch =
        error.code === 'PGRST204' &&
        typeof error.message === 'string'
          ? error.message.match(/'([^']+)' column/)
          : null;
      const missingColumn = missingColumnMatch?.[1];

      if (missingColumn && Object.prototype.hasOwnProperty.call(insertPayload, missingColumn)) {
        const nextPayload = { ...insertPayload };
        delete nextPayload[missingColumn];
        insertPayload = nextPayload;
        continue;
      }

      throw error;
    }

    throw new Error('Failed to save order after schema compatibility retries');
  } catch (error) {
    console.error('Error saving order:', error);
    throw error;
  }
}

/**
 * Normalize order workflow status to app vocabulary (delivered, not dispatched).
 * @param {string|null|undefined} s
 * @returns {string}
 */
function normalizeWorkflowStatusForWrite(s) {
  let value = s != null && String(s).trim() !== '' ? String(s).trim().toLowerCase() : 'pending';
  if (value === 'dispatched') value = 'delivered';
  const allowed = new Set([
    'pending',
    'sent',
    'approved',
    'delivered',
    'rejected',
    'canceled',
    'pending_email_failed',
  ]);
  return allowed.has(value) ? value : 'pending';
}

/**
 * Status values to try when writing to `orders.status` (Postgres CHECK varies by project).
 * @param {string} appStatus - normalized app status
 * @returns {string[]}
 */
function databaseStatusWriteCandidates(appStatus) {
  const s =
    appStatus != null && String(appStatus).trim() !== ''
      ? String(appStatus).trim().toLowerCase()
      : 'pending';
  if (s === 'delivered') return ['delivered', 'dispatched'];
  return [s];
}

function isOrderStatusCheckViolation(error) {
  return (
    error?.code === '23514' &&
    typeof error?.message === 'string' &&
    error.message.includes('orders_status_allowed_check')
  );
}

async function updateOrdersRowMatchingWithStatusFallback(matchFn, basePayload, statusCandidates) {
  const candidates =
    Array.isArray(statusCandidates) && statusCandidates.length > 0
      ? statusCandidates
      : [basePayload.status || 'pending'];
  let lastError = null;

  for (const dbStatus of candidates) {
    try {
      const row = await updateOrdersRowMatching(matchFn, {
        ...basePayload,
        status: dbStatus,
      });
      if (row) return row;
    } catch (error) {
      lastError = error;
      if (!isOrderStatusCheckViolation(error)) throw error;
    }
  }

  if (lastError) throw lastError;
  return null;
}

/**
 * Get orders by distributor code
 * @param {string} distributorCode - Distributor code
 * @returns {Promise<Array>} Array of order objects
 */
function normalizeOrderRowStatus(row) {
  if (!row || typeof row !== 'object') return row;
  const s = row.status;
  let normalized =
    s != null && String(s).trim() !== '' ? String(s).trim().toLowerCase() : 'pending';
  if (normalized === 'dispatched') normalized = 'delivered';
  const allowed = new Set([
    'pending',
    'sent',
    'approved',
    'delivered',
    'rejected',
    'canceled',
    'pending_email_failed',
  ]);
  return { ...row, status: allowed.has(normalized) ? normalized : 'pending' };
}

export async function getOrdersByDistributor(distributorCode) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const code = String(distributorCode || '').trim();
    if (!code) return [];

    const runSelect = (c) =>
      supabase.from('orders').select('*').eq('distributorCode', c).order('created_at', { ascending: false });

    const seen = new Set();
    const rows = [];
    for (const variant of distributorCodeMatchVariants(code)) {
      const { data, error } = await runSelect(variant);
      if (error) throw error;
      for (const row of data || []) {
        const id = row?.id != null ? String(row.id) : null;
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        rows.push(row);
      }
    }

    return rows.map(normalizeOrderRowStatus);
  } catch (error) {
    console.error('Error getting orders by distributor:', error);
    return [];
  }
}

const ORDER_INVOICE_SELECT =
  'id, orderNumber, distributorCode, status, shipping_invoice_data, shipping_invoice_file_name, shipping_invoice_mime_type';

/**
 * Load shipping invoice fields for one order (use when list fetch omits large TEXT).
 * @param {string|null} orderId
 * @param {{ distributorCode?: string, orderNumber?: string|number }|null} identityFallback
 */
export async function fetchOrderShippingInvoice(orderId, identityFallback = null) {
  try {
    if (!supabase) return null;

    const hasId = orderId != null && String(orderId).trim() !== '';
    const fb = identityFallback || {};
    const hasFb =
      fb.distributorCode != null &&
      String(fb.distributorCode).trim() !== '' &&
      fb.orderNumber != null &&
      String(fb.orderNumber).trim() !== '';

    if (!hasId && !hasFb) return null;

    if (hasId) {
      const { data, error } = await supabase
        .from('orders')
        .select(ORDER_INVOICE_SELECT)
        .eq('id', orderId)
        .maybeSingle();
      if (!error && data) return normalizeOrderRowStatus(data);
    }

    if (hasFb) {
      const data = await fetchOrdersRowByBusinessKey(fb, ORDER_INVOICE_SELECT);
      if (data) return normalizeOrderRowStatus(data);
    }

    return null;
  } catch (error) {
    console.error('Error fetching order shipping invoice:', error);
    return null;
  }
}

/**
 * Persist shipping invoice columns on an order row (shipping dashboard upload).
 * @param {string|null|undefined} orderId
 * @param {{ shipping_invoice_data: string, shipping_invoice_file_name?: string, shipping_invoice_mime_type?: string }} invoicePatch
 * @param {{ distributorCode?: string, orderNumber?: string|number }|null} identityFallback
 */
export async function patchOrderShippingInvoice(orderId, invoicePatch, identityFallback = null) {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }
  const data = invoicePatch?.shipping_invoice_data;
  if (data == null || String(data).trim() === '') {
    throw new Error('Invoice data is empty');
  }

  const hasId = orderId != null && String(orderId).trim() !== '';
  const fb = identityFallback || {};
  const hasFb =
    fb.distributorCode != null &&
    String(fb.distributorCode).trim() !== '' &&
    fb.orderNumber != null &&
    String(fb.orderNumber).trim() !== '';

  if (!hasId && !hasFb) {
    throw new Error('Order id or distributorCode + orderNumber is required to save invoice');
  }

  const basePayload = {
    shipping_invoice_data: data,
    shipping_invoice_file_name: invoicePatch.shipping_invoice_file_name ?? 'invoice',
    shipping_invoice_mime_type: invoicePatch.shipping_invoice_mime_type ?? 'application/octet-stream',
    updated_at: new Date().toISOString(),
  };

  const tryMatch = async (matchFn) => updateOrdersRowMatching(matchFn, basePayload);

  if (hasId) {
    const byId = await tryMatch((q) => q.eq('id', orderId));
    if (byId) return normalizeOrderRowStatus(byId);
  }

  if (hasFb) {
    for (const code of distributorCodeMatchVariants(fb.distributorCode)) {
      for (const orderNum of orderNumberMatchVariants(fb.orderNumber)) {
        const byKey = await tryMatch((q) =>
          q.eq('distributorCode', code).eq('orderNumber', orderNum)
        );
        if (byKey) return normalizeOrderRowStatus(byKey);
      }
    }
  }

  throw new Error(
    'No matching order found in the database. Refresh the shipping page and try again.'
  );
}

/**
 * Remove all shipping invoice files from an order row.
 * @param {string|null|undefined} orderId
 * @param {{ distributorCode?: string, orderNumber?: string|number }|null} identityFallback
 */
export async function clearOrderShippingInvoice(orderId, identityFallback = null) {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }

  const hasId = orderId != null && String(orderId).trim() !== '';
  const fb = identityFallback || {};
  const hasFb =
    fb.distributorCode != null &&
    String(fb.distributorCode).trim() !== '' &&
    fb.orderNumber != null &&
    String(fb.orderNumber).trim() !== '';

  if (!hasId && !hasFb) {
    throw new Error('Order id or distributorCode + orderNumber is required to clear invoice');
  }

  const basePayload = {
    shipping_invoice_data: null,
    shipping_invoice_file_name: null,
    shipping_invoice_mime_type: null,
    updated_at: new Date().toISOString(),
  };

  const tryMatch = async (matchFn) => updateOrdersRowMatching(matchFn, basePayload);

  if (hasId) {
    const byId = await tryMatch((q) => q.eq('id', orderId));
    if (byId) return normalizeOrderRowStatus(byId);
  }

  if (hasFb) {
    for (const code of distributorCodeMatchVariants(fb.distributorCode)) {
      for (const orderNum of orderNumberMatchVariants(fb.orderNumber)) {
        const byKey = await tryMatch((q) =>
          q.eq('distributorCode', code).eq('orderNumber', orderNum)
        );
        if (byKey) return normalizeOrderRowStatus(byKey);
      }
    }
  }

  throw new Error(
    'No matching order found in the database. Refresh the shipping page and try again.'
  );
}

/**
 * All order numbers in the database (for global uniqueness when placing orders).
 * @returns {Promise<string[]>}
 */
export async function fetchAllOrderNumbers() {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const pageSize = 1000;
    const all = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from('orders')
        .select('orderNumber')
        .range(from, from + pageSize - 1);

      if (error) throw error;

      const batch = data || [];
      for (const row of batch) {
        const n = row?.orderNumber;
        if (n != null && String(n).trim() !== '') all.push(n);
      }
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    return all;
  } catch (error) {
    console.error('Error fetching order numbers:', error);
    return [];
  }
}

/**
 * Get all orders (admin only)
 * @returns {Promise<Array>} Array of all order objects
 */
export async function getAllOrders() {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(normalizeOrderRowStatus);
  } catch (error) {
    console.error('Error getting all orders:', error);
    return [];
  }
}

/**
 * Subscribe to all order changes (shipping / admin refresh).
 * @param {Function} callback
 * @returns {Function} Unsubscribe
 */
export function subscribeToAllOrders(callback) {
  if (!supabase) {
    return () => {};
  }

  try {
    const subscription = supabase
      .channel('orders-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async () => {
          try {
            const orders = await getAllOrders();
            callback(orders);
          } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('Error in all-orders subscription callback:', error);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error unsubscribing from all orders:', error);
        }
      }
    };
  } catch (error) {
    console.error('Error setting up all-orders subscription:', error);
    return () => {};
  }
}

/**
 * Delete an order from Supabase
 * @param {string|null|undefined} orderId - Order row UUID (optional if identityFallback is set)
 * @param {{ distributorCode?: string, orderNumber?: string|number }|null} [identityFallback] - Match when id is missing or id delete matched no row
 */
function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

function normalizeDeleteFallback(identityFallback) {
  if (!identityFallback || typeof identityFallback !== 'object') return null;
  const code = String(identityFallback.distributorCode ?? '').trim();
  const on = String(identityFallback.orderNumber ?? '').trim();
  if (!code || !on) return null;
  const variants = orderNumberMatchVariants(on);
  return { distributorCode: code, orderNumber: variants[0] ?? on };
}

async function deleteOrdersRowByBusinessKey(fb) {
  for (const code of distributorCodeMatchVariants(fb.distributorCode)) {
    for (const orderNum of orderNumberMatchVariants(fb.orderNumber)) {
      const { data, error } = await supabase
        .from('orders')
        .delete()
        .eq('distributorCode', code)
        .eq('orderNumber', orderNum)
        .select('id');
      if (error) throw error;
      if (data && data.length > 0) return data;
    }
  }
  return null;
}

export async function deleteOrder(orderId, identityFallback = null) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const fb = normalizeDeleteFallback(identityFallback);
    const hasFb = fb != null;
    const idStr = isUuidLike(orderId) ? String(orderId).trim() : '';

    if (!idStr && !hasFb) {
      throw new Error('Order id or distributorCode + orderNumber required to delete');
    }

    // Resolve row by business key first (handles code case + orderNumber string/int mismatch).
    if (hasFb) {
      const existing = await fetchOrdersRowByBusinessKey(fb, 'id');
      if (existing?.id) {
        const { data, error } = await supabase.from('orders').delete().eq('id', existing.id).select('id');
        if (error) throw error;
        if (data && data.length > 0) return;
      }

      const deleted = await deleteOrdersRowByBusinessKey(fb);
      if (deleted && deleted.length > 0) return;
    }

    if (idStr) {
      const { data, error } = await supabase.from('orders').delete().eq('id', idStr).select('id');
      if (error) throw error;
      if (data && data.length > 0) return;

      // Stale id on client — retry by business key if provided.
      if (hasFb) {
        const deleted = await deleteOrdersRowByBusinessKey(fb);
        if (deleted && deleted.length > 0) return;
      }
    }

    throw new Error(
      'No matching order found in the database. Refresh the page if this order was synced from another device.'
    );
  } catch (error) {
    console.error('Error deleting order:', error);
    throw new Error(error.message || 'Failed to delete order');
  }
}

/**
 * Run orders UPDATE with a matcher; retries stripping unknown columns (PGRST204).
 * Uses maybeSingle() so "0 rows" returns null instead of throwing PGRST116.
 * @param {Function} matchFn - (q) => q with .eq(...) chain applied
 * @param {Object} basePayload - fields to set
 * @returns {Promise<Object|null>} Updated row or null if no row matched
 */
const SHIPPING_INVOICE_DB_COLUMNS = new Set([
  'shipping_invoice_data',
  'shipping_invoice_file_name',
  'shipping_invoice_mime_type',
]);

async function updateOrdersRowMatching(matchFn, basePayload) {
  let updatePayload = { ...basePayload };
  const requestedInvoiceCols = [...SHIPPING_INVOICE_DB_COLUMNS].filter((col) =>
    Object.prototype.hasOwnProperty.call(basePayload, col)
  );
  for (let attempt = 0; attempt < 8; attempt += 1) {
    let q = supabase.from('orders').update(updatePayload);
    q = matchFn(q);
    const { data, error } = await q.select().maybeSingle();

    if (!error && data) return data;

    const missingColumnMatch =
      error?.code === 'PGRST204' && typeof error.message === 'string'
        ? error.message.match(/'([^']+)' column/)
        : null;
    const missingColumn = missingColumnMatch?.[1];

    if (missingColumn && Object.prototype.hasOwnProperty.call(updatePayload, missingColumn)) {
      if (missingColumn === 'status') {
        throw new Error(
          'The orders table has no `status` column. In Supabase: open SQL Editor and run ADD_ORDERS_STATUS_COLUMN.sql (ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT \'pending\';)'
        );
      }
      if (SHIPPING_INVOICE_DB_COLUMNS.has(missingColumn) && requestedInvoiceCols.includes(missingColumn)) {
        throw new Error(
          `The orders table is missing column "${missingColumn}". Run ADD_SHIPPING_ORDER_COLUMNS.sql in the Supabase SQL Editor, then try again.`
        );
      }
      const nextPayload = { ...updatePayload };
      delete nextPayload[missingColumn];
      updatePayload = nextPayload;
      continue;
    }

    if (error) throw error;
    return null;
  }

  throw new Error('Failed to update order after schema compatibility retries');
}

/**
 * Update order status in Supabase
 * @param {string|null|undefined} orderId - Order row UUID (optional if identityFallback is set)
 * @param {string} status - New status (pending|sent|approved|rejected|canceled|pending_email_failed)
 * @param {Object} extraFields - Additional fields to persist
 * @param {{ distributorCode?: string, orderNumber?: string|number }|null} identityFallback - Match row when id fails or is missing
 * @returns {Promise<Object|null>} Updated order or null
 */
export async function updateOrderStatus(orderId, status, extraFields = {}, identityFallback = null) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const hasId = orderId != null && String(orderId).trim() !== '';
    const fb = identityFallback || {};
    const hasFb =
      fb.distributorCode != null &&
      String(fb.distributorCode).trim() !== '' &&
      fb.orderNumber != null &&
      String(fb.orderNumber).trim() !== '';

    if (!hasId && !hasFb) return null;

    const appStatus = normalizeWorkflowStatusForWrite(status);
    const statusCandidates = databaseStatusWriteCandidates(appStatus);
    const rest = { ...(extraFields || {}) };
    delete rest.status;

    const basePayload = {
      ...rest,
      updated_at: new Date().toISOString()
    };

    if (hasId) {
      const byId = await updateOrdersRowMatchingWithStatusFallback(
        (q) => q.eq('id', orderId),
        basePayload,
        statusCandidates
      );
      if (byId) return normalizeOrderRowStatus(byId);
    }

    if (hasFb) {
      const byBizKey = await updateOrdersRowByBusinessKey(fb, basePayload, statusCandidates);
      if (byBizKey) return normalizeOrderRowStatus(byBizKey);
    }

    throw new Error(
      'No matching order found in the database. Refresh the page if this order was synced from another device.'
    );
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
}

/**
 * Update order row fields without touching `status` (e.g. invoice upload from shipping).
 * Any `status` or `id` key in `fields` is ignored so workflow cannot change accidentally.
 * @param {string|null|undefined} orderId
 * @param {Object} fields - snake_case column names for Supabase
 * @param {{ distributorCode?: string, orderNumber?: string|number }|null} identityFallback
 * @returns {Promise<Object|null>}
 */
export async function patchOrderFields(orderId, fields = {}, identityFallback = null) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const hasId = orderId != null && String(orderId).trim() !== '';
    const fb = identityFallback || {};
    const hasFb =
      fb.distributorCode != null &&
      String(fb.distributorCode).trim() !== '' &&
      fb.orderNumber != null &&
      String(fb.orderNumber).trim() !== '';

    if (!hasId && !hasFb) return null;

    const payload = {};
    for (const [k, v] of Object.entries(fields || {})) {
      const kl = String(k).toLowerCase();
      if (kl === "status" || kl === "id") continue;
      payload[k] = v;
    }
    if (Object.keys(payload).length === 0) return null;

    const basePayload = {
      ...payload,
      updated_at: new Date().toISOString(),
    };

    if (hasId) {
      const byId = await updateOrdersRowMatching((q) => q.eq('id', orderId), basePayload);
      if (byId) return normalizeOrderRowStatus(byId);
    }

    if (hasFb) {
      const byBizKey = await updateOrdersRowByBusinessKey(fb, basePayload);
      if (byBizKey) return normalizeOrderRowStatus(byBizKey);
    }

    throw new Error(
      'No matching order found in the database. Refresh the page if this order was synced from another device.'
    );
  } catch (error) {
    console.error('Error patching order fields:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time order updates for a distributor
 * @param {string} distributorCode - Distributor code
 * @param {Function} callback - Callback function that receives orders array
 * @returns {Function} Unsubscribe function
 */
export function subscribeToOrders(distributorCode, callback) {
  if (!supabase) {
    return () => {};
  }

  const code = String(distributorCode || '').trim();
  if (!code) {
    return () => {};
  }

  try {
    const subscription = supabase
      .channel(`orders-${code}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `distributorCode=eq.${code}` },
        async () => {
          try {
            const orders = await getOrdersByDistributor(code);
            callback(orders);
          } catch (error) {
            if (error.name === 'AbortError') {
              console.log('Request aborted in subscription callback, ignoring');
              return;
            }
            console.error('Error in orders subscription callback:', error);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error unsubscribing from orders:', error);
        }
      }
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Subscription aborted, ignoring');
      return () => {};
    }
    console.error('Error setting up orders subscription:', error);
    return () => {};
  }
}

// ==================== ADMIN MANAGEMENT ====================

/**
 * Get all admins
 * @returns {Promise<Array>} Array of admin objects
 */
export async function getAllAdmins() {
  try {
    if (!supabase) {
      console.warn('Supabase not initialized, returning empty array');
      return [];
    }

    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // Handle table doesn't exist error gracefully
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Admins table does not exist yet. Please create it in Supabase.');
        return [];
      }
      throw error;
    }

    // Transform data to match expected format
    return (data || []).map(admin => ({
      id: admin.id || admin.uid,
      uid: admin.uid || admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role || 'admin',
      permissions: admin.permissions,
      createdAt: admin.created_at,
      ...admin
    }));
  } catch (error) {
    console.error('Error getting all admins:', error);
    return [];
  }
}

/**
 * Get admin by UID
 * @param {string} uid - User UID
 * @returns {Promise<Object|null>} Admin object or null
 */
export async function getAdminByUid(uid) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .or(`uid.eq.${uid},id.eq.${uid}`)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error getting admin by UID:', error);
    return null;
  }
}

function isAuthEmailAlreadyRegisteredError(authError) {
  const msg = String(authError?.message || '').toLowerCase();
  return (
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('user already registered')
  );
}

/**
 * Link an existing Supabase Auth account to the admins table (orphaned Auth user).
 * Requires LINK_AUTH_USER_AS_ADMIN.sql RPC in Supabase.
 */
async function linkExistingAuthUserAsAdmin({ email, name, role, permissions }) {
  const normalizedEmail = String(email || '').trim();
  const resolvedRole = role || 'admin';
  const resolvedPermissions = permissions || resolvePermissionsForRole(resolvedRole);

  const { data, error } = await supabase.rpc('link_auth_user_as_admin', {
    user_email: normalizedEmail,
    user_name: name || normalizedEmail.split('@')[0],
    user_role: resolvedRole,
    user_permissions: resolvedPermissions,
  });

  if (error) {
    const hint =
      'Run LINK_AUTH_USER_AS_ADMIN.sql in Supabase SQL Editor once, or delete the user under ' +
      'Authentication → Users and try again.';
    throw new Error(
      `This email is already in Supabase Auth but not set up as an admin. ${hint} (${error.message})`
    );
  }

  console.log('✅ Linked existing Supabase Auth user to admins table');
  return data;
}

/**
 * Create an admin account
 * @param {Object} adminData - Admin data
 * @returns {Promise<Object>} Created admin data
 */
export async function createAdminAccount(adminData) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { email, password, name, role, permissions } = adminData;

    // Check if admin already exists in database by email
    const { data: existingAdmin, error: checkError } = await supabase
      .from('admins')
      .select('id, uid, email')
      .eq('email', email)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      console.warn('Error checking for existing admin:', checkError);
    }

    if (existingAdmin) {
      throw new Error('A user with this email already exists in the database');
    }

    // Create Supabase Auth user
    // Note: If email confirmation is enabled in Supabase, the user will need to confirm their email
    // To disable email confirmation, go to Supabase Dashboard → Authentication → Settings → Email Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
          role: role || 'admin'
        }
      }
    });

    if (authError) {
      if (isAuthEmailAlreadyRegisteredError(authError)) {
        return await linkExistingAuthUserAsAdmin({
          email,
          name,
          role,
          permissions,
        });
      }
      throw authError;
    }
    
    if (!authData.user) {
      throw new Error('Failed to create user in Supabase Auth');
    }

    // Create admin document in database
    const adminDoc = {
      uid: authData.user.id,
      id: authData.user.id, // Also set id field for compatibility
      email,
      name: name || email.split('@')[0],
      role: role || 'admin',
      permissions: permissions || resolvePermissionsForRole(role || 'admin'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error: insertError } = await supabase
      .from('admins')
      .insert([adminDoc])
      .select()
      .single();

    if (insertError) {
      // If database insert fails but user was created in Auth, we should log this
      console.error('User created in Auth but failed to create admin document:', insertError);
      throw new Error(`User created in Supabase Auth but failed to save to database: ${insertError.message}`);
    }

    console.log('✅ User created successfully in both Supabase Auth and database');
    return data;
  } catch (error) {
    console.error('Error creating admin account:', error);
    const errorMessage = error?.message || error?.toString() || 'Failed to create admin account';
    throw new Error(errorMessage);
  }
}

/**
 * Get user permissions
 * @param {string} uid - User UID
 * @returns {Promise<Object>} Permissions object
 */
export async function getUserPermissions(uid) {
  try {
    const admin = await getAdminByUid(uid);
    return admin?.permissions || {};
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return {};
  }
}

/**
 * Check if user has a specific permission
 * @param {string} permission - Permission to check
 * @returns {Promise<boolean>} True if user has permission
 */
export async function hasPermission(permission) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const permissions = await getUserPermissions(user.id);
    return permissions[permission] === true;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Delete user from Supabase Auth
 * This requires a Supabase Edge Function with Admin API access
 * @param {string} uid - User UID
 * @returns {Promise<Object>} Result object with success status
 */
export async function deleteUserFromAuth(uid) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    // Try to call Supabase Edge Function for user deletion
    // The Edge Function should use Admin API to delete the user
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: uid }
      });

      if (error) {
        // Edge function might not exist, that's okay
        console.warn('Edge function not available or error calling it:', error);
        return {
          success: true,
          deletedFromAuth: false,
          message: 'User deleted from database. Note: Supabase Auth account may still exist. Set up Edge Function to delete from Auth.',
          warning: 'Edge Function "delete-user" not found. Please deploy it first. See SUPABASE_MIGRATION_GUIDE.md'
        };
      }

      if (data?.success) {
        return {
          success: true,
          deletedFromAuth: true,
          message: 'User deleted from Supabase Auth successfully'
        };
      } else {
        return {
          success: true,
          deletedFromAuth: false,
          message: data?.message || 'User deleted from database. Auth deletion may have failed.',
          warning: data?.error || 'Could not delete from Auth'
        };
      }
    } catch (functionError) {
      // Edge function might not be set up, that's okay - we'll still delete from database
      console.warn('Edge Function not available or error calling it:', functionError);
      return {
        success: true,
        deletedFromAuth: false,
        message: 'User deleted from database. Note: Supabase Auth account may still exist. Set up Edge Function to delete from Auth.',
        warning: 'Edge Function "delete-user" not found. Please deploy it first. See SUPABASE_MIGRATION_GUIDE.md'
      };
    }
  } catch (error) {
    console.error('Error deleting user from Auth:', error);
    return {
      success: false,
      deletedFromAuth: false,
      error: error.message || 'Failed to delete user from Supabase Auth',
      warning: 'Could not delete from Supabase Auth. User will only be deleted from database.'
    };
  }
}

/**
 * Update user last active timestamp
 * @param {string} uid - User UID
 */
export async function updateUserLastActive(uid) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { error } = await supabase
      .from('admins')
      .update({ last_active: new Date().toISOString() })
      .eq('uid', uid);

    if (error) throw error;
  } catch (error) {
    // AbortError is expected when requests are cancelled (e.g., component unmounts)
    // Don't log it as an error, just return silently
    if (error?.name === 'AbortError' || error?.message?.includes('aborted') || error?.message?.includes('AbortError')) {
      // Silently ignore AbortErrors - they're expected behavior
      return;
    }
    // Only log non-AbortError errors
    console.warn('Error updating last active (non-blocking):', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * List all users from Supabase Auth
 * @returns {Promise<Array>} Array of user objects
 */
export async function listUsersFromAuth() {
  try {
    // Note: Supabase doesn't have a client-side method to list all users
    // This would require a server-side function or admin API
    console.warn('Listing users requires server-side function');
    return [];
  } catch (error) {
    console.error("Error listing users from Supabase Auth:", error);
    return [];
  }
}

/**
 * Delete user document from database
 * @param {string} uid - User UID (can be id or uid field)
 * @param {string} email - Optional email to also try deleting by email
 */
export async function deleteUserDocument(uid, email = null) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    if (!uid && !email) {
      throw new Error('User ID or email is required');
    }

    console.log(`🗑️ Attempting to delete user with ID: ${uid}${email ? `, Email: ${email}` : ''}`);

    let deleted = false;
    let lastError = null;

    // Try deleting by uid field first (most common in Supabase)
    if (uid) {
      console.log(`Trying to delete by uid field: ${uid}`);
      const { data: deleteByUidData, error: deleteByUidError } = await supabase
        .from('admins')
        .delete()
        .eq('uid', uid)
        .select();

      if (deleteByUidError) {
        console.warn(`Could not delete by uid: ${deleteByUidError.message}`);
        lastError = deleteByUidError;
      } else if (deleteByUidData && deleteByUidData.length > 0) {
        deleted = true;
        console.log(`✅ User deleted from admins table by uid: ${uid}`, deleteByUidData);
      }

      // If not deleted by uid, try by id field
      if (!deleted) {
        console.log(`Trying to delete by id field: ${uid}`);
        const { data: deleteByIdData, error: deleteByIdError } = await supabase
          .from('admins')
          .delete()
          .eq('id', uid)
          .select();

        if (deleteByIdError) {
          console.warn(`Could not delete by id: ${deleteByIdError.message}`);
          lastError = deleteByIdError;
        } else if (deleteByIdData && deleteByIdData.length > 0) {
          deleted = true;
          console.log(`✅ User deleted from admins table by id: ${uid}`, deleteByIdData);
        }
      }
    }

    // If still not deleted and email is provided, try deleting by email
    if (!deleted && email) {
      console.log(`Trying to delete by email: ${email}`);
      const { data: deleteByEmailData, error: deleteByEmailError } = await supabase
        .from('admins')
        .delete()
        .eq('email', email)
        .select();

      if (deleteByEmailError) {
        console.warn(`Could not delete by email: ${deleteByEmailError.message}`);
        lastError = deleteByEmailError;
      } else if (deleteByEmailData && deleteByEmailData.length > 0) {
        deleted = true;
        console.log(`✅ User deleted from admins table by email: ${email}`, deleteByEmailData);
      }
    }

    // If still not deleted, check if user exists in Supabase Auth but not in admins table
    // This can happen if user was created in Auth but admin record was never created
    if (!deleted && (uid || email)) {
      console.log(`Checking if user exists in Supabase Auth...`);
      try {
        // Try to find user in Auth by email
        if (email) {
          const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
          if (!listError && authUsers && authUsers.users) {
            const authUser = authUsers.users.find(u => 
              u.email?.toLowerCase() === email.toLowerCase()
            );
            if (authUser) {
              console.log(`⚠️ User found in Supabase Auth but not in admins table. Auth ID: ${authUser.id}`);
              // User exists in Auth but not in admins table - this is okay, just mark as handled
              // We can't delete from Auth without admin API, but we can remove from UI
              console.log(`ℹ️ User exists in Auth but not in database. Will be removed from UI only.`);
              deleted = true; // Mark as handled so UI can remove it
            }
          }
        }
      } catch (authError) {
        // Admin API might not be available, that's okay
        console.warn('Could not check Supabase Auth (admin API may not be available):', authError);
      }
    }

    if (!deleted) {
      // Check if user exists at all by id/uid or email
      let checkQuery = supabase
        .from('admins')
        .select('id, uid, email, role');
      
      if (uid) {
        checkQuery = checkQuery.or(`uid.eq.${uid},id.eq.${uid}`);
      }
      if (email) {
        if (uid) {
          checkQuery = checkQuery.or(`uid.eq.${uid},id.eq.${uid},email.eq.${email}`);
        } else {
          checkQuery = checkQuery.eq('email', email);
        }
      }
      
      const { data: checkUser, error: checkError } = await checkQuery;

      if (checkError) {
        console.error('Error checking if user exists:', checkError);
      } else if (checkUser && checkUser.length > 0) {
        console.warn(`⚠️ User exists but could not be deleted with provided ID. Found records:`, checkUser);
        
        // If multiple users found with same email, try deleting all by email
        if (checkUser.length > 1 && email) {
          console.log(`Found ${checkUser.length} users with email ${email}. Attempting to delete all duplicates...`);
          const { data: deleteAllData, error: deleteAllError } = await supabase
            .from('admins')
            .delete()
            .eq('email', email)
            .select();
          
          if (deleteAllError) {
            throw new Error(`Found ${checkUser.length} duplicate users with email ${email}, but could not delete them: ${deleteAllError.message}`);
          } else if (deleteAllData && deleteAllData.length > 0) {
            deleted = true;
            console.log(`✅ Deleted ${deleteAllData.length} duplicate user(s) with email: ${email}`);
          }
        } else if (checkUser.length === 1) {
          // Single user found but ID didn't match - try deleting with the actual ID from database
          const actualUser = checkUser[0];
          console.log(`🔄 User found with different ID. Actual ID: ${actualUser.id}, UID: ${actualUser.uid}. Attempting deletion with actual ID...`);
          
          // Try deleting with the actual ID from the database
          const actualId = actualUser.id || actualUser.uid;
          if (actualId) {
            const { data: deleteByActualIdData, error: deleteByActualIdError } = await supabase
              .from('admins')
              .delete()
              .eq('id', actualId)
              .select();
            
            if (deleteByActualIdError) {
              // Try by uid
              const { data: deleteByActualUidData, error: deleteByActualUidError } = await supabase
                .from('admins')
                .delete()
                .eq('uid', actualId)
                .select();
              
              if (deleteByActualUidError) {
                throw new Error(`User exists but deletion failed. Last error: ${deleteByActualUidError.message || lastError?.message || 'Unknown error'}`);
              } else if (deleteByActualUidData && deleteByActualUidData.length > 0) {
                deleted = true;
                console.log(`✅ User deleted using actual UID from database: ${actualId}`);
              }
            } else if (deleteByActualIdData && deleteByActualIdData.length > 0) {
              deleted = true;
              console.log(`✅ User deleted using actual ID from database: ${actualId}`);
            }
          } else {
            throw new Error(`User exists but deletion failed. Last error: ${lastError?.message || 'Unknown error'}`);
          }
        } else {
          throw new Error(`User exists but deletion failed. Last error: ${lastError?.message || 'Unknown error'}`);
        }
      } else {
        console.warn(`⚠️ User not found in admins table with id/uid: ${uid}${email ? `, email: ${email}` : ''}`);
        // User doesn't exist in database - this is okay, they might only exist in Auth
        // Mark as handled so UI can remove them
        deleted = true;
        console.log(`ℹ️ User not in database (may only exist in Supabase Auth). Will be removed from UI.`);
      }
    }

    // Also try to delete from distributors table (if they exist there)
    try {
      if (uid) {
        const { error: distributorError } = await supabase
          .from('distributors')
          .delete()
          .eq('uid', uid);

        if (distributorError && !distributorError.message?.includes('No rows')) {
          // Try by id as well
          await supabase
            .from('distributors')
            .delete()
            .eq('id', uid);
        }
      }
    } catch (distError) {
      console.warn('Could not delete from distributors table:', distError);
      // Don't throw - distributors deletion is optional
    }

    return { success: true, deleted };
  } catch (error) {
    console.error('Error deleting user document:', error);
    return { 
      success: false, 
      deleted: false, 
      error: error.message || error.toString() 
    };
  }
}

/**
 * Check if username is taken
 * @param {string} username - Username to check
 * @param {string|null} excludeId - ID to exclude from check
 * @returns {Promise<boolean>} True if username is taken
 */
export async function isUsernameTaken(username, excludeId = null) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    let query = supabase
      .from('distributors')
      .select('code')
      .eq('username', username);

    if (excludeId) {
      query = query.neq('code', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data && data.length > 0);
  } catch (error) {
    console.error('Error checking username:', error);
    return false;
  }
}

/**
 * Check if email is taken
 * @param {string} email - Email to check
 * @param {string|null} excludeId - ID to exclude from check
 * @returns {Promise<boolean>} True if email is taken
 */
export async function isEmailTaken(email, excludeId = null) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    // Check in distributors
    let query = supabase
      .from('distributors')
      .select('code')
      .eq('email', email);

    if (excludeId) {
      query = query.neq('code', excludeId);
    }

    const { data: distributorData, error: distError } = await query;
    if (distError) throw distError;

    if (distributorData && distributorData.length > 0) {
      return true;
    }

    // Check in admins
    let adminQuery = supabase
      .from('admins')
      .select('uid')
      .eq('email', email);

    if (excludeId) {
      adminQuery = adminQuery.neq('uid', excludeId);
    }

    const { data: adminData, error: adminError } = await adminQuery;
    if (adminError) throw adminError;

    return (adminData && adminData.length > 0);
  } catch (error) {
    console.error('Error checking email:', error);
    return false;
  }
}

// ==================== SALES DATA MANAGEMENT ====================

/**
 * Save sales data to Supabase
 * @param {Object} salesData - Sales data object
 * @returns {Promise<Object>} Saved sales data
 */
export async function saveSalesData(salesData) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const salesDoc = {
      ...salesData,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('sales_data')
      .insert([salesDoc])
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error saving sales data:', error);
    throw error;
  }
}

/**
 * Save multiple sales data records in batch
 * @param {Array} salesDataArray - Array of sales data objects
 * @returns {Promise<Array>} Array of saved sales data
 */
const SALES_INSERT_CHUNK_SIZE = 150;

export async function saveSalesDataBatch(salesDataArray) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const toRow = (data) => {
      const code = data.distributorCode != null && data.distributorCode !== ''
        ? String(data.distributorCode).trim()
        : null;
      return {
        ...data,
        distributorCode: code,
        products: Array.isArray(data.products) ? data.products : [],
        created_at: new Date().toISOString()
      };
    };

    const allReturned = [];
    for (let i = 0; i < salesDataArray.length; i += SALES_INSERT_CHUNK_SIZE) {
      const chunk = salesDataArray.slice(i, i + SALES_INSERT_CHUNK_SIZE).map(toRow);
      const { data, error } = await supabase
        .from('sales_data')
        .insert(chunk)
        .select();

      if (error) {
        console.error(`sales_data insert failed at offset ${i} (chunk size ${chunk.length}):`, error);
        throw error;
      }
      if (data && data.length) {
        allReturned.push(...data);
      }
    }

    return allReturned;
  } catch (error) {
    console.error('Error saving sales data batch:', error);
    throw error;
  }
}

/**
 * Get sales data by date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Array of sales data objects
 */
export async function getSalesDataByDateRange(startDate, endDate) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { data, error } = await supabase
      .from('sales_data')
      .select('*')
      .gte('invoiceDate', startDate.toISOString())
      .lte('invoiceDate', endDate.toISOString())
      .order('invoiceDate', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error getting sales data by date range:', error);
    return [];
  }
}

/**
 * Get all sales data
 * @returns {Promise<Array>} Array of all sales data objects
 */
export async function getAllSalesData() {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { data, error } = await supabase
      .from('sales_data')
      .select('*')
      .order('invoiceDate', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error getting all sales data:', error);
    return [];
  }
}

/**
 * Delete all sales data from admin
 * @returns {Promise<number>} Number of deleted records
 */
export async function deleteAllSalesDataFromAdmin() {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { data, error } = await supabase
      .from('sales_data')
      .delete()
      .eq('source', 'excel_upload')
      .select();

    if (error) throw error;

    return data?.length || 0;
  } catch (error) {
    console.error('Error deleting sales data:', error);
    throw error;
  }
}

/**
 * Get stock lifting records for a distributor (one row per sales_data upload row).
 * Multiple liftings on the same calendar day are kept separate (no longer merged by date).
 * @param {string} distributorCode - Distributor code
 * @param {Date} startDate - Optional start date filter
 * @param {Date} endDate - Optional end date filter
 * @returns {Promise<Array>} Array of stock lifting records, newest first
 */
export async function getStockLiftingRecords(distributorCode, startDate = null, endDate = null) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const code = distributorCode != null ? String(distributorCode).trim() : '';
    let query = supabase
      .from('sales_data')
      .select('*')
      .eq('distributorCode', code);

    if (startDate) {
      query = query.gte('invoiceDate', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('invoiceDate', endDate.toISOString());
    }

    const { data, error } = await query.order('invoiceDate', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return [];
    }

    const read = (row, keys, fallback = null) => {
      for (const key of keys) {
        if (row && Object.prototype.hasOwnProperty.call(row, key) && row[key] !== undefined && row[key] !== null) {
          return row[key];
        }
      }
      return fallback;
    };

    // One UI row per saved sales row (supports multiple liftings same day)
    return data.map((record) => {
      const inv = read(record, ['invoiceDate', 'invoice_date'], null);
      const dateIso = inv ? new Date(inv).toISOString() : null;
      return {
        id: record.id,
        date: dateIso ? dateIso.split('T')[0] : null,
        invoiceDate: inv,
        timestamp: inv,
        created_at: read(record, ['created_at', 'createdAt'], inv),
        csdPC: Number(read(record, ['csdPC', 'csd_pc'], 0) || 0),
        csdUC: Number(read(record, ['csdUC', 'csd_uc'], 0) || 0),
        waterPC: Number(read(record, ['waterPC', 'water_pc'], 0) || 0),
        waterUC: Number(read(record, ['waterUC', 'water_uc'], 0) || 0),
        products: Array.isArray(record.products) ? record.products : [],
      };
    }).sort((a, b) => {
      const ta = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
      const tb = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
      return tb - ta;
    });
  } catch (error) {
    console.error('Error getting stock lifting records:', error);
    return [];
  }
}

/**
 * Subscribe to real-time sales data updates
 * @param {Function} callback - Callback function that receives sales data array
 * @returns {Function} Unsubscribe function
 */
export function subscribeToSalesData(callback) {
  if (!supabase) {
    return () => {};
  }

  try {
    const subscription = supabase
      .channel('sales-data-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sales_data' },
        async () => {
          try {
            const salesData = await getAllSalesData();
            callback(salesData);
          } catch (error) {
            if (error.name === 'AbortError') {
              console.log('Request aborted in subscription callback, ignoring');
              return;
            }
            console.error('Error in sales data subscription callback:', error);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error unsubscribing from sales data:', error);
        }
      }
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Subscription aborted, ignoring');
      return () => {};
    }
    console.error('Error setting up sales data subscription:', error);
    return () => {};
  }
}

// ==================== TARGETS MANAGEMENT ====================

/**
 * Save or update targets for a distributor in Supabase
 * @param {string} distributorCode - Distributor code
 * @param {Object} targetData - Target values { CSD_PC, CSD_UC, Water_PC, Water_UC }
 * @returns {Promise<Object>} Saved target data
 */
export async function saveTarget(distributorCode, targetData) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const currentUser = await getCurrentUser();
    const targetDoc = {
      distributorCode: distributorCode,
      CSD_PC: Number(targetData.CSD_PC || 0),
      CSD_UC: Number(targetData.CSD_UC || 0),
      Water_PC: Number(targetData.Water_PC || 0),
      Water_UC: Number(targetData.Water_UC || 0),
      updated_at: new Date().toISOString(),
      updated_by: currentUser?.email || currentUser?.id || 'unknown'
    };

    const { data, error } = await supabase
      .from('targets')
      .upsert({ ...targetDoc, id: distributorCode }, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error saving target:', error);
    throw error;
  }
}

/**
 * Save multiple targets in batch
 * @param {Object} targetsMap - Map of { distributorCode: { CSD_PC, CSD_UC, Water_PC, Water_UC }, ... }
 * @returns {Promise<Array>} Array of saved target data
 */
export async function saveTargetsBatch(targetsMap) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const currentUser = await getCurrentUser();
    const targets = Object.entries(targetsMap).map(([distributorCode, targetData]) => ({
      id: distributorCode,
      distributorCode: distributorCode,
      CSD_PC: Number(targetData.CSD_PC || 0),
      CSD_UC: Number(targetData.CSD_UC || 0),
      Water_PC: Number(targetData.Water_PC || 0),
      Water_UC: Number(targetData.Water_UC || 0),
      updated_at: new Date().toISOString(),
      updated_by: currentUser?.email || currentUser?.id || 'unknown'
    }));

    const { data, error } = await supabase
      .from('targets')
      .upsert(targets, { onConflict: 'id' })
      .select();

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error saving targets batch:', error);
    throw error;
  }
}

/**
 * Delete multiple target rows by distributor codes.
 * Also clears localStorage target cache keys for deleted distributors.
 * @param {string[]} distributorCodes - Distributor codes to delete
 * @returns {Promise<number>} Number of deleted rows
 */
export async function deleteTargetsBatch(distributorCodes = []) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const codes = Array.from(new Set((distributorCodes || []).filter(Boolean)));
    if (codes.length === 0) return 0;

    let deletedCount = 0;

    // Delete by primary id first.
    const { data: byIdData, error: byIdError } = await supabase
      .from('targets')
      .delete()
      .in('id', codes)
      .select();

    if (byIdError) throw byIdError;
    deletedCount += byIdData?.length || 0;

    // Backward compatibility: if records are keyed by distributorCode.
    const { data: byCodeData, error: byCodeError } = await supabase
      .from('targets')
      .delete()
      .in('distributorCode', codes)
      .select();

    if (byCodeError) throw byCodeError;
    deletedCount += byCodeData?.length || 0;

    // Keep local cache in sync.
    try {
      const stored = localStorage.getItem('targets');
      if (stored) {
        const targetsMap = JSON.parse(stored);
        codes.forEach((code) => delete targetsMap[code]);
        localStorage.setItem('targets', JSON.stringify(targetsMap));
      }
    } catch (cacheError) {
      console.warn('Could not update local target cache after delete:', cacheError);
    }

    return deletedCount;
  } catch (error) {
    console.error('Error deleting targets batch:', error);
    throw error;
  }
}

/**
 * Get target for a specific distributor
 * @param {string} distributorCode - Distributor code
 * @returns {Promise<Object|null>} Target object or null
 */
export async function getTarget(distributorCode) {
  try {
    if (!supabase) {
      console.warn('Supabase not initialized');
      return null;
    }

    const { data, error } = await supabase
      .from('targets')
      .select('*')
      .eq('distributorCode', distributorCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      // Handle table doesn't exist error gracefully
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Targets table does not exist yet. Please create it in Supabase.');
        return null;
      }
      throw error;
    }

    if (data) {
      // Cache in localStorage as fallback
      try {
        const stored = localStorage.getItem('targets') || '{}';
        const targetsMap = JSON.parse(stored);
        targetsMap[distributorCode] = {
          CSD_PC: data.CSD_PC || 0,
          CSD_UC: data.CSD_UC || 0,
          Water_PC: data.Water_PC || 0,
          Water_UC: data.Water_UC || 0,
          updatedAt: data.updated_at,
          updatedBy: data.updated_by
        };
        localStorage.setItem('targets', JSON.stringify(targetsMap));
      } catch (e) {
        // Ignore localStorage errors
      }

      return {
        CSD_PC: data.CSD_PC || 0,
        CSD_UC: data.CSD_UC || 0,
        Water_PC: data.Water_PC || 0,
        Water_UC: data.Water_UC || 0,
        updatedAt: data.updated_at,
        updatedBy: data.updated_by
      };
    }

    return null;
  } catch (error) {
    // Handle quota exceeded - fallback to localStorage
    if (error.message?.includes('quota') || error.message?.includes('exceeded')) {
      console.warn('⚠️ Supabase quota exceeded. Using cached target from localStorage.');
      try {
        const stored = localStorage.getItem('targets');
        if (stored) {
          const targetsMap = JSON.parse(stored);
          const targetData = targetsMap[distributorCode];
          if (targetData) {
            return targetData;
          }
        }
      } catch (e) {
        console.error('Error reading targets from localStorage:', e);
      }
    }
    console.error('Error getting target:', error);
    return null;
  }
}

/**
 * Subscribe to real-time target updates for a distributor
 * @param {string} distributorCode - Distributor code
 * @param {Function} callback - Callback function that receives target data (or null if not found)
 * @returns {Function} Unsubscribe function
 */
export function subscribeToTarget(distributorCode, callback) {
  if (!supabase) {
    console.warn('Supabase not initialized, cannot subscribe to target');
    return () => {};
  }

  if (!distributorCode) {
    console.warn('Distributor code is required for target subscription');
    return () => {};
  }

  try {
    const subscription = supabase
      .channel(`target-${distributorCode}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'targets', filter: `distributorCode=eq.${distributorCode}` },
        async () => {
          try {
            const targetData = await getTarget(distributorCode);
            if (targetData) {
              console.log(`🔄 Target updated for distributor ${distributorCode}:`, targetData);
              callback(targetData);
            } else {
              console.log(`⚠️ No target found in targets collection for ${distributorCode}`);
              callback(null);
            }
          } catch (error) {
            if (error.name === 'AbortError') {
              console.log('Request aborted in subscription callback, ignoring');
              return;
            }
            console.error('Error in target subscription callback:', error);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error unsubscribing from target:', error);
        }
      }
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Subscription aborted, ignoring');
      return () => {};
    }
    console.error('Error setting up target subscription:', error);
    return () => {};
  }
}

/**
 * Get all targets from Supabase
 * @returns {Promise<Object>} Map of { distributorCode: { CSD_PC, CSD_UC, Water_PC, Water_UC }, ... }
 */
export async function getAllTargets() {
  try {
    if (!supabase) {
      console.warn('Supabase not initialized, returning empty targets map');
      return {};
    }

    const { data, error } = await supabase
      .from('targets')
      .select('*');

    if (error) {
      // Handle table doesn't exist error gracefully
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Targets table does not exist yet. Please create it in Supabase.');
        return {};
      }
      throw error;
    }

    const targetsMap = {};
    (data || []).forEach(target => {
      targetsMap[target.distributorCode || target.id] = {
        CSD_PC: target.CSD_PC || 0,
        CSD_UC: target.CSD_UC || 0,
        Water_PC: target.Water_PC || 0,
        Water_UC: target.Water_UC || 0,
        updatedAt: target.updated_at,
        updatedBy: target.updated_by
      };
    });

    console.log(`✅ Loaded ${Object.keys(targetsMap).length} targets from Supabase`);
    return targetsMap;
  } catch (error) {
    console.error('Error getting all targets:', error);
    return {};
  }
}

// ==================== SCHEMES & DISCOUNTS MANAGEMENT ====================

/**
 * Save or update a scheme/discount in Supabase
 * @param {Object} schemeData - Scheme data
 * @returns {Promise<Object>} Saved scheme data
 */
export async function saveScheme(schemeData) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    if (!schemeData.id) {
      throw new Error('Scheme ID is required');
    }

    const currentUser = await getCurrentUser();
    
    // Prepare complete scheme document with all fields
    // Core fields that should always exist
    const coreSchemeDoc = {
      id: schemeData.id,
      type: schemeData.type,
      name: schemeData.name,
      startDate: schemeData.startDate || schemeData.start_date,
      endDate: schemeData.endDate || schemeData.end_date,
      distributors: Array.isArray(schemeData.distributors) ? schemeData.distributors : [],
      buyQuantity: schemeData.buyQuantity || null,
      freeQuantity: schemeData.freeQuantity || null,
      category: schemeData.category || null,
      updated_at: new Date().toISOString(),
      updated_by: currentUser?.email || currentUser?.id || 'unknown'
    };

    if (!coreSchemeDoc.created_at) {
      coreSchemeDoc.created_at = schemeData.createdAt || schemeData.created_at || new Date().toISOString();
    }

    // Optional fields that may not exist in schema yet
    const optionalFields = {
      appliesToSKUs: Array.isArray(schemeData.appliesToSKUs) ? schemeData.appliesToSKUs : [],
      appliesTo: schemeData.appliesTo || null,
      discountAmount: schemeData.discountAmount || schemeData.discountPerCase || null,
      discountPerCase: schemeData.discountPerCase || schemeData.discountAmount || null,
      schemeDescription: schemeData.schemeDescription || null
    };

    let data, error;
    
    try {
      // First try to save with all fields
      const fullSchemeDoc = { ...coreSchemeDoc, ...optionalFields };
      const result = await supabase
        .from('schemes')
        .upsert(fullSchemeDoc, { onConflict: 'id' })
        .select()
        .single();
      
      data = result.data;
      error = result.error;
      
      // If error is about missing columns, try saving without optional fields
      if (error) {
        const errorMessage = error?.message || error?.toString() || '';
        const missingColumnPatterns = ['appliesTo', 'schemeDescription', 'discountAmount', 'appliesToSKUs', 'discountPerCase'];
        const hasMissingColumn = missingColumnPatterns.some(col => 
          errorMessage.includes(col) || errorMessage.includes(`'${col}'`) || errorMessage.includes(`"${col}"`)
        );
        
        if (hasMissingColumn) {
          console.warn('⚠️ Some optional columns may be missing. Saving core fields first...');
          
          // Save core fields first
          const coreResult = await supabase
            .from('schemes')
            .upsert(coreSchemeDoc, { onConflict: 'id' })
            .select()
            .single();
          
          if (coreResult.error) {
            // Still failed, throw original error
            throw error;
          } else {
            // Success with core fields
            data = coreResult.data;
            error = null;
            console.warn('⚠️ Scheme saved with core fields. Optional fields skipped. Please run the migration SQL to add missing columns.');
            
            // Try to update optional fields separately (they may exist)
            const fieldsToUpdate = {};
            Object.keys(optionalFields).forEach(key => {
              if (optionalFields[key] !== null && optionalFields[key] !== undefined) {
                if (Array.isArray(optionalFields[key]) && optionalFields[key].length > 0) {
                  fieldsToUpdate[key] = optionalFields[key];
                } else if (!Array.isArray(optionalFields[key])) {
                  fieldsToUpdate[key] = optionalFields[key];
                }
              }
            });
            
            if (Object.keys(fieldsToUpdate).length > 0) {
              try {
                const updateResult = await supabase
                  .from('schemes')
                  .update(fieldsToUpdate)
                  .eq('id', schemeData.id)
                  .select()
                  .single();
                
                if (!updateResult.error && updateResult.data) {
                  console.log('✅ Optional fields also saved');
                  data = updateResult.data;
                }
              } catch (updateError) {
                // Ignore - columns don't exist
                console.warn('⚠️ Optional fields could not be saved (columns may not exist)');
              }
            }
          }
        } else {
          // Different error, throw it
          throw error;
        }
      } else {
        console.log('✅ Scheme saved successfully with all fields to Supabase');
      }
      
    } catch (upsertError) {
      const errorMessage = upsertError?.message || upsertError?.toString() || '';
      console.error('Error saving scheme:', errorMessage);
      throw upsertError;
    }

    if (error) {
      console.error('Supabase upsert error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error saving scheme:', error);
    throw error;
  }
}

/**
 * Get all schemes from Supabase
 * @returns {Promise<Array>} Array of scheme objects
 */
export async function getAllSchemes() {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { data, error } = await supabase
      .from('schemes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const schemes = (data || []).map(scheme => ({
      id: scheme.id,
      ...scheme,
      startDate: scheme.startDate || scheme.start_date,
      endDate: scheme.endDate || scheme.end_date,
      createdAt: scheme.created_at,
      updatedAt: scheme.updated_at,
      distributors: Array.isArray(scheme.distributors) ? scheme.distributors : [],
      appliesToSKUs: Array.isArray(scheme.appliesToSKUs)
        ? scheme.appliesToSKUs
        : (Array.isArray(scheme.applies_to_skus) ? scheme.applies_to_skus : [])
    }));

    console.log(`✅ Loaded ${schemes.length} schemes from Supabase`);
    return schemes;
  } catch (error) {
    console.error('Error getting all schemes:', error);
    return [];
  }
}

/**
 * Get active schemes for a distributor
 * @param {string} distributorCode - Distributor code
 * @returns {Promise<Array>} Array of active scheme objects
 */
export async function getActiveSchemesForDistributor(distributorCode) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('schemes')
      .select('*')
      .lte('startDate', now)
      .gte('endDate', now);

    if (error) throw error;

    const activeSchemes = (data || []).filter(scheme => {
      const distributors = Array.isArray(scheme.distributors) ? scheme.distributors : [];
      return distributors.includes(distributorCode);
    });

    return activeSchemes.map(scheme => ({
      id: scheme.id,
      ...scheme,
      startDate: scheme.startDate || scheme.start_date,
      endDate: scheme.endDate || scheme.end_date,
      createdAt: scheme.created_at,
      updatedAt: scheme.updated_at,
      distributors: Array.isArray(scheme.distributors) ? scheme.distributors : [],
      appliesToSKUs: Array.isArray(scheme.appliesToSKUs)
        ? scheme.appliesToSKUs
        : (Array.isArray(scheme.applies_to_skus) ? scheme.applies_to_skus : [])
    }));
  } catch (error) {
    console.error('Error getting active schemes for distributor:', error);
    return [];
  }
}

/**
 * Delete a scheme from Supabase
 * @param {string} schemeId - Scheme ID
 */
export async function deleteScheme(schemeId) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const { error } = await supabase
      .from('schemes')
      .delete()
      .eq('id', schemeId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting scheme:', error);
    throw error;
  }
}

// ==================== PRODUCT RATES (app_config) ====================

/**
 * Get product rates from app_config table
 * @returns {Promise<Object|null>} Rates object or null if not set
 */
export async function getProductRates() {
  try {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .eq('id', 'product_rates')
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching product rates:', error);
      return null;
    }

    if (data && data.length > 0) {
      const row = data[0];

      // Preferred shape (if table has dedicated columns)
      if (row.skuRates || row.canRate) {
        return {
          skuRates: row.skuRates || {},
          canRate: row.canRate,
          customProducts: Array.isArray(row.customProducts) ? row.customProducts : [],
        };
      }

      // Fallback: parse JSON stored in existing text columns
      const candidates = [row.clientId, row.apiKey, row.gmail_client_id, row.gmail_api_key];
      for (const raw of candidates) {
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && (parsed.skuRates || parsed.canRate)) {
            return {
              skuRates: parsed.skuRates || {},
              canRate: parsed.canRate,
              customProducts: Array.isArray(parsed.customProducts) ? parsed.customProducts : [],
            };
          }
        } catch {
          // Ignore parse errors and try next column
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching product rates:', error);
    return null;
  }
}

/**
 * Save product rates + optional custom product catalogue to app_config table
 * @param {Object} rates - { skuRates, canRate, customProducts? }
 *   customProducts: [{ name, sku?, category, kgPerCase, ucMultiplier|null, rate }]
 * @returns {Promise<void>}
 */
export async function saveProductRates(rates) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    const payload = JSON.stringify({
      skuRates: rates?.skuRates || {},
      canRate: rates?.canRate,
      customProducts: Array.isArray(rates?.customProducts) ? rates.customProducts : [],
    });

    const { error } = await supabase
      .from('app_config')
      .upsert(
        {
          id: 'product_rates',
          clientId: payload,
          apiKey: payload,
          customProducts: rates?.customProducts ?? [],
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );

    if (error) {
      const noCustomCol =
        error.code === 'PGRST204' &&
        typeof error.message === 'string' &&
        error.message.includes('customProducts');
      if (noCustomCol) {
        const { error: err2 } = await supabase
          .from('app_config')
          .upsert(
            {
              id: 'product_rates',
              clientId: payload,
              apiKey: payload,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'id' }
          );
        if (err2) throw err2;
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error('Error saving product rates:', error);
    throw error;
  }
}

// ==================== ORDER ARCHIVE RETENTION (app_config) ====================

const ORDER_ARCHIVE_RETENTION_CONFIG_ID = 'order_archive_retention';

/**
 * Shared admin setting: days after delivery before orders move to History.
 * @returns {Promise<number|null>}
 */
export async function getOrderArchiveRetentionFromConfig() {
  try {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .eq('id', ORDER_ARCHIVE_RETENTION_CONFIG_ID)
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching order archive retention:', error);
      return null;
    }

    if (!data || data.length === 0) return null;

    const row = data[0];
    const candidates = [row.clientId, row.apiKey];
    for (const raw of candidates) {
      if (raw == null) continue;
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
        try {
          const parsed = JSON.parse(trimmed);
          const d = parsed?.retentionDays ?? parsed?.days ?? parsed?.value;
          if (d != null && Number.isFinite(Number(d))) return Number(d);
        } catch {
          /* ignore */
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching order archive retention:', error);
    return null;
  }
}

/**
 * @param {number} retentionDays
 */
export async function saveOrderArchiveRetentionToConfig(retentionDays) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }
    const payload = JSON.stringify({ retentionDays: Number(retentionDays) });
    const { error } = await supabase.from('app_config').upsert(
      {
        id: ORDER_ARCHIVE_RETENTION_CONFIG_ID,
        clientId: payload,
        apiKey: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
  } catch (error) {
    console.error('Error saving order archive retention:', error);
    throw error;
  }
}

// ==================== GLOBAL TARGET PERIOD (app_config) ====================

const GLOBAL_TARGET_PERIOD_ID = 'global_target_period';
const SALES_PERFORMANCE_LAST_UPDATED_ID = 'sales_performance_last_updated';
const GLOBAL_GST_SETTING_ID = 'global_gst_setting';

/**
 * @returns {Promise<{ start: string, end: string } | null>}
 */
export async function getGlobalTargetPeriod() {
  try {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .eq('id', GLOBAL_TARGET_PERIOD_ID)
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching global target period:', error);
      return null;
    }

    if (!data || data.length === 0) return null;

    const row = data[0];
    const candidates = [row.clientId, row.apiKey];
    for (const raw of candidates) {
      if (!raw || typeof raw !== 'string') continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.start && parsed.end) {
          return { start: String(parsed.start), end: String(parsed.end) };
        }
      } catch {
        // ignore
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching global target period:', error);
    return null;
  }
}

/**
 * @param {string} start - YYYY-MM-DD
 * @param {string} end - YYYY-MM-DD
 */
export async function saveGlobalTargetPeriod(start, end) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }
    const payload = JSON.stringify({ start, end });
    const { error } = await supabase
      .from('app_config')
      .upsert(
        {
          id: GLOBAL_TARGET_PERIOD_ID,
          clientId: payload,
          apiKey: payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    if (error) throw error;
  } catch (error) {
    console.error('Error saving global target period:', error);
    throw error;
  }
}

/**
 * When admin last saved sales rows that feed the performance table (ISO string or Date).
 * @returns {Promise<Date | null>}
 */
export async function getSalesPerformanceLastUpdated() {
  try {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .eq('id', SALES_PERFORMANCE_LAST_UPDATED_ID)
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching sales performance last updated:', error);
      return null;
    }

    if (!data || data.length === 0) return null;

    const row = data[0];
    const raw = row.updated_at || row.clientId || row.apiKey;
    if (!raw) return null;
    const d = new Date(typeof raw === 'string' ? raw : String(raw));
    return Number.isNaN(d.getTime()) ? null : d;
  } catch (error) {
    console.error('Error fetching sales performance last updated:', error);
    return null;
  }
}

/**
 * @param {string} [atIso] - defaults to now
 */
export async function saveSalesPerformanceLastUpdated(atIso) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }
    const iso = atIso || new Date().toISOString();
    const { error } = await supabase
      .from('app_config')
      .upsert(
        {
          id: SALES_PERFORMANCE_LAST_UPDATED_ID,
          clientId: iso,
          apiKey: iso,
          updated_at: iso,
        },
        { onConflict: 'id' }
      );
    if (error) throw error;
  } catch (error) {
    console.error('Error saving sales performance last updated:', error);
    throw error;
  }
}

/**
 * Global GST switch for order calculations (admin-managed).
 * @returns {Promise<boolean|null>} true/false when stored, null when unset/unavailable
 */
export async function getGlobalGstEnabled() {
  try {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .eq('id', GLOBAL_GST_SETTING_ID)
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching global GST setting:', error);
      return null;
    }
    if (!data || data.length === 0) return null;

    const row = data[0];
    const candidates = [row.clientId, row.apiKey];
    for (const raw of candidates) {
      if (raw == null) continue;
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && typeof parsed.enabled === 'boolean') {
            return parsed.enabled;
          }
        } catch {
          const normalized = raw.trim().toLowerCase();
          if (normalized === 'true' || normalized === '1') return true;
          if (normalized === 'false' || normalized === '0') return false;
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching global GST setting:', error);
    return null;
  }
}

/**
 * Persist global GST switch for all distributors.
 * @param {boolean} enabled
 */
export async function saveGlobalGstEnabled(enabled) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }
    const boolEnabled = !!enabled;
    const payload = JSON.stringify({ enabled: boolEnabled });
    const { error } = await supabase
      .from('app_config')
      .upsert(
        {
          id: GLOBAL_GST_SETTING_ID,
          clientId: payload,
          apiKey: payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    if (error) throw error;
  } catch (error) {
    console.error('Error saving global GST setting:', error);
    throw error;
  }
}

/**
 * Read GST policy with default + optional per-region overrides.
 * @returns {Promise<{defaultEnabled:boolean, regionEnabled:Record<string, boolean>}|null>}
 */
export async function getGlobalGstPolicy() {
  try {
    const enabled = await getGlobalGstEnabled();
    if (enabled == null) return null;

    if (!supabase) return { defaultEnabled: enabled, regionEnabled: {}, distributorEnabled: {} };

    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .eq('id', GLOBAL_GST_SETTING_ID)
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching global GST policy:', error);
      return { defaultEnabled: enabled, regionEnabled: {}, distributorEnabled: {} };
    }
    if (!data || data.length === 0) return { defaultEnabled: enabled, regionEnabled: {}, distributorEnabled: {} };

    const row = data[0];
    const candidates = [row.clientId, row.apiKey];
    for (const raw of candidates) {
      if (!raw || typeof raw !== 'string') continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const defaultEnabled =
            typeof parsed.defaultEnabled === 'boolean' ? parsed.defaultEnabled : enabled;
          const regionEnabled = {};
          const distributorEnabled = {};
          if (parsed.regionEnabled && typeof parsed.regionEnabled === 'object') {
            Object.entries(parsed.regionEnabled).forEach(([k, v]) => {
              regionEnabled[String(k)] = !!v;
            });
          }
          if (parsed.distributorEnabled && typeof parsed.distributorEnabled === 'object') {
            Object.entries(parsed.distributorEnabled).forEach(([k, v]) => {
              distributorEnabled[String(k)] = !!v;
            });
          }
          return { defaultEnabled, regionEnabled, distributorEnabled };
        }
      } catch {
        // ignore malformed payload and continue
      }
    }
    return { defaultEnabled: enabled, regionEnabled: {}, distributorEnabled: {} };
  } catch (error) {
    console.error('Error fetching global GST policy:', error);
    return null;
  }
}

/**
 * Save GST policy with default + optional per-region overrides.
 * @param {{defaultEnabled:boolean, regionEnabled?:Record<string, boolean>}} policy
 */
export async function saveGlobalGstPolicy(policy) {
  const normalized = {
    defaultEnabled: !!policy?.defaultEnabled,
    regionEnabled: {},
    distributorEnabled: {},
  };
  if (policy?.regionEnabled && typeof policy.regionEnabled === 'object') {
    Object.entries(policy.regionEnabled).forEach(([k, v]) => {
      normalized.regionEnabled[String(k)] = !!v;
    });
  }
  if (policy?.distributorEnabled && typeof policy.distributorEnabled === 'object') {
    Object.entries(policy.distributorEnabled).forEach(([k, v]) => {
      normalized.distributorEnabled[String(k)] = !!v;
    });
  }
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }
    const payload = JSON.stringify(normalized);
    const { error } = await supabase
      .from('app_config')
      .upsert(
        {
          id: GLOBAL_GST_SETTING_ID,
          clientId: payload,
          apiKey: payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    if (error) throw error;
  } catch (error) {
    console.error('Error saving global GST policy:', error);
    throw error;
  }
}

// ==================== FG OPENING STOCK (app_config) ====================

const FG_OPENING_STOCK_ID = 'fg_opening_stock';

function parseFgOpeningStockPayload(row) {
  if (!row) return null;
  const candidates = [row.apiKey, row.clientId, row.gmail_client_id, row.gmail_api_key];
  let best = null;
  let bestTime = -1;
  for (const raw of candidates) {
    if (!raw || typeof raw !== 'string') continue;
    try {
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.rows)) {
        const t = p.updatedAt ? Date.parse(String(p.updatedAt)) : 0;
        const score = Number.isFinite(t) ? t : 0;
        const len = p.rows.length;
        if (score > bestTime || (score === bestTime && len > (best?.rows?.length ?? -1))) {
          bestTime = score;
          best = {
            rows: p.rows,
            updatedAt: p.updatedAt ? String(p.updatedAt) : null,
            updatedBy: p.updatedBy != null ? String(p.updatedBy) : '',
          };
        }
      }
    } catch {
      /* ignore */
    }
  }
  return best;
}

/**
 * @returns {Promise<{ rows: Array, updatedAt: string|null, updatedBy: string } | null>}
 */
export async function getFgOpeningStock() {
  try {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .eq('id', FG_OPENING_STOCK_ID)
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching FG opening stock:', error);
      return null;
    }

    if (!data || data.length === 0) return null;
    return parseFgOpeningStockPayload(data[0]);
  } catch (error) {
    console.error('Error fetching FG opening stock:', error);
    return null;
  }
}

/**
 * @param {{ rows: Array, updatedBy?: string }} payload
 */
export async function saveFgOpeningStock(payload) {
  try {
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const updatedBy = payload?.updatedBy != null ? String(payload.updatedBy) : '';
    const updatedAt = new Date().toISOString();
    const body = JSON.stringify({ rows, updatedAt, updatedBy });

    /** Remove existing row so this upload fully replaces prior FG data (fallback to upsert if delete is blocked). */
    const { error: delErr } = await supabase.from('app_config').delete().eq('id', FG_OPENING_STOCK_ID);
    if (delErr) {
      console.warn('FG opening stock pre-save delete:', delErr);
    }

    let { error } = await supabase.from('app_config').insert({
      id: FG_OPENING_STOCK_ID,
      clientId: body,
      apiKey: body,
      updated_at: updatedAt,
    });

    if (error) {
      const up = await supabase
        .from('app_config')
        .upsert(
          {
            id: FG_OPENING_STOCK_ID,
            clientId: body,
            apiKey: body,
            updated_at: updatedAt,
          },
          { onConflict: 'id' }
        );
      error = up.error;
    }

    if (error) throw error;
    return { rows, updatedAt, updatedBy };
  } catch (error) {
    console.error('Error saving FG opening stock:', error);
    throw error;
  }
}

/**
 * Realtime updates when `app_config` row `fg_opening_stock` changes (enable replication on `app_config` in Supabase).
 * @param {(data: { rows: Array, updatedAt: string|null, updatedBy: string } | null) => void} onData
 * @returns {() => void} unsubscribe
 */
export function subscribeFgOpeningStock(onData) {
  if (!supabase || typeof onData !== 'function') {
    return () => {};
  }

  const channel = supabase
    .channel(`fg_opening_stock_${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_config',
        filter: `id=eq.${FG_OPENING_STOCK_ID}`,
      },
      async () => {
        try {
          const data = await getFgOpeningStock();
          onData(data);
        } catch (e) {
          console.warn('FG opening stock refresh after realtime event failed:', e);
        }
      }
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {
      /* ignore */
    }
  };
}

// Utility function to convert timestamp to date
export function timestampToDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'string') return new Date(timestamp);
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  return new Date(timestamp);
}
