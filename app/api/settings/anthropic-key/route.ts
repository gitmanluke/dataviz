import { NextRequest, NextResponse } from "next/server"
import { verifyAnthropicKey } from "@/lib/anthropic"
import { setAnthropicKey, clearAnthropicKey } from "@/lib/settings"

export async function PUT(request: NextRequest) {
  let body: { apiKey?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const apiKey = body.apiKey?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 })
  }

  const verified = await verifyAnthropicKey(apiKey)
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 422 })
  }

  await setAnthropicKey(apiKey)
  return new NextResponse(null, { status: 204 })
}

export async function DELETE() {
  await clearAnthropicKey()
  return new NextResponse(null, { status: 204 })
}
