import "server-only"
import { openReadonly, openWritable, sourceDbExists } from "@/lib/engines/sql/store"
import { inferColumns } from "@/lib/engines/columns"
import type { Column } from "@/lib/query-engine"

export interface TableSummary {
  name: string
  rowCount: number
  columns: Column[]
}

/** One row per table in a files source's SQLite DB (name, row count, inferred
 *  column types). Returns `[]` if the source has no DB yet. */
export function readTables(sourceId: string): TableSummary[] {
  if (!sourceDbExists(sourceId)) return []

  const db = openReadonly(sourceId)
  try {
    const names = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map(r => (r as { name: string }).name)

    return names.map(name => {
      const q = `"${name.replace(/"/g, '""')}"`
      const rowCount = (db.prepare(`SELECT COUNT(*) AS n FROM ${q}`).get() as { n: number }).n
      const sample = db.prepare(`SELECT * FROM ${q} LIMIT 20`).all() as Array<Record<string, unknown>>
      return { name, rowCount, columns: inferColumns(sample) }
    })
  } finally {
    db.close()
  }
}

/** Drop a table by name. Returns false if it doesn't exist. */
export function dropTable(sourceId: string, table: string): boolean {
  if (!sourceDbExists(sourceId)) return false

  const db = openWritable(sourceId)
  try {
    const exists = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?")
      .get(table)
    if (!exists) return false
    db.exec(`DROP TABLE "${table.replace(/"/g, '""')}"`)
    return true
  } finally {
    db.close()
  }
}
