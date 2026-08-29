import { describe, expect, it, vi } from "vitest"
import { GoogleApiError, GoogleAuthError } from "./errors"
import {
  createAccessTokenProvider,
  refreshAccessToken,
  type OAuthCreds,
} from "./token"

const creds: OAuthCreds = { clientId: "id", clientSecret: "secret" }

const jsonResponse = (status: number, body: unknown): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

describe("refreshAccessToken", () => {
  it("posts the refresh grant and returns a token backed off 60s", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { access_token: "at-1", expires_in: 3600 }),
    )
    const r = await refreshAccessToken("rt", creds, { fetchImpl, now: () => 10_000 })

    expect(r.token).toBe("at-1")
    expect(r.expiresAt).toBe(10_000 + (3600 - 60) * 1000)

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const sent = new URLSearchParams(init.body as URLSearchParams)
    expect(sent.get("grant_type")).toBe("refresh_token")
    expect(sent.get("refresh_token")).toBe("rt")
    expect(sent.get("client_secret")).toBe("secret")
  })

  it("maps invalid_grant to a reconnect_required GoogleAuthError", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(400, { error: "invalid_grant" }))
    await expect(refreshAccessToken("rt", creds, { fetchImpl })).rejects.toMatchObject({
      name: "GoogleAuthError",
      reason: "reconnect_required",
    })
  })

  it("throws GoogleApiError on other failures", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(500, { error: "backend_error", error_description: "boom" }),
    )
    await expect(refreshAccessToken("rt", creds, { fetchImpl })).rejects.toBeInstanceOf(
      GoogleApiError,
    )
  })
})

describe("createAccessTokenProvider", () => {
  it("caches until expiry, then refreshes again", async () => {
    let clock = 0
    const refresh = vi.fn(async () => ({ token: `at-${refresh.mock.calls.length}`, expiresAt: clock + 1000 }))
    const provider = createAccessTokenProvider({
      loadCreds: async () => creds,
      loadRefreshToken: async () => "rt",
      refresh,
      now: () => clock,
    })

    expect((await provider.get()).token).toBe("at-1")
    expect((await provider.get()).token).toBe("at-1") // cache hit
    expect(refresh).toHaveBeenCalledTimes(1)

    clock = 2000 // past expiresAt
    expect((await provider.get()).token).toBe("at-2")
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it("throws not_configured when credentials are missing", async () => {
    const provider = createAccessTokenProvider({
      loadCreds: async () => null,
      loadRefreshToken: async () => "rt",
    })
    await expect(provider.get()).rejects.toMatchObject({ reason: "not_configured" })
  })

  it("throws reconnect_required when no refresh token is stored", async () => {
    const provider = createAccessTokenProvider({
      loadCreds: async () => creds,
      loadRefreshToken: async () => null,
    })
    await expect(provider.get()).rejects.toMatchObject({ reason: "reconnect_required" })
  })

  it("resets the cache on reset()", async () => {
    const refresh = vi.fn(async () => ({ token: "at", expiresAt: 1e12 }))
    const provider = createAccessTokenProvider({
      loadCreds: async () => creds,
      loadRefreshToken: async () => "rt",
      refresh,
    })
    await provider.get()
    provider.reset()
    await provider.get()
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it("propagates a reconnect_required error from refresh", async () => {
    const refresh = vi.fn(async () => {
      throw new GoogleAuthError("expired", "reconnect_required")
    })
    const provider = createAccessTokenProvider({
      loadCreds: async () => creds,
      loadRefreshToken: async () => "rt",
      refresh,
    })
    await expect(provider.get()).rejects.toMatchObject({ reason: "reconnect_required" })
  })
})
