import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { dashboardToClient } from "@/lib/dashboards"

export async function GET() {
  const rows = await prisma.dashboard.findMany({
    orderBy: { lastViewed: "desc" },
    include: { _count: { select: { widgets: true } } },
  })
  return NextResponse.json(rows.map(r => dashboardToClient(r)))
}

export async function POST(request: NextRequest) {
  let body: { name?: string; description?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const row = await prisma.dashboard.create({
    data: { name, description: body.description?.trim() ?? "" },
  })
  return NextResponse.json(dashboardToClient(row, 0), { status: 201 })
}
