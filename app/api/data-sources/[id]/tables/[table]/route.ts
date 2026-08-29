import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { dropTable } from "@/lib/engines/sql/tables"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; table: string }> },
) {
  const { id, table } = await params

  const source = await prisma.dataSource.findUnique({ where: { id } })
  if (!source) return NextResponse.json({ error: "Data source not found" }, { status: 404 })
  if (source.type !== "files") {
    return NextResponse.json({ error: "This data source has no tables" }, { status: 400 })
  }

  const dropped = dropTable(id, decodeURIComponent(table))
  if (!dropped) return NextResponse.json({ error: "Table not found" }, { status: 404 })

  return new NextResponse(null, { status: 204 })
}
