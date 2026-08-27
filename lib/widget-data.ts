// Shared, pure helpers for the chart data contract between the widget detector
// and WidgetCard. Charts store their data as { rows, xKey, series } so the
// renderer never has to guess which column is the axis and which are values.

import type { WidgetType, WidgetSpec } from "@/lib/types"

export interface ChartData {
  rows: Array<Record<string, unknown>>
  xKey: string
  series: string[]
}

const CHART_TYPES: WidgetType[] = ["bar-chart", "line-chart", "pie-chart"]
export const isChartType = (t: WidgetType): boolean => CHART_TYPES.includes(t)

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

export function inferXKey(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "name"
  const keys = Object.keys(rows[0])
  if (keys.includes("name")) return "name"
  // First non-numeric column, else the first column.
  return keys.find(k => !looksNumeric(rows[0][k])) ?? keys[0] ?? "name"
}

export function inferSeries(rows: Array<Record<string, unknown>>, xKey: string): string[] {
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

/** Compact number for axis ticks: 3093 → "3.1k", 1_200_000 → "1.2M". */
export function compactNumber(value: unknown): string {
  const n = Number(value)
  if (!isFinite(n)) return String(value ?? "")
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`
  return String(n)
}

/** Truncate a category-axis label so it doesn't blow out the chart. */
export function truncateLabel(value: unknown, max = 16): string {
  const s = String(value ?? "")
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

// --- Chart type intent -------------------------------------------------------

const INTENT_PATTERNS: Array<[RegExp, WidgetType]> = [
  [/\b(pie|donut|doughnut)\b/i, "pie-chart"],
  [/\bbar[- ]?(chart|graph|plot)\b|\bcolumn[- ]?chart\b|\bas a bar\b/i, "bar-chart"],
  [/\bline[- ]?(chart|graph|plot)\b|\bas a line\b|\bover time\b|\btime series\b|\btrend line\b/i, "line-chart"],
  [/\b(as a |in a |show (it |them )?(as )?a )?table\b|\bspreadsheet\b|\braw (data|rows)\b/i, "table"],
  [/\bsingle (number|value|stat|metric)\b|\bjust (a|the) (number|count|total|value)\b|\bas a (number|metric|kpi|stat)\b|\bbig number\b/i, "stat"],
]

/** Pull an explicit chart type out of a natural-language query, or null. */
export function parseChartIntent(query: string): WidgetType | null {
  for (const [re, type] of INTENT_PATTERNS) {
    if (re.test(query)) return type
  }
  return null
}

/** True when a message reads like "change the last chart", not a new question. */
export function isRefinement(query: string): boolean {
  const words = query.trim().split(/\s+/).length
  return (
    words <= 6 ||
    /\b(instead|actually|rather|change (it|that|this)|make (it|that|this)|show (it|that|this) as|turn (it|that) into|convert (it|that)|as a)\b/i.test(
      query
    )
  )
}

// --- Retyping an existing widget -------------------------------------------

/**
 * Change a widget's type without re-querying — the raw rows are unchanged, only
 * the spec. Pie and stat collapse to a single series.
 */
export function retypeSpec(spec: WidgetSpec, target: WidgetType): WidgetSpec {
  if (spec.type === target) return spec
  if (target === "pie-chart" || target === "stat") {
    return { ...spec, type: target, series: spec.series.slice(0, 1) }
  }
  return { ...spec, type: target }
}
