/**
 * Utility functions for managing distributor credentials and authentication
 */

const DISTRIBUTORS_STORAGE_KEY = "coke_distributors";
const ADMIN_CREDENTIALS_KEY = "coke_admin_credentials";
const SHIPPING_CREDENTIALS_KEY = "coke_shipping_credentials";

/**
 * Hash password synchronously (fallback for immediate use)
 * Exported so Supabase login can match `distributors.credentials.passwordHash`.
 */
export function hashPasswordSync(password) {
  // Simple hash function for client-side (not cryptographically secure but better than plain text)
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Get all distributors from localStorage
 */
export function getDistributors() {
  try {
    const stored = localStorage.getItem(DISTRIBUTORS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    return [];
  }
}

/**
 * Generate a unique distributor code based on name
 * Format: First letter of first name + First letter of last name (uppercase) + 3 random numbers
 * @param {string} name - Distributor name
 * @param {Array} existingDistributors - Array of existing distributors to check against
 * @param {Function} checkFirebase - Optional async function to check Firebase for existing codes
 * @returns {Promise<string>} Unique distributor code
 */
export async function generateUniqueDistributorCode(name, existingDistributors = [], checkFirebase = null) {
  if (!name || name.trim().length < 2) {
    throw new Error("Name must be at least 2 characters");
  }

  // Split name by spaces and get first letter of first name and first letter of last name
  const nameParts = name.trim().split(/\s+/).filter(part => part.length > 0);
  
  if (nameParts.length < 2) {
    throw new Error("Name must contain at least first name and last name (separated by space)");
  }
  
  // Get first letter of first name and first letter of last name
  const firstLetter = nameParts[0].charAt(0).toUpperCase();
  const secondLetter = nameParts[nameParts.length - 1].charAt(0).toUpperCase();
  
  // Validate that both are letters
  if (!/[A-Z]/.test(firstLetter) || !/[A-Z]/.test(secondLetter)) {
    throw new Error("Name must contain at least 2 words starting with letters");
  }
  
  const prefix = firstLetter + secondLetter;
  const existingCodes = new Set(existingDistributors.map(d => d.code?.toUpperCase() || ''));
  
  // If Firebase check function is provided, get codes from Firebase too
  if (checkFirebase) {
    try {
      const firebaseDistributors = await checkFirebase();
      firebaseDistributors.forEach(d => {
        if (d.code) {
          existingCodes.add(d.code.toUpperCase());
        }
      });
    } catch (error) {
      console.error("Error checking Firebase for existing codes:", error);
      // Continue with localStorage codes only
    }
  }

  // Try up to 100 times to find a unique code
  for (let attempt = 0; attempt < 100; attempt++) {
    // Generate 3 random digits
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const code = prefix + randomNum;
    
    if (!existingCodes.has(code.toUpperCase())) {
      return code;
    }
  }
  
  // If we couldn't find a unique code after 100 attempts, try with timestamp
  const timestamp = Date.now().toString().slice(-3);
  return prefix + timestamp;
}

/**
 * Save distributors to localStorage
 */
export function saveDistributors(distributors) {
  try {
    localStorage.setItem(DISTRIBUTORS_STORAGE_KEY, JSON.stringify(distributors));
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get admin credentials from localStorage
 */
export function getAdminCredentials() {
  try {
    const stored = localStorage.getItem(ADMIN_CREDENTIALS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    return null;
  }
}

/**
 * Set admin credentials in localStorage
 */
export function setAdminCredentials(username, passwordHash) {
  try {
    const credentials = { username, passwordHash, createdAt: new Date().toISOString() };
    localStorage.setItem(ADMIN_CREDENTIALS_KEY, JSON.stringify(credentials));
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Initialize admin credentials if they don't exist (migration from hardcoded)
 */
export function initializeAdminCredentials() {
  const existing = getAdminCredentials();
  if (!existing) {
    // Migrate from hardcoded credentials
    const defaultHash = hashPasswordSync("1234");
    setAdminCredentials("admin", defaultHash);
  }
}

/**
 * Validate distributor login credentials
 * Returns distributor object if valid, null otherwise
 */
export function validateDistributorLogin(username, password) {
  const distributors = getDistributors();
  const id = String(username || "").trim();
  if (!id) return null;
  const idUpper = id.toUpperCase();

  const distributor = distributors.find((d) => {
    const u = d.credentials?.username != null ? String(d.credentials.username).trim() : "";
    const c = d.code != null ? String(d.code).trim() : "";
    return (
      (u && (u === id || u.toUpperCase() === idUpper)) ||
      (c && (c === id || c.toUpperCase() === idUpper))
    );
  });

  if (!distributor) return null;
  
  // Compare hashed passwords
  const passwordHash = hashPasswordSync(password);
  if (distributor.credentials?.passwordHash === passwordHash) {
    return distributor;
  }
  
  // Fallback: check plain text password (for migration)
  if (distributor.credentials?.password === password) {
    // Migrate to hashed password
    const updatedDistributors = distributors.map(d => {
      if (d.code === distributor.code || d.name === distributor.name) {
        return {
          ...d,
          credentials: {
            ...d.credentials,
            passwordHash: hashPasswordSync(password),
            password: undefined // Remove plain text
          }
        };
      }
      return d;
    });
    saveDistributors(updatedDistributors);
    return distributor;
  }
  
  return null;
}

export function getShippingCredentials() {
  try {
    const stored = localStorage.getItem(SHIPPING_CREDENTIALS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setShippingCredentials(username, passwordHash) {
  try {
    const credentials = { username, passwordHash, createdAt: new Date().toISOString() };
    localStorage.setItem(SHIPPING_CREDENTIALS_KEY, JSON.stringify(credentials));
    return true;
  } catch {
    return false;
  }
}

export function initializeShippingCredentials() {
  const existing = getShippingCredentials();
  if (!existing) {
    setShippingCredentials("shipping", hashPasswordSync("1234"));
  }
}

/**
 * Validate shipping manager login (localStorage mode).
 */
export function validateShippingLogin(userId, password) {
  if (!getShippingCredentials()) {
    initializeShippingCredentials();
  }
  const creds = getShippingCredentials();
  if (!creds || userId !== creds.username) return false;
  return hashPasswordSync(password) === creds.passwordHash;
}

/**
 * Validate admin login
 */
export function validateAdminLogin(userId, password) {
  const adminCreds = getAdminCredentials();
  
  // If no admin credentials exist, initialize with default
  if (!adminCreds) {
    initializeAdminCredentials();
    const defaultHash = hashPasswordSync("1234");
    if (userId === "admin") {
      const inputHash = hashPasswordSync(password);
      return inputHash === defaultHash;
    }
    return false;
  }
  
  if (userId !== adminCreds.username) {
    return false;
  }
  
  const passwordHash = hashPasswordSync(password);
  return passwordHash === adminCreds.passwordHash;
}

/**
 * Update admin password
 */
export function updateAdminPassword(newPassword) {
  const passwordHash = hashPasswordSync(newPassword);
  const adminCreds = getAdminCredentials();
  if (adminCreds) {
    return setAdminCredentials(adminCreds.username, passwordHash);
  }
  return false;
}

/**
 * Get distributor by username
 */
export function getDistributorByUsername(username) {
  const distributors = getDistributors();
  return distributors.find((d) => d.credentials?.username === username) || null;
}

/**
 * Check if username is already taken
 */
export function isUsernameTaken(username, excludeCode = null) {
  const distributors = getDistributors();
  const adminCreds = getAdminCredentials();
  
  const shippingCreds = getShippingCredentials();
  if (shippingCreds && shippingCreds.username === username) {
    return true;
  }

  // Check against admin username
  if (adminCreds && adminCreds.username === username) {
    return true;
  }
  
  // Check against distributor usernames
  return distributors.some(
    (d) =>
      d.credentials?.username === username &&
      (!excludeCode || d.code !== excludeCode)
  );
}

/**
 * Hash password for storage (used when creating/updating distributors)
 */
export function hashPasswordForStorage(password) {
  return hashPasswordSync(password);
}
