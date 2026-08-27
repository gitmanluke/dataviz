import "server-only"
import { SnowLeopardClient, HttpError } from "@snowleopard-ai/client"

/**
 * Factory — creates a SnowLeopardClient per request using the caller's API key.
 * Never runs on the client because this file imports "server-only".
 */
export function createSnowLeopardClient(apiKey: string): SnowLeopardClient {
  return new SnowLeopardClient({ apiKey })
}

/**
 * Check that an API key + datafile id are usable, by running a trivial query.
 *
 * SnowLeopard is a text-to-data service with no schema-introspection endpoint,
 * so "verify" can only confirm that auth works and the datafile is reachable —
 * not that every future question will be answerable. We therefore accept any
 * outcome *except* an authentication / HTTP failure. In particular a
 * "not found in schema" / "can't understand the question" response still means
 * the connection is good.
 */
export async function verifyConnection(
  apiKey: string,
  datafileId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = createSnowLeopardClient(apiKey)
  try {
    const result = await client.retrieve({
      userQuery: "Give me a small sample of the data",
      datafileId,
    })

    if (
      result.__type__ === "apiError" &&
      result.responseStatus === "AUTHORIZATION_FAILED"
    ) {
      return {
        ok: false,
        error: "Authorization failed — check the API key has access to this datafile.",
      }
    }

    // Reached SnowLeopard and it processed the request: connection is valid.
    return { ok: true }
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 401 || error.status === 403) {
        return { ok: false, error: "Invalid API key." }
      }
      if (error.status === 404) {
        return { ok: false, error: "Datafile not found — check the File ID." }
      }
      return { ok: false, error: `SnowLeopard returned HTTP ${error.status}.` }
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Connection failed.",
    }
  } finally {
    await client.close()
  }
}
