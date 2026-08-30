import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sqlEngine } from "@/lib/engines/sql"
import { QueryError } from "@/lib/query-engine"
import { resolveSpec } from "@/lib/viz"
import type { WidgetSpec } from "@/lib/types"

interface WidgetRequest {
  userQuery: string
  dataSourceId: string
  priorSpec?: WidgetSpec
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<WidgetRequest>
    const { userQuery, dataSourceId, priorSpec } = body

    if (!userQuery || !dataSourceId) {
      return NextResponse.json(
        { error: "userQuery and dataSourceId are required" },
        { status: 400 }
      )
    }

    const source = await prisma.dataSource.findUnique({ where: { id: dataSourceId } })
    if (!source) {
      return NextResponse.json({ error: "Data source not found" }, { status: 404 })
    }

    let result
    try {
      result = await sqlEngine.retrieve(userQuery, source)
    } catch (error) {
      if (error instanceof QueryError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      throw error
    }

    const { spec, usedAgent } = await resolveSpec(result, userQuery, priorSpec)

    return NextResponse.json({
      spec,
      rows: result.rows,
      sql: result.sql,
      explanation: result.explanation,
      truncated: result.truncated,
      usedAgent,
    })
  } catch (error) {
    console.error("[ai/widget] Error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
