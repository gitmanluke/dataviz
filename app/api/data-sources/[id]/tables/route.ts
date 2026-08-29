import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { readTables } from "@/lib/engines/sql/tables"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const source = await prisma.dataSource.findUnique({ where: { id } })
  if (!source) return NextResponse.json({ error: "Data source not found" }, { status: 404 })
  if (source.type !== "files") return NextResponse.json([])

  return NextResponse.json(readTables(id))
}
