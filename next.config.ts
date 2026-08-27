import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Keep these out of the server bundle so they load at runtime.
  serverExternalPackages: ["@prisma/client", "@anthropic-ai/sdk"],
}

export default nextConfig
