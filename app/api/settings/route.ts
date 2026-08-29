import { NextResponse } from "next/server"
import { isAnthropicKeyConfigured } from "@/lib/settings"
import { getConnectionStatus } from "@/lib/integrations/google/auth"

export async function GET() {
  const [anthropicKeyConfigured, google] = await Promise.all([
    isAnthropicKeyConfigured(),
    getConnectionStatus(),
  ])
  return NextResponse.json({ anthropicKeyConfigured, google })
}
