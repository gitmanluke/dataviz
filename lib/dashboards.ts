import "server-only"
import type { Widget as WidgetRow } from "@prisma/client"
import type { Dashboard, Widget, LayoutItem, WidgetType } from "@/lib/types"

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
