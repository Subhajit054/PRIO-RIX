import fs from "fs";
import path from "path";

const ACTIVE_GOOGLE_CLIENT_ID = "9311814120-afkmf0sribf0ok5j1723974ehuuildgo.apps.googleusercontent.com";
const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.readonly",
];

/**
 * Server-Side Google OAuth Token and Credential Manager
 * 
 * Securely manages Google OAuth 2.0 Authorization Code exchange,
 * server-side refresh token persistence, automatic token renewal,
 * and user-isolated credential retrieval for autonomous background processing.
 * 
 * SECURITY DIRECTIVES:
 * - Refresh tokens are NEVER returned in API responses.
 * - Refresh tokens are NEVER exposed to client JavaScript or Vite bundles.
 * - Credentials are strictly partitioned by Firebase UID.
 */

export interface StoredUserGoogleCredentials {
  uid: string;
  email: string;
  refreshToken: string | null;
  accessToken: string | null;
  accessTokenExpiresAt: number; // Unix timestamp in ms
  scopes: string[];
  connectedAt: string;
  lastRefreshedAt: string | null;
  status: "CONNECTED" | "NEEDS_REAUTHORIZATION" | "DISCONNECTED";
  lastError: string | null;
}

// In-memory secure server-side credential vault keyed strictly by Firebase UID
const serverCredentialStore = new Map<string, StoredUserGoogleCredentials>();

const VAULT_DIR = path.join(process.cwd(), "data");
const VAULT_FILE = path.join(VAULT_DIR, ".google_vault.json");

