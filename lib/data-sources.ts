import "server-only"
import type { DataSource as DataSourceRow } from "@prisma/client"
import type { DataSource } from "@/lib/types"

/** DB row → client-safe DataSource (drops apiKeyCipher). */
export function dataSourceToClient(row: DataSourceRow): DataSource {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    type: row.type,
    datafileId: row.datafileId ?? undefined,
    status: row.status as DataSource["status"],
    createdAt: row.createdAt.toISOString(),
    ...(row.sheetId ? { sheetId: row.sheetId } : {}),
    ...(row.type === "sheets" ? { refreshInterval: row.refreshInterval } : {}),
    ...(row.lastSyncedAt ? { lastSyncedAt: row.lastSyncedAt.toISOString() } : {}),
    ...(row.syncError ? { syncError: row.syncError } : {}),
  }
}
