import "server-only"
import { SnowLeopardClient } from "@snowleopard-ai/client"
import type { RetrieveResponse } from "@snowleopard-ai/client"

/**
 * Factory — creates a SnowLeopardClient per request using the caller's API key.
 * Never runs on the client because this file imports "server-only".
 */
export function createSnowLeopardClient(apiKey: string): SnowLeopardClient {
  return new SnowLeopardClient({ apiKey })
}

/**
 * Check that an API key + datafile id actually work, by running a trivial query.
 * Returns `{ ok: true }` or `{ ok: false, error }`.
 */
export async function verifyConnection(
  apiKey: string,
  datafileId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = createSnowLeopardClient(apiKey)
  try {
    const result = await client.retrieve({
      userQuery: "What tables are available?",
      datafileId,
    })

    if (result.__type__ === "apiError") {
      return { ok: false, error: result.description }
    }

    const { responseStatus } = result as RetrieveResponse
    if (responseStatus !== "SUCCESS" && responseStatus !== "NOT_FOUND_IN_SCHEMA") {
      return { ok: false, error: `Connection returned status: ${responseStatus}` }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Connection failed",
    }
  } finally {
    await client.close()
  }
}
