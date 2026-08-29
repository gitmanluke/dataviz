import "server-only"
import type { SchemaData, RetrieveResponse } from "@snowleopard-ai/client"
import type { DataSource as DataSourceRow } from "@prisma/client"
import { decryptSecret } from "@/lib/crypto"
import { createSnowLeopardClient } from "@/lib/snowleopard"
import { STORE_ROW_CAP } from "@/lib/widget-spec"
import { QueryError, type QueryEngine, type QueryResult } from "@/lib/query-engine"
import { inferColumns } from "@/lib/engines/columns"

export const snowLeopardEngine: QueryEngine = {
  async retrieve(userQuery: string, source: DataSourceRow): Promise<QueryResult> {
    if (!source.apiKeyCipher || !source.datafileId) {
      throw new QueryError("This SnowLeopard data source is misconfigured.", 400)
    }
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
