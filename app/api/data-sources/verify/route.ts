import { NextRequest, NextResponse } from "next/server"
import { SnowLeopardClient } from "@snowleopard-ai/client"
import type { RetrieveResponse } from "@snowleopard-ai/client"

interface VerifyRequest {
  apiKey: string
  datafileId: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VerifyRequest
    const { apiKey, datafileId } = body

    if (!apiKey || !datafileId) {
      return NextResponse.json(
        { ok: false, error: "apiKey and datafileId are required" },
        { status: 400 }
      )
    }

    const client = new SnowLeopardClient({ apiKey })

    try {
      const result = await client.retrieve({
        userQuery: "What tables are available?",
        datafileId,
      })

      if (result.__type__ === "apiError") {
        return NextResponse.json({ ok: false, error: result.description })
      }

      const retrieveResult = result as RetrieveResponse
      if (
        retrieveResult.responseStatus !== "SUCCESS" &&
        retrieveResult.responseStatus !== "NOT_FOUND_IN_SCHEMA"
      ) {
        return NextResponse.json({
          ok: false,
          error: `Connection returned status: ${retrieveResult.responseStatus}`,
        })
      }

      return NextResponse.json({ ok: true })
    } finally {
      await client.close()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed"
    console.error("[verify] Error:", error)
    // Return 200 so the client can read the structured error body
    return NextResponse.json({ ok: false, error: message })
  }
}
