import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { dataSourceToClient } from "@/lib/data-sources"
import { readTables } from "@/lib/engines/sql/tables"
import { isConnected } from "@/lib/integrations/google/auth"
import { resyncSource } from "@/lib/integrations/google/sync"

// POST /api/data-sources/:id/sync — pull the latest from Google now and re-run
// bound widgets. Sheets sources only.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const source = await prisma.dataSource.findUnique({ where: { id } })
  if (!source) return NextResponse.json({ error: "Data source not found" }, { status: 404 })
  if (source.type !== "sheets") {
    return NextResponse.json({ error: "Not a Google Sheets source" }, { status: 400 })
  }
  if (!(await isConnected())) {
    return NextResponse.json({ error: "Reconnect Google in Settings." }, { status: 409 })
  }

  await resyncSource(source, { force: true })

  const updated = await prisma.dataSource.findUnique({ where: { id } })
  if (!updated) return NextResponse.json({ error: "Data source not found" }, { status: 404 })
  if (updated.status === "error" && updated.syncError) {
    return NextResponse.json({ error: updated.syncError }, { status: 422 })
  }
  return NextResponse.json({ ...dataSourceToClient(updated), tables: readTables(id) })
}
