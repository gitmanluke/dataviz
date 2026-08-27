import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { widgetToClient } from "@/lib/dashboards"
import type { WidgetSpec } from "@/lib/types"

function isMissing(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
  )
}

// PATCH /api/widgets/:id   body: { title? } and/or { spec? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: { title?: string; spec?: WidgetSpec }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const data: Prisma.WidgetUpdateInput = {}
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim()
  if (body.spec && typeof body.spec === "object") {
    data.spec = JSON.stringify(body.spec)
    data.type = body.spec.type // keep the column in sync with the spec
    if (body.spec.title?.trim()) data.title = body.spec.title.trim()
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 })
  }

  try {
    const row = await prisma.widget.update({ where: { id }, data })
    return NextResponse.json(widgetToClient(row).widget)
  } catch (error) {
    if (isMissing(error)) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 })
    }
    throw error
  }
}

// DELETE /api/widgets/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await prisma.widget.delete({ where: { id } })
  } catch (error) {
    if (isMissing(error)) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 })
    }
    throw error
  }
  return new NextResponse(null, { status: 204 })
}
