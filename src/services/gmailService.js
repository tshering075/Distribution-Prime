/**
 * Gmail API Service for reading email replies and auto-updating order status
 * Uses NEW Google Identity Services (GIS) - migrated from deprecated gapi.auth2
 * Requires Gmail API OAuth 2.0 setup
 */

import { supabase } from '../supabase';

// Cache for Gmail credentials (loaded from Supabase)
let gmailCredentialsCache = null;
let credentialsLoadPromise = null;

/**
 * Load Gmail credentials from Supabase
 * @returns {Promise<{clientId: string, apiKey: string} | null>}
 */
async function loadGmailCredentialsFromSupabase() {
  try {
    if (!supabase) {
      // This is expected if Supabase isn't configured - we'll fall back to localStorage
      console.log('ℹ️ Supabase not available, will use localStorage for Gmail credentials');
      return null;
    }

    // Use cached credentials if available
    if (gmailCredentialsCache) {
      return gmailCredentialsCache;
    }

    // If already loading, wait for that promise
    if (credentialsLoadPromise) {
      return await credentialsLoadPromise;
    }

    // Start loading
    credentialsLoadPromise = (async () => {
      try {
        // Use array response instead of .single() to avoid 406 if multiple rows exist
        const { data, error } = await supabase
          .from('app_config')
          .select('*')
          .eq('id', 'gmail_credentials')
          .limit(1);

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        const row = Array.isArray(data) ? data[0] : data;

        if (row) {
          const credentials = {
            clientId: row.clientId || row.gmail_client_id || null,
            apiKey: row.apiKey || row.gmail_api_key || null
          };

          if (credentials.clientId && credentials.apiKey) {
            gmailCredentialsCache = credentials;
            console.log('✅ Gmail credentials loaded from Supabase');
            return credentials;
          }
        }

        console.log('No Gmail credentials found in Supabase');
        return null;
      } catch (error) {
        console.error('Error loading Gmail credentials from Supabase:', error);
        return null;
      } finally {
        credentialsLoadPromise = null;
      }
    })();

    return await credentialsLoadPromise;
  } catch (error) {
    console.error('Error in loadGmailCredentialsFromSupabase:', error);
    credentialsLoadPromise = null;
    return null;
  }
}

/**
 * Save Gmail credentials to Supabase
 * @param {string} clientId - Gmail Client ID
 * @param {string} apiKey - Gmail API Key
 * @returns {Promise<boolean>} True if saved successfully
 */
export async function saveGmailCredentialsToSupabase(clientId, apiKey) {
  try {
    if (!clientId || !apiKey) {
      throw new Error('Client ID and API Key are required');
    }

    const trimmedClientId = clientId.trim();
    const trimmedApiKey = apiKey.trim();

    // Validate Client ID format
    if (!trimmedClientId.endsWith('.apps.googleusercontent.com')) {
      console.warn('⚠️ Warning: Client ID format looks incorrect.');
      console.warn('Expected format: xxxxx-xxxxx.apps.googleusercontent.com');
      console.warn('Current value:', trimmedClientId);
      // Don't throw error, but warn the user - they might still want to save it
    }

    // Validate that Client ID and API Key are not empty after trimming
    if (!trimmedClientId || trimmedClientId.length < 10) {
      throw new Error('Client ID appears to be invalid or too short. Please check and try again.');
    }

    if (!trimmedApiKey || trimmedApiKey.length < 10) {
      throw new Error('API Key appears to be invalid or too short. Please check and try again.');
    }

    // Try to save to Supabase, but DO NOT fail if Supabase/table/columns are missing.
    // We still save to localStorage so that Gmail settings work even without Supabase.
    if (supabase) {
      try {
        const { getCurrentUser } = await import('./supabaseService');
        const currentUser = await getCurrentUser();
        
        const { error } = await supabase
          .from('app_config')
          .upsert(
            {
              id: 'gmail_credentials',
              clientId: trimmedClientId,
              apiKey: trimmedApiKey,
              updated_at: new Date().toISOString(),
              updated_by: currentUser?.email || 'Unknown',
            },
            { onConflict: 'id' }
          );

        if (error) {
          // Log but don't block saving to localStorage
          console.warn(
            'Warning: Failed to save Gmail credentials to Supabase (will still be saved locally):',
            error
          );
        } else {
          console.log('✅ Gmail credentials saved to Supabase');
          // Update cache immediately only if Supabase save succeeded
          gmailCredentialsCache = { clientId: trimmedClientId, apiKey: trimmedApiKey };
        }
      } catch (supabaseError) {
        console.warn(
          'Warning: Exception while saving Gmail credentials to Supabase (will still be saved locally):',
          supabaseError
        );
      }
    } else {
      console.warn('Supabase not available, saving Gmail credentials only to localStorage');
    }

    // Always save to localStorage so settings persist for this environment
    localStorage.setItem('gmail_client_id', trimmedClientId);
    localStorage.setItem('gmail_api_key', trimmedApiKey);

    console.log('✅ Gmail credentials saved to localStorage (and Supabase if available)');

    // Clear any existing load promise so credentials reload on next access
    credentialsLoadPromise = null;

    return true;
  } catch (error) {
    console.error('Error saving Gmail credentials to Supabase:', error);
    throw error;
  }
}

/**
 * Get Gmail Client ID (from Supabase or localStorage)
 * @returns {Promise<string | null>}
 */
export async function getGmailClientId() {
  try {
    // Try Supabase first
    const supabaseCreds = await loadGmailCredentialsFromSupabase();
    if (supabaseCreds?.clientId) {
      return supabaseCreds.clientId;
    }
  } catch (error) {
    console.warn('Error loading Gmail Client ID from Supabase:', error);
  }

  // Fallback to localStorage
  const clientId = localStorage.getItem('gmail_client_id');
  if (clientId) {
    console.log('✅ Gmail Client ID loaded from localStorage');
  } else {
    console.warn('⚠️ Gmail Client ID not found in localStorage. Please configure Gmail credentials in Settings.');
  }
  return clientId;
}

/**
 * Get Gmail API Key (from Supabase or localStorage)
 * @returns {Promise<string | null>}
 */
export async function getGmailApiKey() {
  try {
    // Try Supabase first
    const supabaseCreds = await loadGmailCredentialsFromSupabase();
    if (supabaseCreds?.apiKey) {
      return supabaseCreds.apiKey;
    }
  } catch (error) {
    console.warn('Error loading Gmail API Key from Supabase:', error);
  }

  // Fallback to localStorage
  const apiKey = localStorage.getItem('gmail_api_key');
  if (apiKey) {
    console.log('✅ Gmail API Key loaded from localStorage');
  } else {
    console.warn('⚠️ Gmail API Key not found in localStorage. Please configure Gmail credentials in Settings.');
  }
  return apiKey;
}

/**
 * Clear Gmail credentials cache (useful after updating credentials)
 */
