import type { WidgetSpec } from "@/lib/types"
import type { Column } from "@/lib/query-engine"

export interface VizContext {
  userQuery: string
  columns: Column[]
  sampleRows: Array<Record<string, unknown>>
  sql?: string
  priorSpec?: WidgetSpec
}

/** Turns a query + its result shape into a WidgetSpec. */
export interface VizModel {
  proposeSpec(ctx: VizContext): Promise<WidgetSpec | null>
}
