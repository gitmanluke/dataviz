import type { ChartData } from "@/lib/widget-data"

export type WidgetType = "line-chart" | "bar-chart" | "pie-chart" | "stat" | "table"

export interface DetectedWidget {
  widgetType: WidgetType
  title: string
  // stat: { value, change, trend } · table: Record[] · charts: ChartData
  data: unknown
  confidence: "high" | "medium" | "low"
  sql?: string
}

const DATE_PATTERNS = /date|time|month|year|day|week|period|quarter/i

// Columns that are identifiers, not measures — exclude them from chart detection
// (they still show up in the table view).
const ID_PATTERNS = /^(id|.*_id|uuid|guid|.*_uuid|pk|fk|key|.*_key|index|rownum)$/i

// Query wording that asks for a parts-of-a-whole view.
const PIE_INTENT = /percent|percentage|proportion|share|breakdown|composition|split|distribution|make.?up|ratio/i

function isNumeric(value: unknown): boolean {
  return (
    typeof value === "number" ||
    (typeof value === "string" && value.trim() !== "" && !isNaN(Number(value)))
  )
}

function isDateLike(key: string): boolean {
  return DATE_PATTERNS.test(key)
}

function isIdLike(key: string): boolean {
  return ID_PATTERNS.test(key)
}

// Single-measure chart: collapse to { name, value } rows.
function singleSeries(
  data: Record<string, unknown>[],
  nameKey: string,
  valueKey: string
): ChartData {
  return {
    rows: data.map(row => ({
      name: row[nameKey] as string | number,
      value: Number(row[valueKey]),
    })),
    xKey: "name",
    series: ["value"],
  }
}

// Multi-measure chart: keep the measure columns as separate series.
function multiSeries(
  data: Record<string, unknown>[],
  nameKey: string,
  measureKeys: string[]
): ChartData {
  return {
    rows: data.map(row => ({
      name: row[nameKey] as string | number,
      ...Object.fromEntries(measureKeys.map(k => [k, Number(row[k])])),
    })),
    xKey: "name",
    series: measureKeys,
  }
}

export function detectWidget(
  rawData: unknown,
  userQuery: string,
  sql?: string
): DetectedWidget {
  const title = generateTitle(userQuery)

  // Rule 1: Scalar stat object — has a "value" key at the top level
  if (
    rawData !== null &&
    typeof rawData === "object" &&
    !Array.isArray(rawData) &&
    "value" in (rawData as object)
  ) {
    const obj = rawData as Record<string, unknown>
    return {
      widgetType: "stat",
      title,
      data: {
        value: Number(obj.value ?? 0),
        change: Number(obj.change ?? 0),
        trend: (obj.trend as string) ?? (Number(obj.change) >= 0 ? "up" : "down"),
      },
      confidence: "high",
      sql,
    }
  }

  // Must be an array from here on
  if (!Array.isArray(rawData) || rawData.length === 0) {
    return { widgetType: "table", title, data: rawData ?? [], confidence: "low", sql }
  }

  const rows = rawData as Record<string, unknown>[]
  const keys = Object.keys(rows[0])

  // Classify columns, ignoring identifier columns for charting purposes.
  const chartKeys = keys.filter(k => !isIdLike(k))
  const dateKeys = chartKeys.filter(isDateLike)
  // Measures = numeric columns that aren't dates (a "year" column is numeric but
  // it's an axis, not a value to plot).
  const measureKeys = chartKeys.filter(k => isNumeric(rows[0][k]) && !isDateLike(k))
  // Categories = non-numeric, non-date columns.
  const categoryKeys = chartKeys.filter(
    k => !isNumeric(rows[0][k]) && !isDateLike(k)
  )

  const wantsPie = PIE_INTENT.test(userQuery)
  const xKey = dateKeys[0] ?? categoryKeys[0]
  const isTimeAxis = dateKeys.length >= 1

  // Rule 2: an axis (date or category) + exactly one measure
  if (xKey && measureKeys.length === 1) {
    const usePie = !isTimeAxis && wantsPie && rows.length <= 8
    return {
      widgetType: isTimeAxis ? "line-chart" : usePie ? "pie-chart" : "bar-chart",
      title,
      data: singleSeries(rows, xKey, measureKeys[0]),
      confidence: "high",
      sql,
    }
  }

  // Rule 3: an axis + several measures → multi-series bar (or line for a time axis)
  if (xKey && measureKeys.length > 1) {
    return {
      widgetType: isTimeAxis ? "line-chart" : "bar-chart",
      title,
      data: multiSeries(rows, xKey, measureKeys),
      confidence: "medium",
      sql,
    }
  }

  // Rule 4: nothing chartable → table
  return {
    widgetType: "table",
    title,
    data: rows,
    confidence: keys.length >= 4 ? "high" : "low",
    sql,
  }
}

function generateTitle(userQuery: string): string {
  const cleaned = userQuery
    .trim()
    .replace(/^show me |^give me |^create |^display /i, "")
  const titled = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  return titled.length > 40 ? titled.slice(0, 40) + "…" : titled
}
