export type WidgetType = "line-chart" | "bar-chart" | "pie-chart" | "stat" | "table"

export interface DetectedWidget {
  widgetType: WidgetType
  title: string
  data: unknown
  confidence: "high" | "medium" | "low"
  sql?: string
}

const DATE_PATTERNS = /date|time|month|year|day|week|period|quarter/i
const NUMERIC_TYPES = ["number", "integer", "float", "decimal", "bigint"]

// Suppress unused variable warning — kept for documentation purposes
void NUMERIC_TYPES

function isNumeric(value: unknown): boolean {
  return (
    typeof value === "number" ||
    (typeof value === "string" && !isNaN(Number(value)) && value.trim() !== "")
  )
}

function isDateLike(key: string): boolean {
  return DATE_PATTERNS.test(key)
}

function normalizeForRecharts(
  data: Record<string, unknown>[],
  nameKey: string,
  valueKey: string
): { name: string | number; value: number }[] {
  return data.map((row) => ({
    name: row[nameKey] as string | number,
    value: Number(row[valueKey]),
  }))
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
  const numericKeys = keys.filter((k) => isNumeric(rows[0][k]))
  const stringKeys = keys.filter((k) => !isNumeric(rows[0][k]))
  const dateKeys = keys.filter((k) => isDateLike(k))

  // Rule 2: Has date column + 1 numeric → line chart
  if (dateKeys.length >= 1 && numericKeys.length === 1) {
    const dateKey = dateKeys[0]
    const valueKey = numericKeys[0]
    return {
      widgetType: "line-chart",
      title,
      data: normalizeForRecharts(rows, dateKey, valueKey),
      confidence: "high",
      sql,
    }
  }

  // Rule 3 & 4: 1 string col + 1 numeric → pie (≤8 rows) or bar (>8 rows)
  if (stringKeys.length === 1 && numericKeys.length === 1) {
    const nameKey = stringKeys[0]
    const valueKey = numericKeys[0]
    const normalized = normalizeForRecharts(rows, nameKey, valueKey)
    return {
      widgetType: rows.length <= 8 ? "pie-chart" : "bar-chart",
      title,
      data: normalized,
      confidence: "high",
      sql,
    }
  }

  // Rule 5: 1 string + multiple numerics → grouped bar chart
  if (stringKeys.length >= 1 && numericKeys.length > 1) {
    const nameKey = stringKeys[0]
    const groupedData = rows.map((row) => ({
      name: row[nameKey] as string,
      ...Object.fromEntries(numericKeys.map((k) => [k, Number(row[k])])),
    }))
    return {
      widgetType: "bar-chart",
      title,
      data: groupedData,
      confidence: "medium",
      sql,
    }
  }

  // Rule 6: 4+ columns → table (high confidence)
  if (keys.length >= 4) {
    return { widgetType: "table", title, data: rows, confidence: "high", sql }
  }

  // Fallback
  return { widgetType: "table", title, data: rows, confidence: "low", sql }
}

function generateTitle(userQuery: string): string {
  const cleaned = userQuery
    .trim()
    .replace(/^show me |^give me |^create |^display /i, "")
  const titled = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  return titled.length > 40 ? titled.slice(0, 40) + "…" : titled
}
