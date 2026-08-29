import { randomUUID } from "node:crypto"
import { rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import Database from "better-sqlite3"
import Papa from "papaparse"

export type SqliteType = "INTEGER" | "REAL" | "TEXT"

export interface ParsedTable {
  name: string
  columns: string[]
  rows: unknown[][]
}

const IDENT_OK = /^[A-Za-z_][A-Za-z0-9_]*$/
const SQLITE_MAGIC = Buffer.from("SQLite format 3\0", "binary")

/** A safe SQLite table name from an arbitrary label (a file stem, a sheet tab
 *  title). Non-identifier chars collapse to `_`; a leading digit gets a `t_`. */
export function safeTableName(label: string): string {
  const clean = String(label)
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return /^[A-Za-z_]/.test(clean) ? clean : `t_${clean || "table"}`
}

/** Quote an identifier so it can't break out of its position; reject control chars. */
export function safeIdent(name: string): string {
  const s = String(name).trim()
  if (!s || [...s].some(ch => ch.charCodeAt(0) < 32)) {
    throw new Error(`invalid identifier: ${JSON.stringify(name)}`)
  }
  return IDENT_OK.test(s) ? s : `"${s.replace(/"/g, '""')}"`
}

/** Column type for affinity, from up to `sample` non-empty values. */
export function inferType(values: unknown[], sample = 200): SqliteType {
  let sawValue = false
  let sawReal = false
  for (const v of values.slice(0, sample)) {
    if (v == null || (typeof v === "string" && v.trim() === "")) continue
    sawValue = true
    if (typeof v === "boolean") return "INTEGER"
    if (typeof v === "number") {
      if (!Number.isInteger(v)) sawReal = true
      continue
    }
    const s = String(v).trim()
    // Codes that only look numeric (zip codes, long ids) stay text.
    if (/^0\d/.test(s) || s.replace(/[-.]/g, "").length > 15) return "TEXT"
    const n = Number(s)
    if (!Number.isFinite(n)) return "TEXT"
    if (!Number.isInteger(n)) sawReal = true
  }
  if (!sawValue) return "TEXT"
  return sawReal ? "REAL" : "INTEGER"
}

/** Drop + recreate `name` from ingested rows. SQLite affinity coerces the
 *  string values to the declared column type on insert. */
export function createTable(
  db: Database.Database,
  name: string,
  columns: string[],
  rows: unknown[][],
): void {
  if (new Set(columns).size !== columns.length) {
    throw new Error(`duplicate column names in '${name}': ${columns.join(", ")}`)
  }
  const nameQ = safeIdent(name)
  const colsQ = columns.map(safeIdent)
  const types = columns.map((_, i) => inferType(rows.map(r => r[i])))

  db.exec(`DROP TABLE IF EXISTS ${nameQ}`)
  db.exec(`CREATE TABLE ${nameQ} (${colsQ.map((c, i) => `${c} ${types[i]}`).join(", ")})`)

  if (rows.length) {
    const placeholders = columns.map(() => "?").join(", ")
    const insert = db.prepare(
      `INSERT INTO ${nameQ} (${colsQ.join(", ")}) VALUES (${placeholders})`,
    )
    const run = db.transaction((batch: unknown[][]) => {
      for (const row of batch) insert.run(...row.map(v => (v === undefined ? null : v)))
    })
    run(rows)
  }
}

/** { columns, rows } from a CSV buffer. Empty cells become null. */
export function rowsFromCsv(buffer: Buffer): { columns: string[]; rows: unknown[][] } {
  const parsed = Papa.parse<string[]>(buffer.toString("utf8"), { skipEmptyLines: "greedy" })
  const data = parsed.data
  if (data.length === 0) return { columns: [], rows: [] }
  const columns = data[0].map(c => c.trim())
  const rows = data
    .slice(1)
    .map(r => columns.map((_, i) => (r[i] === "" || r[i] == null ? null : r[i])))
  return { columns, rows }
}

/** Every user table from a SQLite file buffer. */
export function tablesFromSqlite(buffer: Buffer): ParsedTable[] {
  const tmp = path.join(tmpdir(), `dv-${randomUUID()}.db`)
  writeFileSync(tmp, buffer)
  const db = new Database(tmp, { readonly: true })
  try {
    const names = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map(r => (r as { name: string }).name)

    return names.map(name => {
      const stmt = db.prepare(`SELECT * FROM ${safeIdent(name)}`)
      const columns = stmt.columns().map(c => c.name)
      const rows = stmt.raw().all() as unknown[][]
      return { name, columns, rows }
    })
  } finally {
    db.close()
    rmSync(tmp, { force: true })
  }
}

/** True if a buffer starts with the SQLite file header. */
export function isSqliteBuffer(buffer: Buffer): boolean {
  return buffer.subarray(0, 16).equals(SQLITE_MAGIC)
}
