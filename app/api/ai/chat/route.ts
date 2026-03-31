import { NextRequest } from "next/server"
import { SnowLeopardClient } from "@snowleopard-ai/client"
import type { ResponseData } from "@snowleopard-ai/client"

interface ChatRequest {
  userQuery: string
  datafileId: string
  apiKey: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest
    const { userQuery, datafileId, apiKey } = body

    if (!userQuery || !datafileId || !apiKey) {
      return new Response(
        JSON.stringify({ error: "userQuery, datafileId, and apiKey are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const client = new SnowLeopardClient({ apiKey })

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of client.response({ userQuery, datafileId })) {
            // ResponseDataObjects = APIError | ResponseStart | ResponseData | EarlyTermination | ResponseLLMResult
            if (chunk.__type__ === "apiError") {
              // Surface API errors as a plain text message in the stream
              controller.enqueue(
                new TextEncoder().encode(`[Error: ${chunk.description}]`)
              )
              break
            }

            if (chunk.__type__ === "responseData") {
              // ResponseData carries SchemaData / ErrorSchemaData — not prose text.
              // Serialize as JSON so the client can optionally use it.
              const dataChunk = chunk as ResponseData
              controller.enqueue(
                new TextEncoder().encode(JSON.stringify(dataChunk.data))
              )
            }

            // ResponseStart and EarlyTermination carry no text to stream.
            // ResponseLLMResult carries the final LLM prose in llmResponse.
            if (chunk.__type__ === "responseResult") {
              const llmText =
                typeof chunk.llmResponse === "string"
                  ? chunk.llmResponse
                  : (chunk.llmResponse?.text as string | undefined) ??
                    JSON.stringify(chunk.llmResponse)
              controller.enqueue(new TextEncoder().encode(llmText))
            }
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        } finally {
          await client.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
