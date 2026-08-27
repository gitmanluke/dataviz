import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { MigrationPayload } from "@/lib/types"

// One-time import of dashboards + widgets from the browser's localStorage.
// Safe to call repeatedly: it no-ops once any dashboard exists in the DB.
export async function POST(request: NextRequest) {
  const existing = await prisma.dashboard.count()
  if (existing > 0) {
    return NextResponse.json({ skipped: "database already has dashboards" })
  }

  let payload: MigrationPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const dashboards = Array.isArray(payload.dashboards) ? payload.dashboards : []
  const widgetStores = payload.widgetStores ?? {}

  let importedDashboards = 0
  let importedWidgets = 0

  await prisma.$transaction(async tx => {
    for (const d of dashboards) {
      const lastViewed = new Date(d.lastViewed)
      const created = await tx.dashboard.create({
        data: {
          name: d.name || "Untitled",
          description: d.description || "",
          isFavorite: Boolean(d.isFavorite),
          lastViewed: Number.isNaN(lastViewed.getTime()) ? new Date() : lastViewed,
        },
      })
      importedDashboards++

      const store = widgetStores[d.id]
      if (!store?.widgets?.length) continue

      const layoutById = new Map(
        (store.layouts ?? []).map(l => [l.i, l])
      )

      for (const w of store.widgets) {
        const l = layoutById.get(w.id)
        await tx.widget.create({
          data: {
            dashboardId: created.id,
            type: w.type,
            title: w.title,
            data: JSON.stringify(w.data ?? null),
            x: l?.x ?? 0,
            y: l?.y ?? 0,
            w: l?.w ?? 4,
            h: l?.h ?? 3,
            minW: l?.minW ?? 2,
            minH: l?.minH ?? 2,
          },
        })
        importedWidgets++
      }
    }
  })

  return NextResponse.json({
    imported: { dashboards: importedDashboards, widgets: importedWidgets },
  })
}
