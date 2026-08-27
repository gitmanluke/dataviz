import "server-only"
import Anthropic from "@anthropic-ai/sdk"

export const VIZ_MODEL = "claude-haiku-4-5"

export function createAnthropic(apiKey: string): Anthropic {
  return new Anthropic({ apiKey })
}

/** Cheap round-trip to confirm a key works before we store it. */
export async function verifyAnthropicKey(
  apiKey: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const client = new Anthropic({ apiKey })
    await client.messages.create(
      { model: VIZ_MODEL, max_tokens: 1, messages: [{ role: "user", content: "hi" }] },
      { timeout: 10_000 }
    )
    return { ok: true }
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "Invalid API key." }
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "Rate limited — try again in a moment." }
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not reach the Anthropic API.",
    }
  }
}