export function clearGmailCredentialsCache() {
  gmailCredentialsCache = null;
  credentialsLoadPromise = null;
  console.log('Gmail credentials cache cleared');
}

/**
 * Check if Gmail API is configured
 * @returns {Promise<boolean>}
 */
export async function isGmailConfigured() {
  const clientId = await getGmailClientId();
  const apiKey = await getGmailApiKey();
  return !!(clientId && apiKey);
}

/**
 * Initialize Gmail API client
 * @returns {Promise<Object>} Gmail API client
 */
export async function initGmailAPI() {
  try {
    // Load credentials from Supabase first, then localStorage
    const clientId = await getGmailClientId();
    if (!clientId) {
      throw new Error('Gmail Client ID not configured. Please configure Gmail credentials in the app settings.');
    }

    const apiKey = await getGmailApiKey();
    if (!apiKey) {
      throw new Error('Gmail API Key not configured. Please configure Gmail credentials in the app settings.');
    }

    console.log('Loading Google Identity Services...');
    // Load Google Identity Services (NEW - replaces deprecated gapi.auth2)
    await loadGoogleIdentityScript();
    console.log('✅ Google Identity Services loaded');
    
    console.log('Loading Gmail API client library...');
    // Load Gmail API client
    await loadGmailAPIClient();
    console.log('✅ Gmail API client library loaded');

    // Verify gapi.client is available
    if (!window.gapi || !window.gapi.client) {
      throw new Error('Gmail API client library loaded but gapi.client is not available. This may be a network or script loading issue.');
    }

    // Initialize Gmail API client (without auth2)
    if (!window.gapi.client.getToken) {
      console.log('Initializing Gmail API client with API key...');
      await new Promise((resolve, reject) => {
        window.gapi.client.init({
          apiKey: apiKey,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest']
        }).then(() => {
          console.log('✅ Gmail API client initialized');
          resolve();
        }).catch((initError) => {
          console.error('Error initializing Gmail API client:', initError);
          reject(new Error(`Failed to initialize Gmail API client: ${initError.message || initError}`));
        });
      });
    }

    // Load Gmail API
    console.log('Loading Gmail API v1...');
    await new Promise((resolve, reject) => {
      window.gapi.client.load('gmail', 'v1', () => {
        console.log('✅ Gmail API v1 loaded');
        resolve();
      });
    });

    const storedToken = loadGmailToken();
    if (storedToken?.access_token) {
      applyTokenToGapiClient(storedToken.access_token, storedToken.expires_at);
    }

    return window.gapi;
  } catch (error) {
    console.error('Error initializing Gmail API:', error);
    
    // Provide more helpful error messages
    if (error.message && error.message.includes('failed to load')) {
      throw new Error(`Gmail API client failed to load. This could be due to:\n1. Network connectivity issues\n2. Firewall blocking https://apis.google.com\n3. Ad blocker blocking the script\n\nOriginal error: ${error.message}`);
    }
    
    throw error;
  }
}

/**
 * Load Google Identity Services script (NEW - replaces deprecated gapi.auth2)
 * @returns {Promise<void>}
 */
function loadGoogleIdentityScript() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts) {
      resolve();
      return;
    }

    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      // Script is loading, wait for it
      const checkInterval = setInterval(() => {
        if (window.google && window.google.accounts) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.google || !window.google.accounts) {
          reject(new Error('Google Identity Services script failed to load'));
        }
      }, 10000);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // Wait a bit for google.accounts to be available
      setTimeout(() => {
        if (window.google && window.google.accounts) {
          resolve();
        } else {
          reject(new Error('Google Identity Services not available after script load'));
        }
      }, 500);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Load Gmail API client library
 * @returns {Promise<void>}
 */
function loadGmailAPIClient() {
  return new Promise((resolve, reject) => {
    // If already loaded and initialized, resolve immediately
    if (window.gapi && window.gapi.client) {
      resolve();
      return;
    }

    // If script is already in the DOM but not loaded yet, wait for it
    if (document.querySelector('script[src*="apis.google.com/js/api.js"]')) {
      const checkInterval = setInterval(() => {
        if (window.gapi && window.gapi.client) {
          clearInterval(checkInterval);
          resolve();
        } else if (window.gapi && window.gapi.load) {
          // Script loaded but client not initialized yet
          clearInterval(checkInterval);
          window.gapi.load('client', () => {
            if (window.gapi && window.gapi.client) {
              resolve();
            } else {
              reject(new Error('Gmail API client failed to initialize after load'));
            }
          });
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.gapi || !window.gapi.client) {
          reject(new Error('Gmail API client failed to load (timeout waiting for existing script)'));
        }
      }, 15000); // Increased timeout to 15 seconds
      return;
    }

    // Script not in DOM, create and load it
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      // Wait for gapi to be available (might take a moment after script.onload)
      const waitForGapi = setInterval(() => {
        if (window.gapi && window.gapi.load) {
          clearInterval(waitForGapi);
          // Now load the client module
          window.gapi.load('client', () => {
            // Wait a bit more for client to be fully initialized
            setTimeout(() => {
              if (window.gapi && window.gapi.client) {
                resolve();
              } else {
                reject(new Error('Gmail API client failed to initialize after loading client module'));
              }
            }, 300);
          });
        }
      }, 50);
      
      // Timeout if gapi doesn't become available
      setTimeout(() => {
        clearInterval(waitForGapi);
        if (!window.gapi || !window.gapi.load) {
          reject(new Error('Gmail API script loaded but gapi object not available'));
        }
      }, 10000);
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load Gmail API script from https://apis.google.com/js/api.js. Check your internet connection.'));
    };
    
    document.head.appendChild(script);
  });
}

/**
 * Sign in to Gmail
 * @returns {Promise<Object>} User object
 */
/**
 * Save Gmail token to localStorage
 * @param {string} accessToken - Access token
 * @param {number} expiresIn - Token expiry time in seconds (default: 3600 = 1 hour)
 */
const GMAIL_TOKEN_KEY = 'gmail_oauth_token';
const GMAIL_SESSION_KEY = 'gmail_oauth_session';

function saveGmailToken(accessToken, expiresIn = 3600) {
  try {
    const expiryTime = Date.now() + (expiresIn * 1000);
    const tokenData = {
      access_token: accessToken,
      expires_at: expiryTime,
      saved_at: Date.now()
    };
    localStorage.setItem(GMAIL_TOKEN_KEY, JSON.stringify(tokenData));
    console.log('✅ Gmail token saved to localStorage (expires in', expiresIn, 'seconds)');
  } catch (error) {
    console.error('Error saving Gmail token:', error);
  }
}

/** Remember that this browser completed Gmail consent (survives access-token expiry). */
function saveGmailSession(meta = {}) {
  try {
    const existing = loadGmailSession() || {};
    localStorage.setItem(
      GMAIL_SESSION_KEY,
      JSON.stringify({
        connected_at: existing.connected_at || Date.now(),
        ...existing,
        ...meta,
      })
    );
  } catch (error) {
    console.error('Error saving Gmail session:', error);
  }
}

