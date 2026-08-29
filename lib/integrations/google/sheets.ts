import "server-only"
import { createTable, safeTableName } from "@/lib/engines/sql/ingest"
import { openWritable } from "@/lib/engines/sql/store"
import { GoogleApiError } from "./errors"
import { driveGet, sheetsGet } from "./rest"

export const SHEET_ROW_CAP = 50_000
const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet"

interface TabProps {
  title?: string
  sheetId?: number
  sheetType?: string
}
interface SheetMeta {
  properties?: { title?: string }
  sheets?: Array<{ properties?: TabProps }>
}
interface BatchGetResponse {
  valueRanges?: Array<{ range?: string; values?: unknown[][] }>
}

export interface DriveFile {
  modifiedTime: string
  name: string
  mimeType: string
  trashed: boolean
}

export interface ParsedTable {
  name: string
  columns: string[]
  rows: unknown[][]
  truncated: boolean
}

export interface SyncResult {
  title: string
  tables: Array<{ name: string; rowCount: number }>
  truncated: boolean
}

// --- Drive metadata ---------------------------------------------------

/** `modifiedTime` (+ validation fields) for a spreadsheet. Used for the create
 *  check and the opportunistic-sync short-circuit. */
export async function fetchDriveFile(spreadsheetId: string): Promise<DriveFile> {
  const file = (await driveGet(`/files/${encodeURIComponent(spreadsheetId)}`, {
    fields: "modifiedTime,name,mimeType,trashed",
    supportsAllDrives: "true",
  })) as Partial<DriveFile>
  return {
    modifiedTime: file.modifiedTime ?? new Date(0).toISOString(),
    name: file.name ?? "Untitled",
    mimeType: file.mimeType ?? "",
    trashed: Boolean(file.trashed),
  }
}

export function assertSpreadsheet(file: DriveFile): void {
  if (file.mimeType && file.mimeType !== SPREADSHEET_MIME) {
    throw new GoogleApiError(400, "That Drive file isn't a Google Sheet.")
  }
  if (file.trashed) {
    throw new GoogleApiError(404, "That spreadsheet is in the trash.")
  }
}

// --- parse (pure) ---------------------------------------------------

/** Drop control chars, collapse whitespace, trim. */
function scrub(value: string): string {
  let out = ""
  for (const ch of value) if (ch.charCodeAt(0) >= 32) out += ch
  return out.replace(/\s+/g, " ").trim()
}

function dedupeHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>()
  return raw.map((h, i) => {
    const base = scrub(h) || `column_${i + 1}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return n === 0 ? base : `${base}_${n + 1}`
  })
}

/** Spreadsheet metadata + per-tab value grids -> tables ready for `createTable`.
 *  Skips non-GRID tabs and empty tabs; first row is the header. */
export function parseSpreadsheet(
  meta: SheetMeta,
  valuesByTitle: Map<string, unknown[][]>,
): ParsedTable[] {
  const tabs = (meta.sheets ?? [])
    .map(s => s.properties)
    .filter((p): p is TabProps & { title: string } => Boolean(p?.title))
    .filter(p => (p.sheetType ?? "GRID") === "GRID")

  const used = new Set<string>()
  const tables: ParsedTable[] = []

  for (const tab of tabs) {
    const grid = valuesByTitle.get(tab.title) ?? []
    if (grid.length === 0) continue

    const rawHeaders = (grid[0] ?? []).map(v => String(v ?? "").trim())
    const width = rawHeaders.length
    if (width === 0) continue
    const columns = dedupeHeaders(rawHeaders)

    const body = grid
      .slice(1)
      .map(row => {
        const cells: unknown[] = []
        for (let i = 0; i < width; i++) {
          const cell = row[i]
          cells.push(cell === "" || cell == null ? null : cell)
        }
        return cells
      })
      .filter(cells => cells.some(c => c !== null))

    const rows = body.slice(0, SHEET_ROW_CAP)

    let name = safeTableName(tab.title)
    if (used.has(name.toLowerCase())) {
      let k = 2
      while (used.has(`${name}_${k}`.toLowerCase())) k++
      name = `${name}_${k}`
    }
    used.add(name.toLowerCase())

    tables.push({ name, columns, rows, truncated: body.length > rows.length })
  }

  return tables
}

// --- sync ----------------------------------------------------------

/** Pull every GRID tab into the source's SQLite DB, one table per tab. The DB
 *  mirrors the sheet — tables for removed/renamed tabs are dropped. */
export async function syncSheet(
  sourceId: string,
  spreadsheetId: string,
): Promise<SyncResult> {
  const id = encodeURIComponent(spreadsheetId)

  const meta = (await sheetsGet(`/spreadsheets/${id}`, {
    fields: "properties.title,sheets(properties(title,sheetId,sheetType))",
  })) as SheetMeta

  const gridTitles = (meta.sheets ?? [])
    .map(s => s.properties)
    .filter((p): p is TabProps & { title: string } => Boolean(p?.title))
    .filter(p => (p.sheetType ?? "GRID") === "GRID")
    .map(p => p.title)

  const valuesByTitle = new Map<string, unknown[][]>()
  if (gridTitles.length > 0) {
    const batch = (await sheetsGet(`/spreadsheets/${id}/values:batchGet`, {
      ranges: gridTitles.map(t => `'${t.replace(/'/g, "''")}'`),
      majorDimension: "ROWS",
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    })) as BatchGetResponse
    const ranges = batch.valueRanges ?? []
    gridTitles.forEach((title, i) => valuesByTitle.set(title, ranges[i]?.values ?? []))
  }

  const parsed = parseSpreadsheet(meta, valuesByTitle)

  const db = openWritable(sourceId)
  try {
    const keep = new Set(parsed.map(t => t.name))
    const existing = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map(r => (r as { name: string }).name)
    for (const name of existing) {
      if (!keep.has(name)) db.exec(`DROP TABLE "${name.replace(/"/g, '""')}"`)
    }
    for (const t of parsed) createTable(db, t.name, t.columns, t.rows)
  } finally {
    db.close()
  }

  return {
    title: meta.properties?.title ?? "Untitled",
    tables: parsed.map(t => ({ name: t.name, rowCount: t.rows.length })),
    truncated: parsed.some(t => t.truncated),
  }
}
