import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { encryptSecret } from "@/lib/crypto"
import { verifyConnection } from "@/lib/snowleopard"
import { dataSourceToClient } from "@/lib/data-sources"
import { syncDueSheets } from "@/lib/integrations/google/sync"
import type { NewDataSource } from "@/lib/types"

const toClient = dataSourceToClient

export async function GET() {
  void syncDueSheets().catch(() => {})
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
