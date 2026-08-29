import { NextRequest, NextResponse } from "next/server"
import { clearCredentials, setCredentials } from "@/lib/integrations/google/auth"

// PUT /api/integrations/google/credentials — save the OAuth client id/secret
// (Desktop app) and the Picker API key. All three required.
export async function PUT(request: NextRequest) {
  let body: { clientId?: string; clientSecret?: string; apiKey?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const clientId = body.clientId?.trim()
  const clientSecret = body.clientSecret?.trim()
  const apiKey = body.apiKey?.trim()
  if (!clientId || !clientSecret || !apiKey) {
    return NextResponse.json(
      { error: "clientId, clientSecret, and apiKey are all required" },
      { status: 400 },
    )
  }

  await setCredentials({ clientId, clientSecret, apiKey })
  return new NextResponse(null, { status: 204 })
}

// DELETE — remove credentials and any stored token.
export async function DELETE() {
  await clearCredentials()
  return new NextResponse(null, { status: 204 })
}