function loadVaultFromDisk() {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const data = JSON.parse(fs.readFileSync(VAULT_FILE, "utf-8"));
      if (Array.isArray(data)) {
        for (const item of data) {
          if (
            item &&
            item.uid &&
            !item.uid.startsWith("test-") &&
            !item.uid.startsWith("mock-") &&
            !item.uid.startsWith("user-alpha") &&
            !item.uid.startsWith("user-beta")
          ) {
            serverCredentialStore.set(item.uid, item);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[ServerGoogleAuth] Vault disk load notice:", err);
  }
}

function persistVaultToDisk() {
  try {
    if (!fs.existsSync(VAULT_DIR)) {
      fs.mkdirSync(VAULT_DIR, { recursive: true });
    }
    const data = Array.from(serverCredentialStore.values()).filter(
      (c) =>
        c &&
        c.uid &&
        !c.uid.startsWith("test-") &&
        !c.uid.startsWith("mock-") &&
        !c.uid.startsWith("user-alpha") &&
        !c.uid.startsWith("user-beta")
    );
    fs.writeFileSync(VAULT_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("[ServerGoogleAuth] Vault disk persist notice:", err);
  }
}

// Initial load
loadVaultFromDisk();

export function getEffectiveServerClientId(): string {
  const envId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
  if (envId && !envId.startsWith("952797581548") && !envId.startsWith("dummy") && envId.includes(".apps.googleusercontent.com")) {
    return envId;
  }
  return ACTIVE_GOOGLE_CLIENT_ID;
}

export function getEffectiveServerClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET || "";
}

/**
 * Stores or updates server-side Google credentials for a user
 */
export function saveServerUserCredentials(creds: Partial<StoredUserGoogleCredentials> & { uid: string }): StoredUserGoogleCredentials {
  const existing = serverCredentialStore.get(creds.uid);
  const isFreshToken = Boolean(creds.accessToken);
  const updated: StoredUserGoogleCredentials = {
    uid: creds.uid,
    email: creds.email ?? existing?.email ?? "",
    refreshToken: creds.refreshToken !== undefined ? creds.refreshToken : (existing?.refreshToken ?? null),
    accessToken: creds.accessToken !== undefined ? creds.accessToken : (existing?.accessToken ?? null),
    accessTokenExpiresAt: creds.accessTokenExpiresAt ?? existing?.accessTokenExpiresAt ?? (Date.now() + 3600 * 1000),
    scopes: creds.scopes ?? existing?.scopes ?? GOOGLE_OAUTH_SCOPES,
    connectedAt: existing?.connectedAt ?? new Date().toISOString(),
    lastRefreshedAt: creds.lastRefreshedAt ?? existing?.lastRefreshedAt ?? null,
    status: creds.status ?? (isFreshToken ? "CONNECTED" : (existing?.status ?? "CONNECTED")),
    lastError: creds.lastError !== undefined ? creds.lastError : (isFreshToken ? null : (existing?.lastError ?? null)),
  };

  serverCredentialStore.set(creds.uid, updated);
  persistVaultToDisk();
  return updated;
}

/**
 * Exchanges Google OAuth Authorization Code for Access Token and Refresh Token
 */
export async function exchangeAuthorizationCode(params: {
  code: string;
  uid: string;
  email?: string;
  redirectUri?: string;
}): Promise<{
  success: boolean;
  accessToken: string;
  expiresIn: number;
  scopes: string[];
  hasRefreshToken: boolean;
  error?: string;
}> {
  const clientId = getEffectiveServerClientId();
  const clientSecret = getEffectiveServerClientSecret();
  const redirectUri = params.redirectUri || "postmessage";

  try {
    const postBody: Record<string, string> = {
      code: params.code,
      client_id: clientId,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    };

    if (clientSecret) {
      postBody.client_secret = clientSecret;
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(postBody).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      const errDetail = tokenData.error_description || tokenData.error || "Token exchange failed";
      console.error("[ServerGoogleAuth] Code exchange error from Google:", errDetail);
      return {
        success: false,
        accessToken: "",
        expiresIn: 0,
        scopes: [],
        hasRefreshToken: false,
        error: errDetail,
      };
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresIn = Number(tokenData.expires_in) || 3600;
    const returnedScopes = tokenData.scope ? tokenData.scope.split(" ") : GOOGLE_OAUTH_SCOPES;

    // Securely persist to server-side credential vault
    saveServerUserCredentials({
      uid: params.uid,
      email: params.email || "",
      accessToken,
      refreshToken,
      accessTokenExpiresAt: Date.now() + (expiresIn - 60) * 1000,
      scopes: returnedScopes,
      status: "CONNECTED",
      lastError: null,
      lastRefreshedAt: new Date().toISOString(),
    });

    return {
      success: true,
      accessToken,
      expiresIn,
      scopes: returnedScopes,
      hasRefreshToken: Boolean(refreshToken),
    };
  } catch (err: any) {
    console.error("[ServerGoogleAuth] Network error exchanging auth code:", err);
    return {
      success: false,
      accessToken: "",
      expiresIn: 0,
      scopes: [],
      hasRefreshToken: false,
      error: err.message || "Failed to exchange authorization code",
    };
  }
}

/**
 * Returns a valid, active Google Access Token for the specified user UID.
 * If the current access token is expired or missing, it automatically uses
 * the stored server-side refresh token to mint a fresh access token.
 */
export async function getValidGoogleAccessToken(uid: string): Promise<string> {
  const creds = serverCredentialStore.get(uid);
  if (!creds) {
    throw new Error(`No Google credentials found for user ${uid}`);
  }

  if (creds.status === "DISCONNECTED") {
    throw new Error(`Google integration is disconnected for user ${uid}`);
  }

  const now = Date.now();

  // If active access token exists and has at least 60 seconds before expiration, return it
  if (creds.accessToken && creds.accessTokenExpiresAt > now + 60000) {
    if (creds.status === "NEEDS_REAUTHORIZATION") {
      creds.status = "CONNECTED";
      creds.lastError = null;
      persistVaultToDisk();
    }
    return creds.accessToken;
  }

  // Need to refresh using refresh token
  if (!creds.refreshToken) {
    if (creds.accessToken && creds.accessTokenExpiresAt > now) {
      // Ephemeral token still valid for a few seconds
      return creds.accessToken;
    }
    creds.status = "NEEDS_REAUTHORIZATION";
    creds.lastError = "Access token expired and no refresh token available. User must re-authenticate.";
    throw new Error(creds.lastError);
  }

  // Refresh token flow
  try {
    const clientId = getEffectiveServerClientId();
    const clientSecret = getEffectiveServerClientSecret();

    const postBody: Record<string, string> = {
      client_id: clientId,
      refresh_token: creds.refreshToken,
      grant_type: "refresh_token",
    };

    if (clientSecret) {
      postBody.client_secret = clientSecret;
    }

    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(postBody).toString(),
    });

    const refreshData = await refreshRes.json();

    if (!refreshRes.ok || refreshData.error) {
      const errCode = refreshData.error || "";
      const errDesc = refreshData.error_description || "";
      const isClientDeleted = errDesc.toLowerCase().includes("deleted") || errCode === "invalid_client" || errCode === "unauthorized_client";
      const isRevoked = errCode === "invalid_grant" || isClientDeleted;

      creds.status = "NEEDS_REAUTHORIZATION";
      creds.lastError = isClientDeleted
        ? "Google OAuth client configuration was updated or deleted. Please re-authenticate."
        : (errDesc || "Google authorization was revoked or expired. Please re-connect Google account.");

      console.warn(`[ServerGoogleAuth] User ${uid} authorization error: ${creds.lastError} (${errCode})`);
      persistVaultToDisk();
      throw new Error(creds.lastError);
    }

    const newAccessToken = refreshData.access_token;
    const expiresIn = Number(refreshData.expires_in) || 3600;

    creds.accessToken = newAccessToken;
    creds.accessTokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;
    creds.lastRefreshedAt = new Date().toISOString();
    creds.status = "CONNECTED";
    creds.lastError = null;

    console.log(`[ServerGoogleAuth] Successfully refreshed Google access token for user ${uid}`);
    persistVaultToDisk();
    return newAccessToken;
  } catch (err: any) {
    if (creds.status !== "NEEDS_REAUTHORIZATION") {
      const errMsg = err.message || "";
      if (
        errMsg.toLowerCase().includes("deleted") ||
        errMsg.toLowerCase().includes("invalid_client") ||
        errMsg.toLowerCase().includes("invalid_grant") ||
        errMsg.toLowerCase().includes("unauthorized")
      ) {
        creds.status = "NEEDS_REAUTHORIZATION";
      }
      creds.lastError = err.message || "Failed to refresh Google access token";
    }
    persistVaultToDisk();
    throw err;
  }
}

/**
 * Revokes Google access and removes server-side credentials
 */
export async function revokeServerGoogleCredentials(uid: string): Promise<boolean> {
  const creds = serverCredentialStore.get(uid);
  if (!creds) {
    persistVaultToDisk();
    return true;
  }

  const tokenToRevoke = creds.refreshToken || creds.accessToken;
  if (tokenToRevoke) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch (e) {
      console.warn(`[ServerGoogleAuth] Token revocation notice for user ${uid}:`, e);
    }
  }

  creds.accessToken = null;
  creds.refreshToken = null;
  creds.status = "DISCONNECTED";
  creds.lastError = null;
  serverCredentialStore.delete(uid);
  persistVaultToDisk();

  return true;
}