function loadGmailSession() {
  try {
    const raw = localStorage.getItem(GMAIL_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasGmailSession() {
  return Boolean(loadGmailSession());
}

function clearGmailSession() {
  localStorage.removeItem(GMAIL_SESSION_KEY);
}

function applyTokenToGapiClient(accessToken, expiresAt = null) {
  if (!window.gapi?.client || !accessToken) return;
  const token = { access_token: accessToken };
  if (expiresAt) token.expires_at = expiresAt;
  window.gapi.client.setToken(token);
}

/**
 * Load Gmail token from localStorage
 * @returns {Object | null} Token data with access_token and expires_at, or null if not found/expired
 */
function readGmailTokenRaw() {
  try {
    const tokenDataStr = localStorage.getItem(GMAIL_TOKEN_KEY);
    if (!tokenDataStr) return null;
    return JSON.parse(tokenDataStr);
  } catch (error) {
    console.error('Error reading Gmail token:', error);
    localStorage.removeItem(GMAIL_TOKEN_KEY);
    return null;
  }
}

function isGmailTokenExpired(tokenData, bufferMs = 5 * 60 * 1000) {
  if (!tokenData?.expires_at) return false;
  return Date.now() >= tokenData.expires_at - bufferMs;
}

function loadGmailToken() {
  const tokenData = readGmailTokenRaw();
  if (!tokenData?.access_token) return null;

  if (isGmailTokenExpired(tokenData)) {
    console.log('⚠️ Stored Gmail access token expired; will refresh silently if session exists');
    return null;
  }

  console.log('✅ Valid Gmail token found in localStorage');
  return tokenData;
}

/**
 * Clear Gmail token from localStorage
 */
function clearGmailToken() {
  localStorage.removeItem(GMAIL_TOKEN_KEY);
  console.log('🗑️ Gmail token cleared from localStorage');
}

function getGmailLoginHint() {
  const session = loadGmailSession();
  return session?.email || session?.login_hint || '';
}

async function captureGmailProfileEmail() {
  try {
    if (!window.gapi?.client?.gmail) return;
    const response = await window.gapi.client.gmail.users.getProfile({ userId: 'me' });
    const email = response?.result?.emailAddress;
    if (email) {
      saveGmailSession({ email, login_hint: email });
      console.log('✅ Gmail account saved for future sign-ins:', email);
    }
  } catch (error) {
    console.warn('Could not fetch Gmail profile email:', error?.result?.error?.message || error.message);
  }
}

/**
 * Request OAuth access token via Google Identity Services.
 * @param {{ prompt?: string, forceNew?: boolean, hint?: string }} options
 * @returns {Promise<string>} Access token
 */
async function requestGmailAccessToken(options = {}) {
  const { prompt = '', forceNew = false, hint = getGmailLoginHint() } = options;

  if (forceNew) {
    clearGmailToken();
  }

  let clientId = await getGmailClientId();
  if (!clientId) {
    throw new Error('Gmail Client ID not configured. Please configure Gmail credentials in Settings.');
  }

  clientId = clientId.trim();
  await loadGoogleIdentityScript();

  return new Promise((resolve, reject) => {
    let tokenReceived = false;

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope:
        'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
      callback: (response) => {
        if (tokenReceived) return;
        tokenReceived = true;

        if (response.error) {
          let errorMsg = response.error_description || response.error || 'Failed to get access token';
          if (response.error === 'invalid_client' || response.error === '401') {
            errorMsg =
              'Invalid Gmail Client ID. Open Gmail Settings and paste the Client ID from Google Cloud Console.';
          } else if (response.error === 'access_denied') {
            errorMsg = 'Access denied. Grant Gmail read and send permissions when prompted.';
          } else if (
            response.error === 'popup_closed_by_user' ||
            response.error === 'user_cancelled' ||
            response.error === 'popup_blocked'
          ) {
            errorMsg = 'Gmail sign-in was cancelled or blocked. Allow popups and try again.';
          } else if (
            response.error === 'interaction_required' ||
            response.error === 'login_required' ||
            response.error === 'consent_required'
          ) {
            errorMsg = 'Gmail session expired. Sign in again when prompted.';
          }
          reject(new Error(errorMsg));
        } else if (response.access_token) {
          const expiresIn = response.expires_in || 3600;
          saveGmailToken(response.access_token, expiresIn);
          saveGmailSession({ login_hint: hint || undefined });
          resolve(response.access_token);
        } else {
          reject(new Error('Token response missing access_token'));
        }
      },
    });

    const requestOptions = { prompt };
    if (hint) requestOptions.hint = hint;

    console.log(
      `🔐 Requesting Gmail access token (prompt: ${prompt || 'silent'}${hint ? `, hint: ${hint}` : ''})...`
    );
    try {
      tokenClient.requestAccessToken(requestOptions);
    } catch (requestError) {
      reject(new Error(`Failed to request access token: ${requestError.message || 'Unknown error'}`));
    }

    setTimeout(() => {
      if (!tokenReceived) {
        tokenReceived = true;
        reject(new Error('Gmail sign-in timed out. Please try again.'));
      }
    }, 60000);
  });
}

/** Try several silent strategies before asking the user to sign in again. */
async function requestGmailAccessTokenSilent() {
  const hint = getGmailLoginHint();
  const attempts = [];
  if (hint) {
    attempts.push({ prompt: 'none', hint });
    attempts.push({ prompt: '', hint });
  }
  attempts.push({ prompt: 'none' });
  attempts.push({ prompt: '' });

  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await requestGmailAccessToken({ ...attempt, forceNew: false });
    } catch (error) {
      lastError = error;
      const msg = String(error?.message || '').toLowerCase();
      if (
        msg.includes('cancelled') ||
        msg.includes('denied') ||
        msg.includes('blocked')
      ) {
        throw error;
      }
    }
  }
  throw lastError || new Error('Could not refresh Gmail session silently');
}

async function requestGmailAccessTokenInteractive() {
  const hint = getGmailLoginHint();
  try {
    return await requestGmailAccessToken({
      prompt: 'select_account',
      hint,
      forceNew: false,
    });
  } catch (selectError) {
    const msg = String(selectError?.message || '').toLowerCase();
    if (msg.includes('cancelled') || msg.includes('denied') || msg.includes('blocked')) {
      throw selectError;
    }
    return await requestGmailAccessToken({
      prompt: 'consent',
      hint,
      forceNew: true,
    });
  }
}

/**
 * Get OAuth token using NEW Google Identity Services
 * @param {boolean} forceNew - If true, force a new token request even if valid token exists
 * @returns {Promise<string>} Access token
 */
