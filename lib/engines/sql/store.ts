import "server-only"
import { existsSync, mkdirSync, rmSync } from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"

const ROOT = path.join(process.cwd(), "data", "sources")

export function sourceDbPath(sourceId: string): string {
  return path.join(ROOT, `${sourceId}.db`)
}

export function sourceDbExists(sourceId: string): boolean {
  return existsSync(sourceDbPath(sourceId))
}

/** Read/write handle — used only during ingestion. */
export function openWritable(sourceId: string): Database.Database {
  mkdirSync(ROOT, { recursive: true })
  return new Database(sourceDbPath(sourceId))
}

/** Read-only handle — used for every query. Writes are refused by the driver. */
export function openReadonly(sourceId: string): Database.Database {
  return new Database(sourceDbPath(sourceId), { readonly: true, fileMustExist: true })
}

export function removeSourceDb(sourceId: string): void {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    rmSync(sourceDbPath(sourceId) + suffix, { force: true })
  }
}
