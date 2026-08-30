import "server-only"
import { OAuth2Client } from "google-auth-library"
import { prisma } from "@/lib/db"
import { encryptSecret, decryptSecret } from "@/lib/crypto"
import { GoogleAuthError } from "./errors"
import {
  createAccessTokenProvider,
  type AccessToken,
  type OAuthCreds,
} from "./token"

const CLIENT_ID = "google_oauth_client_id"
const CLIENT_SECRET = "google_oauth_client_secret"
const API_KEY = "google_api_key"
const TOKEN = "google_oauth_token"

// --- credentials (client id / secret / API key) --------------------------

export interface GoogleCredentials extends OAuthCreds {
  apiKey: string
}

async function readSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } })
  return row?.value ?? null
}

async function writeSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

export async function getCredentials(): Promise<GoogleCredentials | null> {
  const [clientId, secretCipher, keyCipher] = await Promise.all([
    readSetting(CLIENT_ID),
    readSetting(CLIENT_SECRET),
    readSetting(API_KEY),
  ])
  if (!clientId || !secretCipher || !keyCipher) return null
  try {
    return {
      clientId,
      clientSecret: decryptSecret(secretCipher),
      apiKey: decryptSecret(keyCipher),
    }
  } catch {
    return null
  }
}

export async function setCredentials(input: {
  clientId: string
  clientSecret: string
  apiKey: string
}): Promise<void> {
  await Promise.all([
    writeSetting(CLIENT_ID, input.clientId.trim()),
    writeSetting(CLIENT_SECRET, encryptSecret(input.clientSecret.trim())),
    writeSetting(API_KEY, encryptSecret(input.apiKey.trim())),
  ])
  provider.reset()
}

export async function clearCredentials(): Promise<void> {
  await prisma.setting.deleteMany({
    where: { key: { in: [CLIENT_ID, CLIENT_SECRET, API_KEY, TOKEN] } },
  })
  provider.reset()
}

// --- stored refresh token ----------------------------------------------

interface StoredToken {
  refreshToken: string
  scope: string
  obtainedAt: string
}

async function getStoredToken(): Promise<StoredToken | null> {
  const cipher = await readSetting(TOKEN)
  if (!cipher) return null
  try {
    return JSON.parse(decryptSecret(cipher)) as StoredToken
  } catch {
    return null
  }
}

export async function storeTokens(tokens: {
  refresh_token?: string | null
  scope?: string | null
}): Promise<void> {
  if (!tokens.refresh_token) {
    throw new GoogleAuthError(
      "Google didn't return a refresh token. Remove the app's access at myaccount.google.com and reconnect.",
      "reconnect_required",
    )
  }
  const value = encryptSecret(
    JSON.stringify({
      refreshToken: tokens.refresh_token,
      scope: tokens.scope ?? "",
      obtainedAt: new Date().toISOString(),
    } satisfies StoredToken),
  )
  await writeSetting(TOKEN, value)
  provider.reset()
}

export async function disconnect(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: TOKEN } })
  provider.reset()
}

// --- access token cache ------------------------------------------------

const provider = createAccessTokenProvider({
  loadCreds: getCredentials,
  loadRefreshToken: async () => (await getStoredToken())?.refreshToken ?? null,
})

async function getToken(): Promise<AccessToken> {
  return provider.get()
}

export async function getAccessToken(): Promise<string> {
  return (await getToken()).token
}

// --- OAuth client + status -------------------------------------------

export async function getOAuthClient(redirectUri?: string): Promise<OAuth2Client> {
  const creds = await getCredentials()
  if (!creds) {
    throw new GoogleAuthError(
      "Add Google credentials in Settings first.",
      "not_configured",
    )
  }
  return new OAuth2Client({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    redirectUri,
  })
}

export async function isConnected(): Promise<boolean> {
  return (await getStoredToken()) !== null
}

export interface ConnectionStatus {
  credentialsConfigured: boolean
  connected: boolean
  needsReconnect: boolean
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const creds = await getCredentials()
  if (!creds) {
    return { credentialsConfigured: false, connected: false, needsReconnect: false }
  }
  if (!(await getStoredToken())) {
    return { credentialsConfigured: true, connected: false, needsReconnect: false }
  }
  try {
    await getToken()
    return { credentialsConfigured: true, connected: true, needsReconnect: false }
  } catch (error) {
    if (error instanceof GoogleAuthError && error.reason === "reconnect_required") {
      return { credentialsConfigured: true, connected: false, needsReconnect: true }
    }
    throw error
  }
}

export interface PickerConfig {
  accessToken: string
  apiKey: string
  appId: string
  expiresAt: number
}

/** The Cloud project number — the numeric prefix of an OAuth client id
 *  (`<projectNumber>-xxxx.apps.googleusercontent.com`). The Picker needs it as
 *  the "app id" so that files picked under the drive.file scope become readable
 *  by our token. */
function appIdFromClientId(clientId: string): string {
  return clientId.split("-")[0] ?? ""
}

export async function getPickerConfig(): Promise<PickerConfig | null> {
  const creds = await getCredentials()
  if (!creds) return null
  try {
    const { token, expiresAt } = await getToken()
    return {
      accessToken: token,
      apiKey: creds.apiKey,
      appId: appIdFromClientId(creds.clientId),
      expiresAt,
    }
  } catch {
    return null
  }
}
