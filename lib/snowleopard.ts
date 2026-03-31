import "server-only"
import { SnowLeopardClient } from "@snowleopard-ai/client"

/**
 * Factory function — creates a SnowLeopardClient per-request using the caller's API key.
 * Never called on the client side because this file imports "server-only".
 */
export function createSnowLeopardClient(apiKey: string): SnowLeopardClient {
  return new SnowLeopardClient({ apiKey })
}
