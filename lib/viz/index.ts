import "server-only"
import type { WidgetSpec } from "@/lib/types"
import type { QueryResult } from "@/lib/query-engine"
import { getAnthropicKey } from "@/lib/settings"
import { ClaudeVizModel } from "@/lib/viz/claude"
import { detectSpec } from "@/lib/widget-detector"

/**
 * Pick a WidgetSpec for a query result — the Claude agent when a key is
 * configured, otherwise the deterministic heuristic. Also the fallback path
 * whenever the agent errors, times out, or returns something unusable.
 */
export async function resolveSpec(
  query: QueryResult,
  userQuery: string,
  priorSpec?: WidgetSpec
): Promise<{ spec: WidgetSpec; usedAgent: boolean }> {
  const key = await getAnthropicKey()
  if (key) {
    const spec = await new ClaudeVizModel(key).proposeSpec({
      userQuery,
      columns: query.columns,
      sampleRows: query.rows.slice(0, 5),
      sql: query.sql,
      priorSpec,
    })
    if (spec) return { spec, usedAgent: true }
  }
  return { spec: detectSpec(query.rows, userQuery), usedAgent: false }
}
