import type { Metadata } from "next"
import { Toaster } from "sonner"
import Navigation from "@/components/layout/Navigation"
import "./globals.css"

export const metadata: Metadata = {
  title: "DataViz - Dashboard Builder",
  description: "Build professional dashboards powered by AI",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-background">
          <Navigation />
          <main>{children}</main>
        </div>
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
