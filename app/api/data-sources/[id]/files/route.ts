import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ingestFiles } from "@/lib/engines/sql/ingest-files"
import { readTables } from "@/lib/engines/sql/tables"

const MAX_FILE_BYTES = 25 * 1024 * 1024
const ALLOWED = /\.(csv|db|sqlite|sqlite3)$/i

/** Add (or replace) tables in an existing files source. A re-uploaded file with
 *  the same table name replaces that table. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const source = await prisma.dataSource.findUnique({ where: { id } })
  if (!source) return NextResponse.json({ error: "Data source not found" }, { status: 404 })
  if (source.type !== "files") {
    return NextResponse.json({ error: "This data source doesn't accept file uploads" }, { status: 400 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 })
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File)
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

  try {
    await ingestFiles(id, files)
    return NextResponse.json({ tables: readTables(id) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read the files" },
      { status: 422 },
    )
  }
}
