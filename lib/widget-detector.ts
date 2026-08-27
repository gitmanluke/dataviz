import { parseChartIntent, isChartType } from "@/lib/widget-data"
import type { WidgetType, WidgetSpec } from "@/lib/types"

export type { WidgetType }

const DATE_PATTERNS = /date|time|month|year|day|week|period|quarter/i

// Columns that are identifiers, not measures — excluded from chart detection
// (they still appear in the table view).
const ID_PATTERNS = /^(id|.*_id|uuid|guid|.*_uuid|pk|fk|key|.*_key|index|rownum)$/i

// Query wording that asks for a parts-of-a-whole view.
const PIE_INTENT = /percent|percentage|proportion|share|breakdown|composition|split|distribution|make.?up|ratio/i

export function isNumeric(value: unknown): boolean {
  return (
    typeof value === "number" ||
    (typeof value === "string" && value.trim() !== "" && !isNaN(Number(value)))
  )
}

export function isDateLike(key: string): boolean {
  return DATE_PATTERNS.test(key)
}

export function isIdLike(key: string): boolean {
  return ID_PATTERNS.test(key)
}

const NONE: WidgetSpec["sort"] = "none"

/**
 * Deterministic heuristic that picks a widget type + column mapping from the
 * query and the shape of the returned rows. Used as the fallback when the viz
 * agent is unavailable. Column names in the returned spec are the real ones.
 */
export function detectSpec(rawData: unknown, userQuery: string): WidgetSpec {
  const title = generateTitle(userQuery)

  // Not an array (scalar / empty) → a single-number stat or an empty table.
  if (!Array.isArray(rawData) || rawData.length === 0) {
    const obj =
      rawData && typeof rawData === "object" && !Array.isArray(rawData)
        ? (rawData as Record<string, unknown>)
        : null
    if (obj && "value" in obj) {
      return { type: "stat", title, xKey: "", series: ["value"], sort: NONE }
    }
    return { type: "table", title, xKey: "", series: [], sort: NONE }
  }

  const rows = rawData as Record<string, unknown>[]
  const keys = Object.keys(rows[0])

  const chartKeys = keys.filter(k => !isIdLike(k))
  const dateKeys = chartKeys.filter(isDateLike)
  // Measures = numeric, non-date columns (a "year" column is an axis, not a value).
  const measureKeys = chartKeys.filter(k => isNumeric(rows[0][k]) && !isDateLike(k))
  const categoryKeys = chartKeys.filter(k => !isNumeric(rows[0][k]) && !isDateLike(k))

  const wantsPie = PIE_INTENT.test(userQuery)
  const intent = parseChartIntent(userQuery)
  const xKey = dateKeys[0] ?? categoryKeys[0] ?? keys[0]
  const isTimeAxis = dateKeys.length >= 1
  const chartable = Boolean(dateKeys[0] ?? categoryKeys[0]) && measureKeys.length >= 1

  // Explicit "table", or an explicit chart we can't build.
  if (intent === "table" || (intent && intent !== "stat" && !chartable)) {
    return { type: "table", title, xKey, series: measureKeys, sort: NONE }
  }

  // Explicit "single number".
  if (intent === "stat" && measureKeys.length >= 1) {
    return { type: "stat", title, xKey: "", series: [measureKeys[0]], sort: NONE }
  }

  if (chartable) {
    const axis = dateKeys[0] ?? categoryKeys[0]

    if (intent && isChartType(intent)) {
      const series = intent === "pie-chart" ? measureKeys.slice(0, 1) : measureKeys
      return { type: intent, title, xKey: axis, series, sort: NONE }
    }

    if (measureKeys.length === 1) {
      const type: WidgetType = isTimeAxis
        ? "line-chart"
        : wantsPie && rows.length <= 8
          ? "pie-chart"
          : "bar-chart"
      return { type, title, xKey: axis, series: measureKeys, sort: NONE }
    }

    // Several measures.
    return {
      type: isTimeAxis ? "line-chart" : "bar-chart",
      title,
      xKey: axis,
      series: measureKeys,
      sort: NONE,
    }
  }

  // Nothing chartable → table.
  return { type: "table", title, xKey, series: measureKeys, sort: NONE }
}

function generateTitle(userQuery: string): string {
  const cleaned = userQuery
    .trim()
    .replace(/^show me |^give me |^create |^display /i, "")
  const titled = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  return titled.length > 40 ? titled.slice(0, 40) + "…" : titled
}
