import "server-only"
import type { SchemaData, RetrieveResponse } from "@snowleopard-ai/client"
import type { DataSource as DataSourceRow } from "@prisma/client"
import { decryptSecret } from "@/lib/crypto"
import { createSnowLeopardClient } from "@/lib/snowleopard"
import { isNumeric, isDateLike } from "@/lib/widget-detector"
import { STORE_ROW_CAP } from "@/lib/widget-spec"
import { QueryError, type Column, type QueryEngine, type QueryResult } from "@/lib/query-engine"

function inferColumns(rows: Array<Record<string, unknown>>): Column[] {
  if (rows.length === 0) return []
  return Object.keys(rows[0]).map(name => {
    if (isDateLike(name)) return { name, type: "date" as const }
    const samples = rows.slice(0, 20).map(r => r[name]).filter(v => v != null && v !== "")
    if (samples.length > 0 && samples.every(isNumeric)) return { name, type: "number" as const }
    return { name, type: "string" as const }
  })
}

export const snowLeopardEngine: QueryEngine = {
  async retrieve(userQuery: string, source: DataSourceRow): Promise<QueryResult> {
    const client = createSnowLeopardClient(decryptSecret(source.apiKeyCipher))
    try {
      const result = await client.retrieve({ userQuery, datafileId: source.datafileId })

      if (result.__type__ === "apiError") {
        throw new QueryError(result.description)
      }

      const rr = result as RetrieveResponse
      if (rr.responseStatus !== "SUCCESS") {
        throw new QueryError(`Query failed: ${rr.responseStatus}`)
      }

      const schemaEntry = rr.data.find((d): d is SchemaData => d.__type__ === "schemaData")
      if (!schemaEntry) {
        const first = rr.data[0]
        throw new QueryError(
          first && first.__type__ === "errorSchemaData" ? first.error : "No data returned"
        )
      }

      const all = Array.isArray(schemaEntry.rows) ? schemaEntry.rows : []
      const rows = all.slice(0, STORE_ROW_CAP)

      return {
        rows,
        columns: inferColumns(rows),
        sql: schemaEntry.query ?? undefined,
        explanation: schemaEntry.querySummary?.non_technical_explanation ?? null,
        truncated: all.length > rows.length,
      }
    } finally {
      await client.close()
    }
  },
}
