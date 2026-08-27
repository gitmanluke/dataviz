import { NextResponse } from "next/server"
import { isAnthropicKeyConfigured } from "@/lib/settings"

export async function GET() {
  return NextResponse.json({
    anthropicKeyConfigured: await isAnthropicKeyConfigured(),
  })
}
