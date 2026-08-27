import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Keep Prisma's query engine out of the bundle so it loads at runtime.
  serverExternalPackages: ["@prisma/client"],
}

export default nextConfig
