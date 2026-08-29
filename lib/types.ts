export interface Dashboard {
  id: string
  name: string
  description: string
  lastViewed: string  // ISO string (not Date, for JSON serialization)
  isFavorite: boolean
  widgetCount: number
}

export type WidgetType = "line-chart" | "bar-chart" | "pie-chart" | "stat" | "table"

// How to render a widget's raw rows. Produced by the viz agent (or the
// heuristic fallback), editable in the widget edit panel.
export interface WidgetSpec {
  type: WidgetType
  title: string
  xKey: string        // category/time-axis column ("" for stat)
  series: string[]    // measure columns to plot
  sort?: "none" | "asc" | "desc"
}

export interface Widget {
  id: string
  type: WidgetType
  title: string
  data: unknown        // raw query rows (Record<string, unknown>[]); legacy widgets store collapsed chart data
  spec?: WidgetSpec
  query?: string        // the SQL that produced `data` — present ⇒ widget can be refreshed
  dataSourceId?: string
}

export interface LayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

// Client-safe shape — the API key lives only in the DB (see prisma/schema.prisma)
// and never leaves the server.
export interface DataSource {
  id: string
  name: string
  description?: string
  type: string                 // "snowleopard" | "files"
  datafileId?: string          // snowleopard only
  status: "connected" | "error" | "verifying"
  createdAt: string  // ISO string
}

// Payload for creating a data source (POST /api/data-sources).
export interface NewDataSource {
  name: string
  description?: string
  datafileId: string
  apiKey: string
}

export interface DashboardStore {
  widgets: Widget[]
  layouts: LayoutItem[]
}

// Payload for the one-time localStorage → SQLite import (POST /api/migrate).
export interface MigrationPayload {
  dashboards: Dashboard[]
  widgetStores: Record<string, DashboardStore>
}
