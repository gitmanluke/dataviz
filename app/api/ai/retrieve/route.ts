import { NextRequest, NextResponse } from "next/server"
import type { SchemaData, RetrieveResponse } from "@snowleopard-ai/client"
import { prisma } from "@/lib/db"
import { decryptSecret } from "@/lib/crypto"
import { createSnowLeopardClient } from "@/lib/snowleopard"
import { detectSpec } from "@/lib/widget-detector"
import { STORE_ROW_CAP } from "@/lib/widget-spec"

interface RetrieveRequest {
  userQuery: string
  dataSourceId: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<RetrieveRequest>
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

    const client = createSnowLeopardClient(decryptSecret(source.apiKeyCipher))

    try {
      const result = await client.retrieve({
        userQuery,
        datafileId: source.datafileId,
      })

      if (result.__type__ === "apiError") {
        return NextResponse.json(
          { error: result.description, responseStatus: result.responseStatus },
          { status: 422 }
        )
      }

      const retrieveResult = result as RetrieveResponse
      if (retrieveResult.responseStatus !== "SUCCESS") {
        return NextResponse.json(
          { error: `Query failed: ${retrieveResult.responseStatus}` },
          { status: 422 }
        )
      }

      const schemaEntry = retrieveResult.data.find(
        (d): d is SchemaData => d.__type__ === "schemaData"
      )
      if (!schemaEntry) {
        const errEntry = retrieveResult.data[0]
        const errMsg =
          errEntry && errEntry.__type__ === "errorSchemaData"
            ? errEntry.error
            : "No data returned"
        return NextResponse.json({ error: errMsg }, { status: 422 })
      }

      const allRows = Array.isArray(schemaEntry.rows) ? schemaEntry.rows : []
      const rows = allRows.slice(0, STORE_ROW_CAP)
      const sql = schemaEntry.query ?? undefined
      const explanation = schemaEntry.querySummary?.non_technical_explanation ?? null

      const spec = detectSpec(rows, userQuery)

      return NextResponse.json({
        spec,
        rows,
        sql,
        explanation,
        truncated: allRows.length > rows.length,
        usedAgent: false,
      })
    } finally {
      await client.close()
    }
  } catch (error) {
    console.error("[retrieve] Error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
