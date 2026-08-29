import "server-only"
import type { DataSource as DataSourceRow } from "@prisma/client"
import { prisma } from "@/lib/db"
import { runSql } from "@/lib/engines/sql"
import { QueryError } from "@/lib/query-engine"
import { GoogleAuthError } from "./errors"
import { fetchDriveFile, syncSheet } from "./sheets"
import { isRefreshInterval, type RefreshInterval } from "./intervals"

const HOUR = 3_600_000
const DAY = 24 * HOUR
const ON_OPEN_MIN_GAP = 30_000

/** Is a sheets source due for a re-check? (The actual re-pull is still gated by
 *  a Drive modifiedTime comparison in `resyncSource`.) */
export function isDue(
  lastSyncedAt: Date | null,
  interval: string,
  now: Date = new Date(),
): boolean {
  if (!isRefreshInterval(interval) || interval === "manual") return false
  if (!lastSyncedAt) return true
  const age = now.getTime() - lastSyncedAt.getTime()
  const thresholds: Record<Exclude<RefreshInterval, "manual">, number> = {
    "on-open": ON_OPEN_MIN_GAP,
    hourly: HOUR,
    daily: DAY,
    weekly: 7 * DAY,
    monthly: 30 * DAY,
  }
  return age >= thresholds[interval]
}

const inflight = new Set<string>()

/** Re-pull a sheets source if its Drive modifiedTime advanced, then re-run every
 *  widget bound to it. Never throws — failures land in status / syncError. */
export async function resyncSource(source: DataSourceRow): Promise<void> {
  if (source.type !== "sheets" || !source.sheetId) return
  if (inflight.has(source.id)) return
  inflight.add(source.id)
  try {
    let file
    try {
      file = await fetchDriveFile(source.sheetId)
    } catch (error) {
      if (error instanceof GoogleAuthError) {
        await mark(source.id, error.message)
        return
      }
      throw error
    }

    const unchanged =
      source.sheetModifiedAt != null &&
      new Date(file.modifiedTime).getTime() <= source.sheetModifiedAt.getTime()

    if (unchanged) {
      await prisma.dataSource.update({
        where: { id: source.id },
        data: { lastSyncedAt: new Date(), status: "connected", syncError: null },
      })
      return
    }

    await syncSheet(source.id, source.sheetId)
    await prisma.dataSource.update({
      where: { id: source.id },
      data: {
        sheetModifiedAt: new Date(file.modifiedTime),
        lastSyncedAt: new Date(),
        status: "connected",
        syncError: null,
      },
    })
    await rerunWidgets(source.id)
  } catch (error) {
    await mark(source.id, error instanceof Error ? error.message : "Sync failed")
  } finally {
    inflight.delete(source.id)
  }
}

async function rerunWidgets(sourceId: string): Promise<void> {
  const widgets = await prisma.widget.findMany({
    where: { dataSourceId: sourceId, NOT: { query: null } },
    include: { dataSource: true },
  })
  for (const widget of widgets) {
    if (!widget.query || !widget.dataSource) continue
    try {
      const result = await runSql(widget.query, widget.dataSource)
      await prisma.widget.update({
        where: { id: widget.id },
        data: { data: JSON.stringify(result.rows) },
      })
    } catch (error) {
      if (!(error instanceof QueryError)) throw error
      // widget's table/columns changed — keep its old data, skip
    }
  }
}

async function mark(id: string, syncError: string): Promise<void> {
  await prisma.dataSource
    .update({ where: { id }, data: { status: "error", syncError } })
    .catch(() => {})
}

let sweep: Promise<void> | null = null

/** Re-sync every sheets source whose interval is due. Coalesces concurrent
 *  callers; with `timeoutMs` the caller stops waiting but the sweep continues. */
export async function syncDueSheets(
  opts: { dashboardId?: string; timeoutMs?: number } = {},
): Promise<void> {
  if (!sweep) {
    sweep = runSweep(opts.dashboardId).finally(() => {
      sweep = null
    })
  }
  if (opts.timeoutMs) {
    await Promise.race([
      sweep,
      new Promise<void>(resolve => setTimeout(resolve, opts.timeoutMs)),
    ])
  } else {
    await sweep
  }
}

async function runSweep(dashboardId?: string): Promise<void> {
  const sources = await prisma.dataSource.findMany({ where: { type: "sheets" } })
  const now = new Date()
  for (const source of sources) {
    if (!isDue(source.lastSyncedAt, source.refreshInterval, now)) continue
    if (dashboardId) {
      const bound = await prisma.widget.count({
        where: { dashboardId, dataSourceId: source.id },
      })
      if (bound === 0) continue
    }
    await resyncSource(source)
  }
}
