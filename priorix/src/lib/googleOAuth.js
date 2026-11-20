import { googleOAuthClientId } from './firebase.js';

export const ACTIVE_GOOGLE_CLIENT_ID = '9311814120-afkmf0sribf0ok5j1723974ehuuildgo.apps.googleusercontent.com';

/**
 * Google OAuth 2.0 Client for Priorix
 * 
 * Strict Principle of Least Privilege:
 * Requested Scopes:
 * - https://www.googleapis.com/auth/calendar.events (Sync & create user-selected events)
 * - https://www.googleapis.com/auth/gmail.readonly (Strictly read-only follow-up detection)
 * 
 * Excluded / Strictly Forbidden:
 * - NO gmail.send, NO gmail.compose, NO gmail.modify, NO mail.google.com
 * - NO broad calendar administration scopes
 */

export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly'
];

/**
 * Returns the active resolved Google Client ID
 */
export function getEffectiveGoogleClientId() {
  const envId = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GOOGLE_CLIENT_ID : '';
  if (envId && !envId.startsWith('952797581548')) {
    return envId;
  }
  if (googleOAuthClientId && !googleOAuthClientId.startsWith('952797581548')) {
    return googleOAuthClientId;
  }
  return ACTIVE_GOOGLE_CLIENT_ID;
}

/**
 * Fetches current authoritative server-side Google Workspace connection status
 */
