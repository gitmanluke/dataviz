import { NextRequest, NextResponse } from "next/server"
import { getOAuthClient, storeTokens } from "@/lib/integrations/google/auth"
import { GoogleAuthError } from "@/lib/integrations/google/errors"
import { OAUTH_COOKIE } from "../start/route"

const COOKIE_PATH = "/api/integrations/google"

// GET /api/integrations/google/callback — Google redirects here with ?code.
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const oauthError = url.searchParams.get("error")
  const cookie = request.cookies.get(OAUTH_COOKIE)?.value

  const done = (params: string) => {
    const res = NextResponse.redirect(new URL(`/settings?${params}`, request.url))
    res.cookies.set(OAUTH_COOKIE, "", { path: COOKIE_PATH, maxAge: 0 })
    return res
  }

  if (oauthError) return done(`google=error&reason=${encodeURIComponent(oauthError)}`)
  if (!code || !state || !cookie) return done("google=error&reason=missing_params")

  const [expectedState, codeVerifier] = cookie.split(".")
  if (state !== expectedState || !codeVerifier) {
    return done("google=error&reason=state_mismatch")
  }

  try {
    const client = await getOAuthClient(`${url.origin}${COOKIE_PATH}/callback`)
    const { tokens } = await client.getToken({ code, codeVerifier })
    await storeTokens({ refresh_token: tokens.refresh_token, scope: tokens.scope })
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      return done(`google=error&reason=${error.reason}`)
    }
    console.error("[google/callback] token exchange failed:", error)
    return done("google=error&reason=exchange_failed")
  }

  return done("google=connected")
}
