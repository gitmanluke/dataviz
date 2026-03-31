import { NextRequest, NextResponse } from "next/server"
import { SnowLeopardClient } from "@snowleopard-ai/client"
import type { SchemaData, RetrieveResponse } from "@snowleopard-ai/client"
import { detectWidget } from "@/lib/widget-detector"

interface RetrieveRequest {
  userQuery: string
  datafileId: string
  apiKey: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RetrieveRequest
    const { userQuery, datafileId, apiKey } = body

    if (!userQuery || !datafileId || !apiKey) {
      return NextResponse.json(
        { error: "userQuery, datafileId, and apiKey are required" },
        { status: 400 }
      )
    }

    const client = new SnowLeopardClient({ apiKey })

    try {
      const result = await client.retrieve({ userQuery, datafileId })

      // result is RetrieveResponse | APIError
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

      // Find the first successful SchemaData entry
      const schemaEntry = retrieveResult.data.find(
        (d): d is SchemaData => d.__type__ === "schemaData"
      )

      if (!schemaEntry) {
        // All entries were errorSchemaData
        const errEntry = retrieveResult.data[0]
        const errMsg =
          errEntry && errEntry.__type__ === "errorSchemaData"
            ? errEntry.error
            : "No data returned"
        return NextResponse.json({ error: errMsg }, { status: 422 })
      }

      const rawData = schemaEntry.rows
      const sql = schemaEntry.query ?? undefined
      const explanation =
        schemaEntry.querySummary?.non_technical_explanation ?? null

      const detected = detectWidget(rawData, userQuery, sql)
      return NextResponse.json({ ...detected, explanation })
    } finally {
      await client.close()
    }
  } catch (error) {
    console.error("[retrieve] Error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
