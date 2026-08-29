import "server-only"
import type Database from "better-sqlite3"
import { QueryError, type QueryEngine, type QueryResult } from "@/lib/query-engine"
import { STORE_ROW_CAP } from "@/lib/widget-spec"
import { getAnthropicKey } from "@/lib/settings"
import { inferColumns } from "@/lib/engines/columns"
import { openReadonly, sourceDbExists } from "@/lib/engines/sql/store"
import { validateSql } from "@/lib/engines/sql/validator"
import { nlToSql } from "@/lib/engines/sql/nl-to-sql"

function readSchema(db: Database.Database): Record<string, string[]> {
  const names = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map(r => (r as { name: string }).name)

  const schema: Record<string, string[]> = {}
  for (const name of names) {
    const q = `"${name.replace(/"/g, '""')}"`
    schema[name] = db.prepare(`SELECT * FROM ${q} LIMIT 0`).columns().map(c => c.name)
  }
  return schema
}

export const sqlEngine: QueryEngine = {
  async retrieve(userQuery, source): Promise<QueryResult> {
    if (!sourceDbExists(source.id)) {
      throw new QueryError("This data source has no data yet.", 400)
    }

    const apiKey = await getAnthropicKey()
    if (!apiKey) {
      throw new QueryError(
        "Add an Anthropic API key in Settings to ask questions of uploaded data.",
        400,
      )
    }

    const db = openReadonly(source.id)
    try {
      const schema = readSchema(db)

      let gen = await nlToSql(apiKey, schema, userQuery)
      if (!gen) throw new QueryError("Couldn't turn that into a query for this data.")

      let check = validateSql(gen.sql, db)
      if (!check.ok) {
        const retry = await nlToSql(apiKey, schema, userQuery, {
          sql: gen.sql,
          reason: check.reason,
        })
        if (retry) gen = retry
        check = validateSql(gen.sql, db)
        if (!check.ok) {
          throw new QueryError(`The generated query was invalid: ${check.reason}`)
        }
      }

      const all = db.prepare(gen.sql).all() as Array<Record<string, unknown>>
      const rows = all.slice(0, STORE_ROW_CAP)
      return {
        rows,
        columns: inferColumns(rows),
        sql: gen.sql,
        explanation: gen.summary || null,
        truncated: all.length > rows.length,
      }
    } finally {
      db.close()
    }
  },
}