async function getGmailToken(forceNew = false) {
  try {
    if (!forceNew) {
      const storedToken = loadGmailToken();
      if (storedToken?.access_token) {
        console.log('✅ Using stored Gmail token (no re-authentication needed)');
        return storedToken.access_token;
      }
    } else {
      clearGmailToken();
    }

    if (!hasGmailSession() && !readGmailTokenRaw()?.access_token) {
      throw new Error('No saved Gmail session on this device');
    }

    // Silent refresh when user connected before (no Google popup)
    try {
      return await requestGmailAccessTokenSilent();
    } catch (silentError) {
      if (!forceNew && hasGmailSession()) {
        console.warn('Silent Gmail token refresh failed:', silentError.message);
      }
      throw silentError;
    }
  } catch (error) {
    console.error('Error getting Gmail token:', error);
    throw error;
  }
}

/**
 * Restore or obtain a Gmail session.
 * @param {{ interactive?: boolean }} options - interactive=true shows Google sign-in if needed
 * @returns {Promise<boolean>}
 */
export async function ensureGmailAuthenticated(options = {}) {
  const { interactive = false } = options;

  try {
    if (!(await isGmailConfigured())) return false;
    await initGmailAPI();

    const stored = loadGmailToken();
    if (stored?.access_token) {
      applyTokenToGapiClient(stored.access_token, stored.expires_at);
      return true;
    }

    const gapiToken = window.gapi?.client?.getToken();
    if (gapiToken?.access_token) {
      const expiresAt = gapiToken.expires_at || stored?.expires_at;
      if (!expiresAt || expiresAt > Date.now()) return true;
    }

    if (hasGmailSession() || interactive) {
      try {
        const token = await getGmailToken(false);
        const refreshed = loadGmailToken();
        applyTokenToGapiClient(token, refreshed?.expires_at || null);
        await captureGmailProfileEmail();
        return true;
      } catch (silentError) {
        if (!interactive) {
          console.warn('Gmail silent restore failed:', silentError.message);
          return hasGmailSession();
        }
      }
    }

    if (!interactive) return false;

    try {
      const token = await requestGmailAccessTokenInteractive();
      const refreshed = loadGmailToken();
      applyTokenToGapiClient(token, refreshed?.expires_at || null);
      await captureGmailProfileEmail();
      return true;
    } catch (interactiveError) {
      console.error('Gmail interactive sign-in failed:', interactiveError);
      throw interactiveError;
    }
  } catch (error) {
    console.error('ensureGmailAuthenticated failed:', error);
    if (!interactive) return hasGmailSession();
    throw error;
  }
}

/** Restore Gmail on app load — retries silent refresh a few times. */
export async function warmupGmailSession(maxRetries = 3) {
  if (!(await isGmailConfigured())) return false;
  if (!hasGmailSession() && !readGmailTokenRaw()?.access_token) return false;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const ok = await ensureGmailAuthenticated({ interactive: false });
    if (ok && loadGmailToken()?.access_token) {
      startGmailKeepAlive();
      return true;
    }
    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }

  if (hasGmailSession()) startGmailKeepAlive();
  return hasGmailSession();
}

/** Refresh before the ~1h access token expires (browser session only). */
const GMAIL_KEEPALIVE_INTERVAL_MS = 45 * 60 * 1000;
let gmailKeepAliveIntervalId = null;
let gmailKeepAliveVisibilityBound = false;

async function refreshGmailKeepAlive() {
  if (!(await isGmailConfigured())) return;
  if (!hasGmailSession() && !readGmailTokenRaw()?.access_token) return;
  try {
    await initGmailAPI();
    await ensureGmailAuthenticated({ interactive: false });
  } catch (error) {
    console.warn('Gmail keep-alive refresh failed:', error?.message || error);
  }
}

function onGmailKeepAliveVisibility() {
  if (document.visibilityState !== 'visible') return;
  void refreshGmailKeepAlive();
}

/**
 * Proactively refresh the Gmail access token while this tab is open.
 * Reduces "session expired" during long admin use. For 24/7 access without the app open,
 * use server-side OAuth with a refresh token (see team docs / backend migration).
 */
export function startGmailKeepAlive() {
  if (!hasGmailSession()) return;

  stopGmailKeepAlive();
  void refreshGmailKeepAlive();

  gmailKeepAliveIntervalId = setInterval(() => {
    void refreshGmailKeepAlive();
  }, GMAIL_KEEPALIVE_INTERVAL_MS);

  if (!gmailKeepAliveVisibilityBound) {
    document.addEventListener('visibilitychange', onGmailKeepAliveVisibility);
    gmailKeepAliveVisibilityBound = true;
  }
}

export function stopGmailKeepAlive() {
  if (gmailKeepAliveIntervalId != null) {
    clearInterval(gmailKeepAliveIntervalId);
    gmailKeepAliveIntervalId = null;
  }
}

export async function signInGmail(forceReconnect = false) {
  try {
    console.log('Initializing Gmail API...');
    const ok = await ensureGmailAuthenticated({ interactive: true });
    if (!ok) {
      throw new Error('Gmail sign-in did not complete.');
    }
    const token = window.gapi?.client?.getToken()?.access_token || loadGmailToken()?.access_token;
    if (!token) {
      throw new Error('Gmail sign-in completed but no access token was stored.');
    }
    await captureGmailProfileEmail();
    startGmailKeepAlive();
    console.log('✅ Gmail sign-in successful (session saved for this browser)');
    return { access_token: token };
  } catch (error) {
    console.error('Error signing in to Gmail:', error);
    if (forceReconnect) {
      clearGmailToken();
      clearGmailSession();
    }
    throw new Error(error.message || 'Failed to sign in to Gmail.');
  }
}

/**
 * Sign out from Gmail
 * @returns {Promise<void>}
 */
export async function signOutGmail() {
  try {
    await initGmailAPI();
    const token = window.gapi?.client?.getToken();
    if (token && token.access_token) {
      // Revoke token using Google Identity Services
      if (window.google && window.google.accounts) {
        window.google.accounts.oauth2.revoke(token.access_token);
      }
      // Clear token from gapi client
      window.gapi.client.setToken('');
    }
    
    clearGmailToken();
    clearGmailSession();
    stopGmailKeepAlive();
    console.log('✅ Gmail signed out and session cleared');
  } catch (error) {
    console.error('Error signing out from Gmail:', error);
    clearGmailToken();
    clearGmailSession();
    stopGmailKeepAlive();
    throw error;
  }
}

/**
 * Check if user is signed in to Gmail
 * @param {boolean} verifyToken - If true, verify token with API call (slower but more reliable)
 * @returns {Promise<boolean>}
 */
