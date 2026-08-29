import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { openReadonly, sourceDbExists } from "@/lib/engines/sql/store"
import { inferColumns } from "@/lib/engines/columns"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const source = await prisma.dataSource.findUnique({ where: { id } })
  if (!source) return NextResponse.json({ error: "Data source not found" }, { status: 404 })
  if (source.type !== "files" || !sourceDbExists(id)) return NextResponse.json([])

  const db = openReadonly(id)
  try {
    const names = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map(r => (r as { name: string }).name)

    const tables = names.map(name => {
      const q = `"${name.replace(/"/g, '""')}"`
      const rowCount = (db.prepare(`SELECT COUNT(*) AS n FROM ${q}`).get() as { n: number }).n
      const sample = db.prepare(`SELECT * FROM ${q} LIMIT 20`).all() as Array<Record<string, unknown>>
      return { name, rowCount, columns: inferColumns(sample) }
    })
    return NextResponse.json(tables)
  } finally {
    db.close()
  }
}
