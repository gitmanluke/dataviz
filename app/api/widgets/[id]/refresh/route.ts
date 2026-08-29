import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { widgetToClient } from "@/lib/dashboards"
import { runSql } from "@/lib/engines/sql"
import { QueryError } from "@/lib/query-engine"

// POST /api/widgets/:id/refresh — re-run the widget's stored query, replace `data`.
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
  if (!widget.query || !widget.dataSource || widget.dataSource.type !== "files") {
    return NextResponse.json({ error: "This widget can't be refreshed" }, { status: 400 })
  }

  let result
  try {
    result = await runSql(widget.query, widget.dataSource)
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