export async function isSignedInGmail(verifyToken = false) {
  try {
    await initGmailAPI();

    const storedToken = loadGmailToken();
    if (storedToken?.access_token) {
      applyTokenToGapiClient(storedToken.access_token, storedToken.expires_at);
    }

    let token = window.gapi?.client?.getToken();

    if (token?.access_token) {
      const expiryTime = token.expires_at || storedToken?.expires_at;
      const isExpired = expiryTime && expiryTime <= Date.now();

      if (!isExpired) {
        if (verifyToken) {
          try {
            await window.gapi.client.gmail.users.getProfile({ userId: 'me' });
            return true;
          } catch (verifyError) {
            console.warn('Gmail token invalid:', verifyError?.result?.error?.message || verifyError.message);
            window.gapi.client.setToken('');
            clearGmailToken();
          }
        } else {
          return true;
        }
      } else {
        window.gapi.client.setToken('');
      }
    }

    // Access token expired but user connected before — refresh without popup
    if (hasGmailSession()) {
      try {
        const accessToken = await getGmailToken(false);
        const refreshed = loadGmailToken();
        applyTokenToGapiClient(accessToken, refreshed?.expires_at || null);
        if (verifyToken) {
          await window.gapi.client.gmail.users.getProfile({ userId: 'me' });
        }
        return true;
      } catch (refreshError) {
        console.warn('Could not silently refresh Gmail session:', refreshError.message);
        return hasGmailSession();
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking Gmail sign-in status:', error);
    if (window.gapi?.client) {
      window.gapi.client.setToken('');
    }
    return hasGmailSession();
  }
}

/**
 * Send email via Gmail API
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.cc - CC recipients (comma-separated)
 * @param {string} options.subject - Email subject
 * @param {string} options.htmlBody - HTML email body
 * @param {string} options.imageData - Base64 encoded PNG image data
 * @returns {Promise<Object>} Gmail API response
 */
export async function sendEmailViaGmail({ to, cc, subject, htmlBody, imageData }) {
  try {
    console.log('📧 Starting email send process...');
    await initGmailAPI();
    
    // Helper function to attempt sending with current token
    const attemptSend = async () => {
      // Get authenticated user's email (Gmail API will use this as sender)
      let senderEmail = localStorage.getItem('admin_email');
      if (!senderEmail) {
        // Try to get from token
        const token = window.gapi?.client?.getToken();
        if (token && token.access_token) {
          // We can't easily get email from token, so we'll let Gmail use the authenticated account
          console.log('Using authenticated Gmail account as sender');
        }
      }

      // Create email message
      console.log('Creating email message...');
      const email = createEmailMessage({ to, cc, subject, htmlBody, imageData, senderEmail });
      
      console.log('Email message created, length:', email.length);
      
      // Encode message to base64url (Gmail API requirement)
      // Gmail API requires base64url encoding (RFC 4648)
      // First, convert to base64, then convert to base64url
      let base64;
      try {
        // Try using TextEncoder for proper UTF-8 handling (modern browsers)
        if (typeof TextEncoder !== 'undefined') {
          const utf8Bytes = new TextEncoder().encode(email);
          base64 = btoa(String.fromCharCode.apply(null, utf8Bytes));
        } else {
          // Fallback for older browsers
          base64 = btoa(unescape(encodeURIComponent(email)));
        }
      } catch (e) {
        // Final fallback
        base64 = btoa(email);
      }
      
      // Convert base64 to base64url (replace + with -, / with _, remove padding =)
      const encodedMessage = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
      console.log('Email encoded, sending via Gmail API...');

      // Send via Gmail API
      const response = await window.gapi.client.gmail.users.messages.send({
        userId: 'me',
        resource: {
          raw: encodedMessage
        }
      });

      console.log('✅ Email sent via Gmail API successfully!', response);
      console.log('Message ID:', response.result?.id);
      
      return response;
    };
    
    const authenticated = await ensureGmailAuthenticated({ interactive: false });
    if (!authenticated) {
      const interactiveOk = await ensureGmailAuthenticated({ interactive: true });
      if (!interactiveOk) {
        throw new Error('Gmail is not connected. Click Connect Gmail once, then send again.');
      }
    }

    const currentToken = window.gapi?.client?.getToken();
    if (!currentToken?.access_token) {
      throw new Error('Gmail sign-in failed: Token not set. Please try again.');
    }
    console.log('✅ Gmail ready to send');

    // Try to send
    try {
      return await attemptSend();
    } catch (authError) {
      // Check for authentication errors more thoroughly
      const errorCode = authError?.result?.error?.code || authError?.status || authError?.code;
      const errorMessage = authError?.result?.error?.message || authError?.message || '';
      const errorStatus = authError?.status || authError?.result?.status;
      
      // 401 = Unauthorized, 403 = Forbidden (could be auth issue)
      const isAuthError = errorCode === 401 || 
                         errorStatus === 401 ||
                         errorCode === 403 ||
                         errorStatus === 403 ||
                         errorMessage.toLowerCase().includes('authentication') || 
                         errorMessage.toLowerCase().includes('invalid credentials') ||
                         errorMessage.toLowerCase().includes('access token') ||
                         errorMessage.toLowerCase().includes('login cookie') ||
                         errorMessage.toLowerCase().includes('oauth 2') ||
                         errorMessage.toLowerCase().includes('unauthorized');
      
      console.log('🔍 Error analysis:', {
        errorCode,
        errorStatus,
        errorMessage,
        isAuthError
      });
      
      if (isAuthError) {
        console.warn('⚠️ Authentication error detected (401/403), attempting to re-authenticate...');
        console.warn('Full error:', authError);
        
        // Clear invalid token
        if (window.gapi?.client) {
          window.gapi.client.setToken('');
          console.log('🗑️ Cleared invalid token');
        }
        
        console.log('🔄 Re-authenticating with Gmail...');
        try {
          await ensureGmailAuthenticated({ interactive: true });
          console.log('✅ Re-authentication successful');
        } catch (signInError) {
          console.error('❌ Re-authentication failed:', signInError);
          throw new Error(`Gmail Authentication Error: Failed to sign in. Please try again. ${signInError.message || ''}`);
        }
        
        // Verify we have a token after sign-in
        const newToken = window.gapi?.client?.getToken();
        if (!newToken || !newToken.access_token) {
          throw new Error('Gmail Authentication Error: Token not set after sign-in. Please try again.');
        }
        console.log('✅ New token verified after re-authentication');
        
        // Retry sending
        console.log('🔄 Retrying email send after re-authentication...');
        try {
          return await attemptSend();
        } catch (retryError) {
          console.error('❌ Retry after re-authentication also failed:', retryError);
          throw new Error(`Gmail API Error: Email send failed even after re-authentication. ${retryError?.result?.error?.message || retryError?.message || 'Unknown error'}`);
        }
      } else {
        // Not an auth error, re-throw
        console.error('❌ Non-authentication error, not retrying:', authError);
        throw authError;
      }
    }
  } catch (error) {
    console.error('❌ Error sending email via Gmail API:', error);
    console.error('Error details:', error.result?.error || error.message);
    
    // Provide more detailed error information
    if (error.result?.error) {
      const apiError = error.result.error;
      const errorMsg = apiError.message || apiError.code || 'Unknown error';
      
      // Provide helpful guidance for authentication errors
      if (errorMsg.includes('authentication') || errorMsg.includes('invalid credentials')) {
        throw new Error(`Gmail Authentication Error: ${errorMsg}\n\nPlease try sending the email again. You may need to sign in to Gmail again.`);
      }
      
      throw new Error(`Gmail API Error: ${errorMsg}`);
    }
    
    throw error;
  }
}

/**
 * Create email message in RFC 2822 format
 * @param {Object} options - Email options
 * @returns {string} RFC 2822 formatted email
 */
function createEmailMessage({ to, cc, subject, htmlBody, imageData, senderEmail }) {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Use provided senderEmail or let Gmail use authenticated account
  // Gmail API will override From with authenticated user's email anyway
  const fromEmail = senderEmail || 'me';
  
  let message = [];
  
  // Headers
  message.push(`MIME-Version: 1.0`);
  message.push(`To: ${to}`);
  if (cc && cc.trim()) {
    message.push(`Cc: ${cc}`);
  }
  // Note: Gmail API will set From to authenticated user's email
  // But we include it for completeness
  if (fromEmail && fromEmail !== 'me') {
    message.push(`From: ${fromEmail}`);
  }
  message.push(`Subject: ${subject}`);
  message.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  message.push(''); // Empty line before body
  
  // HTML body part
  message.push(`--${boundary}`);
  message.push(`Content-Type: text/html; charset=UTF-8`);
  message.push(`Content-Transfer-Encoding: base64`);
  message.push('');
  
  // Encode HTML body to base64
  const htmlBase64 = btoa(unescape(encodeURIComponent(htmlBody)));
  // Split into 76-character lines (RFC 2045)
  const htmlLines = htmlBase64.match(/.{1,76}/g) || [htmlBase64];
  message.push(...htmlLines);
  message.push('');
  
  // Image attachment part
  if (imageData) {
    console.log('📎 Adding image attachment to email...');
    message.push(`--${boundary}`);
    message.push(`Content-Type: image/png; name="order.png"`);
    message.push(`Content-Disposition: attachment; filename="order.png"`);
    message.push(`Content-Transfer-Encoding: base64`);
    message.push('');
    
    // Remove data:image/png;base64, prefix if present
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    if (!base64Data || base64Data.length === 0) {
      console.warn('⚠️ Warning: imageData is empty after removing prefix');
    } else {
      console.log(`✅ Image attachment data length: ${base64Data.length} characters`);
    }
    // Split into 76-character lines
    const imageLines = base64Data.match(/.{1,76}/g) || [base64Data];
    message.push(...imageLines);
    message.push('');
    console.log('✅ Image attachment added to email message');
  } else {
    console.warn('⚠️ Warning: No imageData provided, email will be sent without attachment');
  }
  
  // End boundary
  message.push(`--${boundary}--`);
  
  // Join with \r\n (CRLF) as required by RFC 2822
  return message.join('\r\n');
}

/**
 * Search for email replies to a specific order
 * @param {string} orderId - Order ID
 * @param {string} subject - Original email subject
 * @returns {Promise<Array>} Array of reply messages
 */
export async function searchOrderReplies(orderId, subject, options = {}) {
  try {
    console.log(`🔍 Searching for replies to order ${orderId} with subject: "${subject}"`);
    await initGmailAPI();
    
    // Check if signed in
    const signedIn = await isSignedInGmail();
    if (!signedIn) {
      console.warn('Not signed in to Gmail, cannot search for replies');
      return [];
    }

    let messageDetails = [];
    const threadId = options?.threadId || null;

    if (threadId) {
      console.log(`Using Gmail thread lookup for threadId: ${threadId}`);
      const threadResponse = await window.gapi.client.gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full'
      });
      messageDetails = threadResponse?.result?.messages || [];
      console.log(`Found ${messageDetails.length} message(s) in thread`);
    } else {
      // Fallback for older records where threadId is unavailable.
      const query = `in:inbox (subject:"${subject}" OR subject:"Re: ${subject}")`;
      console.log('Gmail search query:', query);
      const response = await window.gapi.client.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50
      });
      const messages = response.result.messages || [];
      console.log(`Found ${messages.length} potential reply messages`);

      if (messages.length === 0) {
        return [];
      }

      messageDetails = await Promise.all(
        messages.map(async (msg) => {
          try {
            const detail = await window.gapi.client.gmail.users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'full'
            });
            return detail.result;
          } catch (err) {
            console.error(`Error fetching message ${msg.id}:`, err);
            return null;
          }
        })
      );
    }

    // Filter out null results
    const validMessages = messageDetails.filter(msg => msg !== null);
    console.log(`Retrieved ${validMessages.length} valid message(s) for reply scan`);
    
    return validMessages;
  } catch (error) {
    console.error('Error searching order replies:', error);
    console.error('Error details:', error.result?.error || error.message);
    return [];
  }
}

