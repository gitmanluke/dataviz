// Shared, pure helpers for the chart data contract between the widget detector
// and WidgetCard. Charts store their data as { rows, xKey, series } so the
// renderer never has to guess which column is the axis and which are values.

export interface ChartData {
  rows: Array<Record<string, unknown>>
  xKey: string
  series: string[]
}

function isRecordArray(v: unknown): v is Array<Record<string, unknown>> {
  return Array.isArray(v) && v.every(r => r != null && typeof r === "object")
}

function looksNumeric(v: unknown): boolean {
  return (
    typeof v === "number" ||
    (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)))
  )
}

const ID_KEY = /^(id|.*_id|uuid|guid|pk|fk|key|.*_key|index|rownum)$/i

/**
 * Coerce whatever is stored on a chart widget into { rows, xKey, series }.
 * Accepts the current shape, a bare `{name, value}[]` array (legacy / manual
 * widgets), or a bare `{category, a, b}[]` array, and always returns something
 * renderable.
 */
export function normalizeChartData(raw: unknown): ChartData {
  // Already in the target shape.
  if (
    raw != null &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    isRecordArray((raw as ChartData).rows)
  ) {
    const c = raw as ChartData
    const rows = c.rows
    const xKey = c.xKey && rows[0] && xExists(rows[0], c.xKey) ? c.xKey : inferXKey(rows)
    const series =
      Array.isArray(c.series) && c.series.length > 0
        ? c.series
        : inferSeries(rows, xKey)
    return { rows, xKey, series }
  }

  // Bare array.
  if (isRecordArray(raw)) {
    const rows = raw
    const xKey = inferXKey(rows)
    return { rows, xKey, series: inferSeries(rows, xKey) }
  }

  return { rows: [], xKey: "name", series: ["value"] }
}

function xExists(row: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(row, key)
}

function inferXKey(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "name"
  const keys = Object.keys(rows[0])
  if (keys.includes("name")) return "name"
  // First non-numeric column, else the first column.
  return keys.find(k => !looksNumeric(rows[0][k])) ?? keys[0] ?? "name"
}

function inferSeries(rows: Array<Record<string, unknown>>, xKey: string): string[] {
  if (rows.length === 0) return ["value"]
  const numeric = Object.keys(rows[0]).filter(
    k => k !== xKey && !ID_KEY.test(k) && looksNumeric(rows[0][k])
  )
  return numeric.length > 0 ? numeric : ["value"]
}

/** Human label for a column key: snake/camel case → "Title Case". */
export function seriesLabel(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}
