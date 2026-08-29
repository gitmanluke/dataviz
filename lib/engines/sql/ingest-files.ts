import "server-only"
import { openWritable } from "@/lib/engines/sql/store"
import {
  createTable,
  isSqliteBuffer,
  rowsFromCsv,
  safeTableName,
  tablesFromSqlite,
} from "@/lib/engines/sql/ingest"

export interface TableInfo {
  name: string
  rowCount: number
  columns: string[]
}

const CSV_EXT = /\.csv$/i
const DB_EXT = /\.(db|sqlite|sqlite3)$/i

function tableNameFromFile(filename: string): string {
  return safeTableName(filename.replace(/\.[^.]+$/, ""))
}

/** Ingest uploaded files into the source's SQLite DB. Throws on a bad file. */
export async function ingestFiles(
  sourceId: string,
  files: File[],
): Promise<TableInfo[]> {
  const db = openWritable(sourceId)
  const created: TableInfo[] = []
  try {
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())

      if (CSV_EXT.test(file.name)) {
        const { columns, rows } = rowsFromCsv(buffer)
        if (columns.length === 0) throw new Error(`${file.name}: no header row`)
        const name = tableNameFromFile(file.name)
        createTable(db, name, columns, rows)
        created.push({ name, rowCount: rows.length, columns })
      } else if (DB_EXT.test(file.name) || isSqliteBuffer(buffer)) {
        if (!isSqliteBuffer(buffer)) throw new Error(`${file.name}: not a SQLite database`)
        for (const t of tablesFromSqlite(buffer)) {
          createTable(db, t.name, t.columns, t.rows)
          created.push({ name: t.name, rowCount: t.rows.length, columns: t.columns })
        }
      } else {
        throw new Error(`${file.name}: unsupported file type (use .csv or .db)`)
      }
    }
  } finally {
    db.close()
  }
  return created
}
