import type { WidgetSpec, WidgetType } from "@/lib/types"
import { inferXKey, inferSeries } from "@/lib/widget-data"

export interface ChartView {
  rows: Array<Record<string, unknown>>
  xKey: string
  series: string[]
}

// How many rows each widget type shows. Bigger sets are stored but not rendered.
const RENDER_CAP: Record<WidgetType, number> = {
  "stat": 1,
  "table": 200,
  "line-chart": 120,
  "bar-chart": 12,
  "pie-chart": 12,
}

/** Storage cap — never persist more than this many rows on one widget. */
export const STORE_ROW_CAP = 200

function toRows(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) {
    return raw.filter((r): r is Record<string, unknown> => r != null && typeof r === "object")
  }
  if (raw != null && typeof raw === "object") {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.rows)) return toRows(obj.rows) // legacy ChartData
    return [obj] // scalar stat { value, ... }
  }
  return []
}

/**
 * Turn a widget's raw rows + spec into what the renderer needs: the rows to
 * draw (sorted, capped), the x-axis key, and the series keys. Repairs a spec
 * whose columns don't match the data.
 */
export function applySpec(rawData: unknown, spec: WidgetSpec): ChartView {
  let rows = toRows(rawData)
  const cols = rows[0] ? Object.keys(rows[0]) : []

  const xKey = spec.xKey && cols.includes(spec.xKey) ? spec.xKey : inferXKey(rows)
  let series = (spec.series ?? []).filter(s => cols.includes(s))
  if (series.length === 0) series = inferSeries(rows, xKey)

  const sortKey = series[0]
  if (spec.sort && spec.sort !== "none" && sortKey) {
    const dir = spec.sort === "asc" ? 1 : -1
    rows = [...rows].sort((a, b) => dir * (Number(a[sortKey]) - Number(b[sortKey])))
  }

  rows = rows.slice(0, RENDER_CAP[spec.type] ?? 12)
  return { rows, xKey, series }
}
