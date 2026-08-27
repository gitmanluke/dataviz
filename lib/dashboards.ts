import "server-only"
import type { Widget as WidgetRow } from "@prisma/client"
import type { Dashboard, Widget, LayoutItem, WidgetType, WidgetSpec } from "@/lib/types"

type DashboardRow = {
  id: string
  name: string
  description: string
  isFavorite: boolean
  lastViewed: Date
}

export function dashboardToClient(
  row: DashboardRow & { _count?: { widgets: number } },
  widgetCount?: number
): Dashboard {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isFavorite: row.isFavorite,
    lastViewed: row.lastViewed.toISOString(),
    widgetCount: widgetCount ?? row._count?.widgets ?? 0,
  }
}

export function widgetToClient(row: WidgetRow): { widget: Widget; layout: LayoutItem } {
  return {
    widget: {
      id: row.id,
      type: row.type as WidgetType,
      title: row.title,
      data: safeParse(row.data),
      ...(row.spec ? { spec: safeParse(row.spec) as WidgetSpec } : {}),
    },
    layout: {
      i: row.id,
      x: row.x,
      y: row.y,
      w: row.w,
      h: row.h,
      ...(row.minW != null ? { minW: row.minW } : {}),
      ...(row.minH != null ? { minH: row.minH } : {}),
    },
  }
}

export function safeParse(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** Sensible starting grid size for a new widget, by type (12-col grid). */
export function defaultSizeFor(type: string): { w: number; h: number; minW: number; minH: number } {
  switch (type) {
    case "stat":
      return { w: 3, h: 2, minW: 2, minH: 2 }
    case "table":
      return { w: 8, h: 4, minW: 3, minH: 3 }
    default: // line-chart | bar-chart | pie-chart
      return { w: 6, h: 4, minW: 3, minH: 3 }
  }
}
