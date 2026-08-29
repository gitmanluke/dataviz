import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { dataSourceToClient } from "@/lib/data-sources"
import { ingestFiles } from "@/lib/engines/sql/ingest-files"
import { removeSourceDb } from "@/lib/engines/sql/store"

const MAX_FILE_BYTES = 25 * 1024 * 1024
const ALLOWED = /\.(csv|db|sqlite|sqlite3)$/i

export async function POST(request: NextRequest) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 })
  }

  const name = String(form.get("name") ?? "").trim()
  const description = String(form.get("description") ?? "").trim() || undefined
  const files = form.getAll("files").filter((f): f is File => f instanceof File)

  if (!name) {
    return NextResponse.json({ error: "A name is required" }, { status: 400 })
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "Add at least one .csv or .db file" }, { status: 400 })
  }
  for (const file of files) {
    if (!ALLOWED.test(file.name)) {
      return NextResponse.json({ error: `${file.name}: only .csv and .db files are supported` }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `${file.name} is larger than 25 MB` }, { status: 400 })
    }
  }

  const source = await prisma.dataSource.create({
    data: { name, description, type: "files", status: "connected" },
  })

  try {
    const tables = await ingestFiles(source.id, files)
    return NextResponse.json({ ...dataSourceToClient(source), tables }, { status: 201 })
  } catch (error) {
    await prisma.dataSource.delete({ where: { id: source.id } }).catch(() => {})
    removeSourceDb(source.id)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read the files" },
      { status: 422 },
    )
  }
}
