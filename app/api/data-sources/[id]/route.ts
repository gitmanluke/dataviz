import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { dataSourceToClient } from "@/lib/data-sources"
import { removeSourceDb } from "@/lib/engines/sql/store"
import { isRefreshInterval } from "@/lib/integrations/google/intervals"

// PATCH /api/data-sources/:id — rename, or change a sheets source's interval.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: { name?: string; refreshInterval?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const data: Prisma.DataSourceUpdateInput = {}
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
  if (body.refreshInterval !== undefined) {
    if (!isRefreshInterval(body.refreshInterval)) {
      return NextResponse.json({ error: "Unknown refresh interval" }, { status: 400 })
    }
    data.refreshInterval = body.refreshInterval
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  try {
    const row = await prisma.dataSource.update({ where: { id }, data })
    return NextResponse.json(dataSourceToClient(row))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Data source not found" }, { status: 404 })
    }
    throw error
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    await prisma.dataSource.delete({ where: { id } })
    removeSourceDb(id)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Data source not found" }, { status: 404 })
    }
    throw error
  }

  return new NextResponse(null, { status: 204 })
}
