import "server-only"
import type { DataSource as DataSourceRow } from "@prisma/client"

export interface Column {
  name: string
  type: "number" | "date" | "string"
}

export interface QueryResult {
  rows: Array<Record<string, unknown>>
  columns: Column[]
  sql?: string
  explanation?: string | null
  truncated: boolean
}

/**
 * A source of tabular data for a natural-language question. SnowLeopard is the
 * only implementation today; a direct-SQL or CSV engine could be added without
 * touching the route or the viz agent.
 */
export interface QueryEngine {
  retrieve(userQuery: string, source: DataSourceRow): Promise<QueryResult>
}

/** A user-facing query failure (bad question, no matching data, upstream error). */
export class QueryError extends Error {
  readonly status: number
  constructor(message: string, status = 422) {
    super(message)
    this.name = "QueryError"
    this.status = status
  }
}
