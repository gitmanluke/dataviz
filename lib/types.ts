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

export interface DataSource {
  id: string
  name: string
  description?: string
  datafileId: string
  apiKey: string
  status: "connected" | "error" | "verifying"
  addedAt: string  // ISO string
}

export interface DashboardStore {
  widgets: Widget[]
  layouts: LayoutItem[]
}
