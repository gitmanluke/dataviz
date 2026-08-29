import { GoogleAuthError, GoogleApiError } from "./errors"

// Pure access-token logic — no prisma, no server-only — so it's unit-testable.
// The OAuth *dance* (auth URL, PKCE, code exchange) goes through
// google-auth-library in auth.ts; refreshing a refresh-token into an access
// token is one form POST, done directly here so the cache is easy to test.

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"

export interface OAuthCreds {
  clientId: string
  clientSecret: string
}

export interface AccessToken {
  token: string
  expiresAt: number // epoch ms; already backed off 60s from Google's expiry
}

export interface RefreshDeps {
  fetchImpl?: typeof fetch
  now?: () => number
}

export async function refreshAccessToken(
  refreshToken: string,
  creds: OAuthCreds,
  deps: RefreshDeps = {},
): Promise<AccessToken> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const now = deps.now ?? Date.now

  const res = await fetchImpl(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })

  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!res.ok || !body.access_token) {
    if (body.error === "invalid_grant") {
      throw new GoogleAuthError(
        "Google connection expired — reconnect in Settings.",
        "reconnect_required",
      )
    }
    throw new GoogleApiError(
      res.status,
      body.error_description || body.error || "token refresh failed",
    )
  }

  return {
    token: body.access_token,
    expiresAt: now() + (Number(body.expires_in ?? 3600) - 60) * 1000,
  }
}

export interface ProviderDeps {
  loadRefreshToken: () => Promise<string | null>
  loadCreds: () => Promise<OAuthCreds | null>
  refresh?: typeof refreshAccessToken
  now?: () => number
}

/** In-memory access-token cache. `get()` refreshes only when the cached token is
 *  within 60s of expiry (that margin is baked into `expiresAt`). */
export function createAccessTokenProvider(deps: ProviderDeps) {
  const refresh = deps.refresh ?? refreshAccessToken
  const now = deps.now ?? Date.now
  let cache: AccessToken | null = null

  async function get(): Promise<AccessToken> {
    if (cache && cache.expiresAt > now()) return cache

    const creds = await deps.loadCreds()
    if (!creds) {
      throw new GoogleAuthError("Google is not configured.", "not_configured")
    }
    const refreshToken = await deps.loadRefreshToken()
    if (!refreshToken) {
      throw new GoogleAuthError("Google is not connected.", "reconnect_required")
    }

    cache = await refresh(refreshToken, creds, { now })
    return cache
  }

  return {
    get,
    reset() {
      cache = null
    },
  }
}
