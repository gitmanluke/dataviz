import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { dashboardToClient } from "@/lib/dashboards"

const NOT_FOUND = { error: "Dashboard not found" }

function isMissing(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: {
    name?: string
    description?: string
    isFavorite?: boolean
    lastViewed?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const data: Prisma.DashboardUpdateInput = {}
  if (typeof body.name === "string") data.name = body.name.trim()
  if (typeof body.description === "string") data.description = body.description.trim()
  if (typeof body.isFavorite === "boolean") data.isFavorite = body.isFavorite
  if (typeof body.lastViewed === "string") {
    const d = new Date(body.lastViewed)
    if (!Number.isNaN(d.getTime())) data.lastViewed = d
  }

  try {
    const row = await prisma.dashboard.update({
      where: { id },
      data,
      include: { _count: { select: { widgets: true } } },
    })
    return NextResponse.json(dashboardToClient(row))
  } catch (error) {
    if (isMissing(error)) return NextResponse.json(NOT_FOUND, { status: 404 })
    throw error
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await prisma.dashboard.delete({ where: { id } })
  } catch (error) {
    if (isMissing(error)) return NextResponse.json(NOT_FOUND, { status: 404 })
    throw error
  }
  return new NextResponse(null, { status: 204 })
}