/**
 * Parse email message body
 * @param {Object} message - Gmail message object
 * @returns {string} Message body text
 */
export function parseEmailBody(message) {
  try {
    if (!message || !message.payload) {
      console.warn('Message or payload is missing');
      return '';
    }
    
    // Helper function to recursively find text parts
    const findTextPart = (parts) => {
      if (!parts || !Array.isArray(parts)) return null;
      
      for (const part of parts) {
        // Check if this part has text/plain (preferred)
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          return decodeBase64(part.body.data);
        }
        
        // If this part has nested parts, search recursively
        if (part.parts && part.parts.length > 0) {
          const nestedText = findTextPart(part.parts);
          if (nestedText) return nestedText;
        }
      }
      
      // If no plain text found, try HTML
      for (const part of parts) {
        if (part.mimeType === 'text/html' && part.body && part.body.data) {
          const htmlBody = decodeBase64(part.body.data);
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = htmlBody;
          return tempDiv.textContent || tempDiv.innerText || '';
        }
        
        // Check nested parts for HTML
        if (part.parts && part.parts.length > 0) {
          for (const nestedPart of part.parts) {
            if (nestedPart.mimeType === 'text/html' && nestedPart.body && nestedPart.body.data) {
              const htmlBody = decodeBase64(nestedPart.body.data);
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = htmlBody;
              return tempDiv.textContent || tempDiv.innerText || '';
            }
          }
        }
      }
      
      return null;
    };
    
    // Try simple body first
    if (message.payload.body && message.payload.body.data) {
      const body = decodeBase64(message.payload.body.data);
      if (body) return body;
    }
    
    // Use recursive search for parts
    if (message.payload.parts) {
      const body = findTextPart(message.payload.parts);
      if (body) {
        console.log(`✅ Extracted email body (${body.length} chars)`);
        return body;
      }
    }
    
    console.warn('Could not extract email body text');
    return '';
  } catch (error) {
    console.error('Error parsing email body:', error);
    return '';
  }
}

