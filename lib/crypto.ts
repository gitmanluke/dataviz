import "server-only"
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

// AES-256-GCM encryption for secrets (data-source API keys) stored at rest in
// the local SQLite DB. The key comes from DATA_SOURCE_ENCRYPTION_KEY — 32 bytes,
// base64-encoded. Payload format: base64(iv).base64(authTag).base64(ciphertext)

const ALGORITHM = "aes-256-gcm"
const IV_BYTES = 12

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey

  const raw = process.env.DATA_SOURCE_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      "DATA_SOURCE_ENCRYPTION_KEY is not set. Generate one with: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    )
  }

  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) {
    throw new Error(
      `DATA_SOURCE_ENCRYPTION_KEY must be 32 bytes base64-encoded, got ${key.length}`
    )
  }

  cachedKey = key
  return key
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(".")
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".")
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted payload")
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8")
}