/**
 * Returns safe connection status for the UI without leaking sensitive tokens
 */
export function getSafeGoogleConnectionStatus(uid: string) {
  const creds = serverCredentialStore.get(uid);
  if (!creds || creds.status === "DISCONNECTED") {
    return {
      connected: false,
      status: "DISCONNECTED" as const,
      email: "",
      scopes: [],
      hasRefreshToken: false,
      requiresReauth: false,
      connectedAt: null,
      lastRefreshedAt: null,
      lastError: null,
    };
  }

  return {
    connected: creds.status === "CONNECTED",
    status: creds.status,
    email: creds.email,
    scopes: creds.scopes,
    hasRefreshToken: Boolean(creds.refreshToken),
    requiresReauth: creds.status === "NEEDS_REAUTHORIZATION",
    connectedAt: creds.connectedAt,
    lastRefreshedAt: creds.lastRefreshedAt,
    lastError: creds.lastError,
  };
}

/**
 * Returns all user IDs that have active Google integrations for autonomous processing
 */
export function getActiveConnectedUserIds(): string[] {
  const uids: string[] = [];
  for (const [uid, creds] of serverCredentialStore.entries()) {
    if (
      creds.status === "CONNECTED" &&
      !uid.startsWith("test-") &&
      !uid.startsWith("mock-") &&
      !uid.startsWith("user-alpha") &&
      !uid.startsWith("user-beta")
    ) {
      uids.push(uid);
    }
  }
  return uids;
}

/**
 * Returns all stored connected Google user records for autonomous sync hydration
 */
export function getAllStoredGoogleUsers(): StoredUserGoogleCredentials[] {
  const users: StoredUserGoogleCredentials[] = [];
  for (const [uid, creds] of serverCredentialStore.entries()) {
    if (
      creds.status === "CONNECTED" &&
      !uid.startsWith("test-") &&
      !uid.startsWith("mock-") &&
      !uid.startsWith("user-alpha") &&
      !uid.startsWith("user-beta")
    ) {
      users.push(creds);
    }
  }
  return users;
}
