import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { encryptSecret } from "@/lib/crypto"
import { verifyConnection } from "@/lib/snowleopard"
import type { DataSource, NewDataSource } from "@/lib/types"

// Shape a DB row into the client-safe DataSource (drops apiKeyCipher).
function toClient(row: {
  id: string
  name: string
  description: string | null
  type: string
  datafileId: string
  status: string
  createdAt: Date
}): DataSource {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    type: row.type,
    datafileId: row.datafileId,
    status: row.status as DataSource["status"],
    createdAt: row.createdAt.toISOString(),
  }
}

export async function GET() {
  const rows = await prisma.dataSource.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(rows.map(toClient))
}

export async function POST(request: NextRequest) {
  let body: Partial<NewDataSource>
  try {
    body = (await request.json()) as Partial<NewDataSource>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const name = body.name?.trim()
  const datafileId = body.datafileId?.trim()
  const apiKey = body.apiKey?.trim()
  const description = body.description?.trim() || undefined

  if (!name || !datafileId || !apiKey) {
    return NextResponse.json(
      { error: "name, datafileId, and apiKey are required" },
      { status: 400 }
    )
  }

  const verified = await verifyConnection(apiKey, datafileId)
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 422 })
  }

  const row = await prisma.dataSource.create({
    data: {
      name,
      description,
      datafileId,
      apiKeyCipher: encryptSecret(apiKey),
      status: "connected",
    },
  })

  return NextResponse.json(toClient(row), { status: 201 })
}
