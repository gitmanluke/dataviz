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
 * A source of tabular data for a natural-language question. `sqlEngine`
 * (`lib/engines/sql`) is the implementation; the interface keeps the route and
 * the viz agent decoupled from how rows are fetched.
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