export async function fetchServerGoogleStatus(uid) {
  if (!uid) return { connected: false, status: 'DISCONNECTED', email: '', scopes: [] };
  try {
    const res = await fetch(`/api/auth/google/status?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) {
      return { connected: false, status: 'DISCONNECTED', email: '', scopes: [] };
    }
    const data = await res.json();
    return {
      connected: Boolean(data.connected),
      status: data.status || (data.connected ? 'CONNECTED' : data.requiresReauth ? 'NEEDS_REAUTHORIZATION' : 'DISCONNECTED'),
      email: data.email || '',
      scopes: data.scopes || GOOGLE_OAUTH_SCOPES,
      hasRefreshToken: Boolean(data.hasRefreshToken),
      requiresReauth: Boolean(data.requiresReauth),
      connectedAt: data.connectedAt || null,
      lastRefreshedAt: data.lastRefreshedAt || null,
      lastError: data.lastError || null,
    };
  } catch (err) {
    console.warn('Could not query server Google status:', err);
    return { connected: false, status: 'DISCONNECTED', email: '', scopes: [] };
  }
}

/**
 * Retrieves a valid active access token from server-side vault (refreshing if needed)
 */
export async function fetchServerGoogleToken(uid) {
  if (!uid) return { success: false, accessToken: null, status: 'DISCONNECTED' };
  try {
    const res = await fetch('/api/auth/google/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    });
    const data = await res.json();
    if (data.success && data.accessToken) {
      storeGoogleToken(uid, data.accessToken, 3600);
      return {
        success: true,
        accessToken: data.accessToken,
        status: 'CONNECTED',
        email: data.email,
        scopes: data.scopes,
      };
    }
    return {
      success: false,
      accessToken: null,
      status: data.status || 'DISCONNECTED',
      requiresReauth: Boolean(data.requiresReauth),
      error: data.error,
    };
  } catch (err) {
    console.warn('Could not fetch server Google token:', err);
    return {
      success: false,
      accessToken: null,
      status: 'DISCONNECTED',
      error: err.message,
    };
  }
}

/**
 * Dynamically loads the Google Identity Services script if not already present
 */
export function loadGoogleGsiScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.google?.accounts?.oauth2) return resolve(true);

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', (e) => reject(new Error('Failed to load Google Identity Services script')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
    document.head.appendChild(script);
  });
}

/**
 * Retrieves the stored access token from sessionStorage for the given user UID
 */
export function getStoredGoogleToken(uid) {
  if (typeof window === 'undefined' || !uid) return null;
  try {
    const raw = sessionStorage.getItem(`priorix_google_token_${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() > parsed.expiresAt - 60000) {
      sessionStorage.removeItem(`priorix_google_token_${uid}`);
      return null;
    }
    return parsed.accessToken;
  } catch (e) {
    return null;
  }
}

/**
 * Stores the retrieved access token in sessionStorage for the given user UID
 */
export function storeGoogleToken(uid, accessToken, expiresInSeconds) {
  if (typeof window === 'undefined' || !uid || !accessToken) return;
  try {
    const expiresAt = Date.now() + (Number(expiresInSeconds) || 3600) * 1000;
    sessionStorage.setItem(`priorix_google_token_${uid}`, JSON.stringify({
      accessToken,
      expiresAt,
    }));
  } catch (e) {
    console.warn('Unable to store Google token in sessionStorage:', e);
  }
}

/**
 * Clears the stored access token from sessionStorage
 */
export function clearStoredGoogleToken(uid) {
  if (typeof window === 'undefined' || !uid) return;
  try {
    sessionStorage.removeItem(`priorix_google_token_${uid}`);
  } catch (e) {
    // Ignore
  }
}

/**
 * Initiates the Google OAuth authorization flow using Google Identity Services (GSI).
 * Requests user consent for Calendar and Gmail Readonly scopes.
 */
export async function requestGoogleAuthorization(uid, prompt = 'consent', email = '') {
  if (!uid) throw new Error('User must be logged in to connect Google');

  await loadGoogleGsiScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services is loading or unavailable. Please try again.');
  }

  const clientId = getEffectiveGoogleClientId();
  if (!clientId) {
    throw new Error('Google OAuth Client ID is not configured.');
  }

  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_OAUTH_SCOPES.join(' '),
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            console.error('Google OAuth Error Response:', tokenResponse);
            reject(new Error(tokenResponse.error_description || tokenResponse.error || 'Google Authorization failed'));
            return;
          }

          if (tokenResponse.access_token) {
            storeGoogleToken(uid, tokenResponse.access_token, tokenResponse.expires_in);

            // Register token with backend server vault
            try {
              await fetch('/api/auth/google/register-client-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  uid,
                  email,
                  accessToken: tokenResponse.access_token,
                  scopes: GOOGLE_OAUTH_SCOPES,
                }),
              });
            } catch (regErr) {
              console.warn('Could not register token with server vault:', regErr);
            }

            // Register with backend server worker
            try {
              const userTimezone = typeof Intl !== 'undefined'
                ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
                : 'Asia/Kolkata';
              await fetch('/api/worker/register-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  uid,
                  email,
                  accessToken: tokenResponse.access_token,
                  userTimezone,
                }),
              });
            } catch (workerErr) {
              console.warn('Could not register token with server worker:', workerErr);
            }

            resolve({
              accessToken: tokenResponse.access_token,
              expiresIn: tokenResponse.expires_in,
              scopes: GOOGLE_OAUTH_SCOPES,
            });
          } else {
            reject(new Error('No access token returned from Google authorization'));
          }
        },
        error_callback: (err) => {
          const isCancelled =
            err?.type === 'popup_closed' ||
            err?.type === 'popup_blocked_by_browser' ||
            err?.type === 'user_cancelled' ||
            (err?.message && err.message.toLowerCase().includes('closed'));

          if (isCancelled) {
            const cancelError = new Error('Google authorization was cancelled (popup window closed).');
            cancelError.isCancelled = true;
            cancelError.type = err?.type || 'popup_closed';
            reject(cancelError);
          } else {
            reject(new Error(err?.message || 'Google authorization dialog encountered an error'));
          }
        }
      });

      client.requestAccessToken({ prompt });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Revokes the Google OAuth authorization and clears local and server state
 */
export async function revokeGoogleAuthorization(uid) {
  const token = getStoredGoogleToken(uid);
  clearStoredGoogleToken(uid);

  // Notify backend server to revoke credentials
  try {
    await fetch('/api/auth/google/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    });
  } catch (e) {
    console.warn('Backend disconnect notice error:', e);
  }

  if (token && window.google?.accounts?.oauth2?.revoke) {
    try {
      await new Promise((resolve) => {
        window.google.accounts.oauth2.revoke(token, () => resolve(true));
      });
    } catch (e) {
      console.warn('Token revocation returned notice:', e);
    }
  }
}
