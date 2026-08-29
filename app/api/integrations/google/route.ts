import { NextResponse } from "next/server"
import { disconnect, getConnectionStatus } from "@/lib/integrations/google/auth"

// GET /api/integrations/google — connection status for the Settings UI.
export async function GET() {
  return NextResponse.json(await getConnectionStatus())
}

// DELETE /api/integrations/google — drop the stored refresh token (keeps creds).
export async function DELETE() {
  await disconnect()
  return new NextResponse(null, { status: 204 })
}
