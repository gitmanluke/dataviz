import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { dataSourceToClient } from "@/lib/data-sources"
import { syncDueSheets } from "@/lib/integrations/google/sync"

// Data sources are created via POST /api/data-sources/upload (files) or
// POST /api/data-sources/sheets (Google Sheets).
export async function GET() {
  void syncDueSheets().catch(() => {})
  const rows = await prisma.dataSource.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(rows.map(dataSourceToClient))
}
