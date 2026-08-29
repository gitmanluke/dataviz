import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { widgetToClient } from "@/lib/dashboards"
import { runSql } from "@/lib/engines/sql"
import { QueryError } from "@/lib/query-engine"
import { resyncSource } from "@/lib/integrations/google/sync"

const REFRESHABLE = new Set(["files", "sheets"])

// POST /api/widgets/:id/refresh — re-run the widget's stored query, replace
// `data`. For a sheets widget, pull the latest from Google first.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const widget = await prisma.widget.findUnique({
    where: { id },
    include: { dataSource: true },
  })
  if (!widget) return NextResponse.json({ error: "Widget not found" }, { status: 404 })
  if (!widget.query || !widget.dataSource || !REFRESHABLE.has(widget.dataSource.type)) {
    return NextResponse.json({ error: "This widget can't be refreshed" }, { status: 400 })
  }

  let source = widget.dataSource
  if (source.type === "sheets") {
    await resyncSource(source)
    source = (await prisma.dataSource.findUnique({ where: { id: source.id } })) ?? source
  }

  let result
  try {
    result = await runSql(widget.query, source)
  } catch (error) {
    if (error instanceof QueryError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }

  const row = await prisma.widget.update({
    where: { id },
    data: { data: JSON.stringify(result.rows) },
  })
  return NextResponse.json(widgetToClient(row).widget)
}
