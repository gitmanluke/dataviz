import "server-only"
import { prisma } from "@/lib/db"
import { encryptSecret, decryptSecret } from "@/lib/crypto"

const ANTHROPIC_KEY = "anthropic_api_key"

/**
 * The Anthropic API key that powers the viz agent. Prefers the encrypted value
 * stored via /settings; falls back to the ANTHROPIC_API_KEY env var (dev/CI).
 */
export async function getAnthropicKey(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: ANTHROPIC_KEY } })
  if (row) {
    try {
      return decryptSecret(row.value)
    } catch {
      return null
    }
  }
  return process.env.ANTHROPIC_API_KEY?.trim() || null
}

export async function isAnthropicKeyConfigured(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: ANTHROPIC_KEY } })
  return Boolean(row) || Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

export async function setAnthropicKey(apiKey: string): Promise<void> {
  const value = encryptSecret(apiKey)
  await prisma.setting.upsert({
    where: { key: ANTHROPIC_KEY },
    create: { key: ANTHROPIC_KEY, value },
    update: { value },
  })
}

export async function clearAnthropicKey(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: ANTHROPIC_KEY } })
}
