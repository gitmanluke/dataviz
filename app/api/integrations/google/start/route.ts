import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { CodeChallengeMethod } from "google-auth-library"
import { getOAuthClient } from "@/lib/integrations/google/auth"
import { GOOGLE_SCOPE } from "@/lib/integrations/google/scopes"
import { GoogleAuthError } from "@/lib/integrations/google/errors"

export const OAUTH_COOKIE = "g_oauth"
const COOKIE_PATH = "/api/integrations/google"

// GET /api/integrations/google/start — kick off the Desktop-app OAuth loopback
// flow. Stashes the PKCE verifier + state in a short-lived httpOnly cookie and
// redirects to Google's consent screen.
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin
  const redirectUri = `${origin}${COOKIE_PATH}/callback`

  let client
  try {
    client = await getOAuthClient(redirectUri)
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      return NextResponse.redirect(
        new URL("/settings?google=error&reason=not_configured", request.url),
      )
    }
    throw error
  }

  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync()
  const state = randomBytes(16).toString("hex")

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force a refresh_token every time
    scope: [GOOGLE_SCOPE],
    code_challenge_method: CodeChallengeMethod.S256,
    code_challenge: codeChallenge,
    state,
  })

  const res = NextResponse.redirect(new URL(authUrl))
  res.cookies.set(OAUTH_COOKIE, `${state}.${codeVerifier}`, {
    httpOnly: true,
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: 600,
  })
  return res
}
