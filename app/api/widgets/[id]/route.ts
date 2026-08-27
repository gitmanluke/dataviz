import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { widgetToClient } from "@/lib/dashboards"

function isMissing(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
  )
}

// PATCH /api/widgets/:id   body: { title }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: { title?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const title = body.title?.trim()
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 })
  }

  try {
    const row = await prisma.widget.update({ where: { id }, data: { title } })
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
