import { NextResponse } from "next/server"
import { getPickerConfig } from "@/lib/integrations/google/auth"

// GET /api/integrations/google/token — a short-lived, read-only access token +
// the API key for the Drive Picker (which is a browser-only widget). The
// long-lived refresh token never leaves the server. Called only when the
// connect-a-sheet dialog opens.
export async function GET() {
  const config = await getPickerConfig()
  if (!config) {
    return NextResponse.json({ error: "Google is not connected" }, { status: 404 })
  }
  return NextResponse.json(config)
}
