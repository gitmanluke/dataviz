import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { widgetToClient, defaultSizeFor } from "@/lib/dashboards"
import { syncDueSheets } from "@/lib/integrations/google/sync"
import type { LayoutItem, Widget } from "@/lib/types"

// GET /api/dashboards/:id/widgets -> { widgets, layouts }
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Opportunistic Google Sheets refresh — bounded so a slow sync can't hang the
  // dashboard load (it finishes in the background for next time).
  await syncDueSheets({ dashboardId: id, timeoutMs: 8000 })

  const rows = await prisma.widget.findMany({
    where: { dashboardId: id },
    orderBy: { createdAt: "asc" },
  })
  const mapped = rows.map(widgetToClient)
  return NextResponse.json({
    widgets: mapped.map(m => m.widget),
    layouts: mapped.map(m => m.layout),
  })
}

// POST /api/dashboards/:id/widgets -> { widget, layout }   body: { type, title, data }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const dashboard = await prisma.dashboard.findUnique({ where: { id } })
  if (!dashboard) {
    return NextResponse.json({ error: "Dashboard not found" }, { status: 404 })
  }

  let body: Partial<Omit<Widget, "id">>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!body.type || !body.title) {
    return NextResponse.json({ error: "type and title are required" }, { status: 400 })
  }

  // Place the new widget below everything currently on the grid.
  const existing = await prisma.widget.findMany({
    where: { dashboardId: id },
    select: { y: true, h: true },
  })
  const nextY = existing.reduce((max, w) => Math.max(max, w.y + w.h), 0)
  const size = defaultSizeFor(body.type)

  // A widget can be refreshed only when its SQL is re-runnable — file and sheets
  // sources. SnowLeopard SQL can't be re-run, so drop the query for those.
  let query: string | null = null
  const dataSourceId = body.dataSourceId ?? null
  if (body.query && dataSourceId) {
    const src = await prisma.dataSource.findUnique({ where: { id: dataSourceId } })
    if (src?.type === "files" || src?.type === "sheets") query = body.query
  }

  const row = await prisma.widget.create({
    data: {
      dashboardId: id,
      type: body.type,
      title: body.title,
      data: JSON.stringify(body.data ?? null),
      spec: body.spec ? JSON.stringify(body.spec) : null,
      query,
      dataSourceId,
      x: 0,
      y: nextY,
      ...size,
    },
  })

  return NextResponse.json(widgetToClient(row), { status: 201 })
}

// PUT /api/dashboards/:id/widgets -> 204   body: LayoutItem[]  (bulk layout save)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let items: LayoutItem[]
  try {
    items = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "Expected an array of layout items" }, { status: 400 })
  }

  await prisma.$transaction(
    items.map(it =>
      prisma.widget.updateMany({
        where: { id: it.i, dashboardId: id },
        data: { x: it.x, y: it.y, w: it.w, h: it.h },
      })
    )
  )

  return new NextResponse(null, { status: 204 })
}