/**
 * Decode base64 string
 * @param {string} str - Base64 encoded string
 * @returns {string} Decoded string
 */
function decodeBase64(str) {
  try {
    return decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
  } catch (error) {
    console.error('Error decoding base64:', error);
    return '';
  }
}

/**
 * Match keyword as whole word when short (avoids "no" matching inside "noted", "another", etc.)
 */
function bodyContainsKeyword(lowerBody, keyword) {
  const k = String(keyword || '').toLowerCase().trim();
  if (!k) return false;
  if (k.length <= 3) {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(lowerBody);
  }
  return lowerBody.includes(k);
}

/**
 * Check if email reply contains approval keywords
 * @param {string} body - Email body text
 * @returns {boolean} True if approval detected
 */
export function isApprovalReply(body) {
  if (!body) return false;
  
  const approvalKeywords = [
    'approved',
    'approve',
    'go ahead',
    'go on',
    'proceed',
    'proceeded',
    'accepted',
    'accept',
    'yes',
    'ok',
    'okay',
    'confirm',
    'confirmed',
    'agreed',
    'agree',
    'authorized',
    'authorize',
    'permission granted',
    'granted',
    'please proceed',
    'please go ahead',
    'you can proceed',
    'proceed with',
    'approved this',
    'i approve',
    'we approve',
    'approval granted',
    'fine',
    'good',
    'agreed',
    'consent',
    'permission',
    'authorize',
    'authorized',
    'go for it',
    'move forward',
    'move ahead',
    'carry on',
    'continue',
    'all good',
    'sounds good',
    'looks good',
    'that works',
    'that\'s fine',
    'that works for me',
    'i agree',
    'we agree',
    'i consent',
    'we consent',
    'order done',
    'order confirmed',
    'received with thanks',
    'order received',
    'order received with thanks',
    'confirmed',
    'order is done',
    'order is confirmed',
    'order has been confirmed',
    'order has been received',
    'thanks',
    'thank you',
    'received',
    'order completed',
    'order is completed',
    'will load today',
    'confirming action taken',
    'thank you for your mail',
    'well received with thanks',
    'noted the order details',
    'okay to honour',
    'execute the order please',
    'okay to deliver',
    'okay to dispatch',
    'confirmed order execuation',
    'confirmed order execution',
    'noted',
    'well noted',
    'done',
    'will proceed',
    'please load',
    'load today'
  ];
  
  const rejectionKeywords = [
    'rejected',
    'reject',
    'denied',
    'deny',
    'no',
    'not approved',
    'disapproved',
    'refused',
    'refuse',
    'declined',
    'decline',
    'cannot approve',
    'will not approve',
    'do not approve'
  ];
  
  // Clean the body: remove quoted text (lines starting with >) and normalize whitespace
  let cleanBody = body;
  
  // Remove quoted email content (lines starting with > or On ... wrote:)
  const lines = cleanBody.split('\n');
  const nonQuotedLines = [];
  let inQuotedSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect start of quoted section
    if (line.match(/^On .+ wrote:/i) || line.match(/^From: .+$/i) || line.match(/^Sent: .+$/i)) {
      inQuotedSection = true;
      continue;
    }
    
    // Stop at quoted lines (starting with >)
    if (line.startsWith('>') || line.startsWith('&gt;')) {
      inQuotedSection = true;
      continue;
    }
    
    // If we hit a blank line after quoted section, we might be out
    if (inQuotedSection && line === '') {
      // Check if next non-empty line is not quoted
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && !lines[j].trim().startsWith('>') && !lines[j].trim().startsWith('&gt;')) {
        inQuotedSection = false;
      }
    }
    
    if (!inQuotedSection && line.length > 0) {
      nonQuotedLines.push(line);
    }
  }
  
  cleanBody = nonQuotedLines.join(' ').trim();
  
  // If no clean body found, use original (might be plain text email)
  if (!cleanBody || cleanBody.length < 5) {
    cleanBody = body;
  }
  
  const lowerBody = cleanBody.toLowerCase();
  
  // Check for rejection first (higher priority) - but only in non-quoted sections
  for (const keyword of rejectionKeywords) {
    if (bodyContainsKeyword(lowerBody, keyword)) {
      console.log(`❌ Rejection keyword found: "${keyword}" in: "${cleanBody.substring(0, 120)}"`);
      return false; // Rejection detected
    }
  }
  
  // Check for approval - look for keywords in the clean body
  for (const keyword of approvalKeywords) {
    if (bodyContainsKeyword(lowerBody, keyword)) {
      console.log(`✅ Approval keyword found: "${keyword}" in: "${cleanBody.substring(0, 120)}"`);
      return true; // Approval detected
    }
  }
  
  console.log(`⚠️ No approval/rejection keywords found. Clean body (${cleanBody.length} chars): "${cleanBody.substring(0, 200)}"`);
  return false; // No clear approval/rejection detected
}

/**
 * Monitor Gmail for order approval replies
 * @param {string} orderId - Order ID
 * @param {string} subject - Original email subject
 * @param {Function} onApproval - Callback when approval detected
 * @param {Function} onRejection - Callback when rejection detected
 * @returns {Function} Function to stop monitoring
 */
// Store active monitoring intervals globally so they persist
const activeMonitors = new Map();

function getHeaderValue(headers = [], name) {
  const target = String(name || '').toLowerCase();
  return headers.find(h => String(h?.name || '').toLowerCase() === target)?.value || '';
}

function extractEmailAddress(value = '') {
  const match = String(value).match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim().toLowerCase();
  return String(value).trim().toLowerCase();
}

