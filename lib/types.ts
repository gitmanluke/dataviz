export interface Dashboard {
  id: string
  name: string
  description: string
  lastViewed: string  // ISO string (not Date, for JSON serialization)
  isFavorite: boolean
  widgetCount: number
}

export interface Widget {
  id: string
  type: "line-chart" | "bar-chart" | "pie-chart" | "stat" | "table"
  title: string
  data: unknown
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
  type: string
  datafileId: string
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
