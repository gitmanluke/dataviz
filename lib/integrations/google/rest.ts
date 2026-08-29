import "server-only"
import { GoogleApiError } from "./errors"
import { getAccessToken } from "./auth"

const SHEETS_BASE = "https://sheets.googleapis.com/v4"
const DRIVE_BASE = "https://www.googleapis.com/drive/v3"

type Params = Record<string, string | string[]>

async function googleGet(base: string, path: string, params: Params): Promise<unknown> {
  const token = await getAccessToken()
  const url = new URL(base + path)
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) for (const v of value) url.searchParams.append(key, v)
    else url.searchParams.set(key, value)
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  })

  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string }
  }
  if (!res.ok) {
    throw new GoogleApiError(
      res.status,
      body.error?.message ?? `Google API error (${res.status})`,
    )
  }
  return body
}

export function sheetsGet(path: string, params: Params = {}): Promise<unknown> {
  return googleGet(SHEETS_BASE, path, params)
}

export function driveGet(path: string, params: Params = {}): Promise<unknown> {
  return googleGet(DRIVE_BASE, path, params)
}