export function monitorOrderReplies(orderId, subject, onApproval, onRejection, options = {}) {
  console.log(`📧 Starting reply monitoring for order ${orderId} with subject: "${subject}"`);
  
  // Stop any existing monitoring for this order
  if (activeMonitors.has(orderId)) {
    const existingMonitor = activeMonitors.get(orderId);
    if (existingMonitor.intervalId) {
      clearInterval(existingMonitor.intervalId);
    }
  }
  
  let processedMessageIds = new Set(); // Track messages that have been processed (approved/rejected)
  let checkedMessageIds = new Set(); // Track all messages we've checked
  
  const checkReplies = async () => {
    try {
      console.log(`🔍 Checking for replies to order ${orderId}...`);
      const replies = await searchOrderReplies(orderId, subject, { threadId: options?.sentThreadId });
      
      if (replies.length === 0) {
        console.log('No replies found yet');
        return;
      }
      
      console.log(`Found ${replies.length} total reply message(s)`);
      
      // Check ALL replies (not just "new" ones) to catch any we might have missed
      // Only skip messages that have already been processed (approved/rejected)
      const unprocessedReplies = replies.filter(msg => !processedMessageIds.has(msg.id));
      
      if (unprocessedReplies.length === 0) {
        console.log('All replies have already been processed');
        return;
      }
      
      console.log(`Checking ${unprocessedReplies.length} unprocessed reply(ies)`);
      
      // Check each reply for approval/rejection
      for (const reply of unprocessedReplies) {
        const headers = reply?.payload?.headers || [];
        const fromHeader = getHeaderValue(headers, 'from');
        const fromEmail = extractEmailAddress(fromHeader);
        const subjectHeader = getHeaderValue(headers, 'subject');
        const inReplyTo = getHeaderValue(headers, 'in-reply-to');
        const references = getHeaderValue(headers, 'references');
        const autoSubmitted = getHeaderValue(headers, 'auto-submitted');
        const precedence = getHeaderValue(headers, 'precedence');
        const messageTimestamp = Number(reply?.internalDate || 0);

        const senderEmail = extractEmailAddress(options?.senderEmail || '');
        const sentMessageId = options?.sentMessageId || null;
        const sentThreadId = options?.sentThreadId || null;
        const sentAtMs = Number(options?.sentAtMs || 0);
        const expectedRecipients = (options?.expectedRecipients || [])
          .map(v => extractEmailAddress(v))
          .filter(Boolean);
        const hasReplyHeader = Boolean(inReplyTo || references);
        const subjectLooksLikeReply = /^re:/i.test(subjectHeader);
        const fromExpectedRecipient = expectedRecipients.length === 0 || expectedRecipients.includes(fromEmail);
        const isFromSender = senderEmail && fromEmail === senderEmail;
        const isSentMessage = sentMessageId && reply.id === sentMessageId;
        const sameThread = !sentThreadId || reply.threadId === sentThreadId;
        const isBeforeSent = sentAtMs > 0 && messageTimestamp > 0 && messageTimestamp <= sentAtMs;
        const isAutoReply =
          /auto-generated|auto-replied/i.test(autoSubmitted) ||
          /bulk|list|junk/i.test(precedence);

        if (!sameThread) {
          console.log(`⏭️ Skipping ${reply.id}: not in target thread`);
          continue;
        }
        if (isSentMessage || isFromSender) {
          console.log(`⏭️ Skipping ${reply.id}: sender/self message`);
          continue;
        }
        if (isBeforeSent) {
          console.log(`⏭️ Skipping ${reply.id}: message is older than sent email`);
          continue;
        }
        if (!hasReplyHeader && !subjectLooksLikeReply) {
          console.log(`⏭️ Skipping ${reply.id}: not a real reply message`);
          continue;
        }
        if (!fromExpectedRecipient) {
          console.log(`⏭️ Skipping ${reply.id}: sender ${fromEmail} not in recipient list`);
          continue;
        }
        if (isAutoReply) {
          console.log(`⏭️ Skipping ${reply.id}: auto-generated message`);
          continue;
        }

        const body = parseEmailBody(reply);
        const bodyPreview = body.substring(0, 500); // Show more of the body
        console.log(`📝 Reply body (first 500 chars): ${bodyPreview}`);
        console.log(`📝 Full reply body length: ${body.length} chars`);
        
        // Mark as checked (so we don't log it again unnecessarily)
        if (!checkedMessageIds.has(reply.id)) {
          checkedMessageIds.add(reply.id);
          console.log(`📌 First time checking message ${reply.id}`);
        }
        
        // Use the improved isApprovalReply function which handles quoted content
        const isApproval = isApprovalReply(body);
        console.log(`✅ Approval detected: ${isApproval}`);
        
        if (isApproval) {
          console.log('🎉 Approval detected! Calling onApproval callback...');
          // Mark as processed immediately to prevent duplicate processing
          processedMessageIds.add(reply.id);
          try {
            await onApproval(reply, body);
            console.log('✅ Approval callback completed');
          } catch (callbackError) {
            console.error('❌ Error in approval callback:', callbackError);
          }
          // Stop monitoring after approval - this is critical
          console.log('🛑 Stopping reply monitoring for approved order');
          stopMonitoring();
          return; // Exit immediately after approval
        } 
        
        // Check for rejection using the same improved function logic
        // Remove quoted sections for rejection check too
        const lines = body.split('\n');
        const nonQuotedLines = [];
        let inQuotedSection = false;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.match(/^On .+ wrote:/i) || line.startsWith('>') || line.startsWith('&gt;')) {
            inQuotedSection = true;
            continue;
          }
          if (!inQuotedSection && line.length > 0) {
            nonQuotedLines.push(line);
          }
        }
        
        const cleanBody = nonQuotedLines.join(' ').toLowerCase();
        const hasReject = cleanBody.includes('reject');
        const hasDenied = cleanBody.includes('denied');
        const hasDecline = cleanBody.includes('decline');
        const hasRefuse = cleanBody.includes('refuse');
        
        console.log(`🔍 Rejection check (clean body): reject=${hasReject}, denied=${hasDenied}, decline=${hasDecline}, refuse=${hasRefuse}`);
        
        if (hasReject || hasDenied || hasDecline || hasRefuse) {
          console.log('❌ Rejection detected! Calling onRejection callback...');
          // Mark as processed
          processedMessageIds.add(reply.id);
          try {
            await onRejection(reply, body);
            console.log('✅ Rejection callback completed');
          } catch (callbackError) {
            console.error('❌ Error in rejection callback:', callbackError);
          }
          // Stop monitoring after rejection
          stopMonitoring();
          return;
        }
        
        console.log('⚠️ Reply found but no approval/rejection keywords detected');
        console.log('⚠️ Body contains:', body.length > 0 ? 'Yes' : 'No');
        if (body.length > 0) {
          const sampleText = nonQuotedLines.length > 0 
            ? nonQuotedLines.slice(0, 5).join(' ')
            : body.split(/\s+/).slice(0, 20).join(' ');
          console.log('⚠️ Sample words from clean body:', sampleText.substring(0, 200));
        }
      }
      
      console.log(`✅ Checked ${unprocessedReplies.length} reply(ies), continuing to monitor...`);
    } catch (error) {
      console.error('❌ Error monitoring order replies:', error);
      console.error('Error details:', error.result?.error || error.message);
    }
  };
  
  const stopMonitoring = () => {
    const monitor = activeMonitors.get(orderId);
    if (monitor && monitor.intervalId) {
      console.log(`🛑 Stopping reply monitoring for order ${orderId}`);
      clearInterval(monitor.intervalId);
      activeMonitors.delete(orderId);
    }
  };
  
  // Store monitor info
  const monitorInfo = {
    orderId,
    subject,
    intervalId: null,
    stopMonitoring
  };
  
  // Start monitoring (check every 15 seconds for faster response)
  monitorInfo.intervalId = setInterval(checkReplies, 15000);
  activeMonitors.set(orderId, monitorInfo);
  
  // Check immediately
  console.log('⏱️ Starting immediate check...');
  checkReplies();
  
  return stopMonitoring;
}
