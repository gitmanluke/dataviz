import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { snowLeopardEngine } from "@/lib/engines/snowleopard"
import { QueryError } from "@/lib/query-engine"
import { detectSpec } from "@/lib/widget-detector"

interface WidgetRequest {
  userQuery: string
  dataSourceId: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<WidgetRequest>
    const { userQuery, dataSourceId } = body

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
      result = await snowLeopardEngine.retrieve(userQuery, source)
    } catch (error) {
      if (error instanceof QueryError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      throw error
    }

    const spec = detectSpec(result.rows, userQuery)

    return NextResponse.json({
      spec,
      rows: result.rows,
      sql: result.sql,
      explanation: result.explanation,
      truncated: result.truncated,
      usedAgent: false,
    })
  } catch (error) {
    console.error("[ai/widget] Error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
