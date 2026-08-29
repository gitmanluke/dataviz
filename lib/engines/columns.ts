import type { Column } from "@/lib/query-engine"
import { isNumeric, isDateLike } from "@/lib/widget-detector"

/** Infer a {name, type} for each column from the row values. Shared by the
 *  SnowLeopard and SQL engines. */
export function inferColumns(rows: Array<Record<string, unknown>>): Column[] {
  if (rows.length === 0) return []
  return Object.keys(rows[0]).map(name => {
    if (isDateLike(name)) return { name, type: "date" as const }
    const samples = rows.slice(0, 20).map(r => r[name]).filter(v => v != null && v !== "")
    if (samples.length > 0 && samples.every(isNumeric)) return { name, type: "number" as const }
    return { name, type: "string" as const }
  })
}
