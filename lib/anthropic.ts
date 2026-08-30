import "server-only"
import Anthropic from "@anthropic-ai/sdk"

export const VIZ_MODEL = "claude-haiku-4-5"

export interface AnthropicUsage {
  model: string
  inputTokens: number
  outputTokens: number
}

// Opt-in token accounting. Inert unless a listener is registered (the benchmark
// does); every non-streaming messages.create reports its usage here.
let usageListener: ((u: AnthropicUsage) => void) | null = null
export function onAnthropicUsage(fn: ((u: AnthropicUsage) => void) | null): void {
  usageListener = fn
}

export function createAnthropic(apiKey: string): Anthropic {
  const client = new Anthropic({ apiKey })
  if (!usageListener) return client

  const listener = usageListener
  const create = client.messages.create.bind(client.messages)
  client.messages.create = (async (body: Anthropic.MessageCreateParams, options?: unknown) => {
    const res = await create(body as Anthropic.MessageCreateParamsNonStreaming, options as never)
    const usage = (res as Anthropic.Message).usage
    if (usage) {
      listener({
        model: body.model,
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
      })
    }
    return res
  }) as typeof client.messages.create

  return client
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
