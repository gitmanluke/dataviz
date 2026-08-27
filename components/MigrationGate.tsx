"use client"

import { useEffect, useState } from "react"
import type { Dashboard, DashboardStore } from "@/lib/types"

const FLAG = "dataviz:migrated:dashboards"
const DASHBOARDS_KEY = "dataviz:dashboards"
const WIDGETS_PREFIX = "dataviz:widgets:"

/**
 * One-time import of dashboards + widgets from the browser's localStorage into
 * the SQLite DB. Blocks children until the check completes so hooks don't fetch
 * an empty DB before the import runs. After the first successful pass this is a
 * single synchronous localStorage read.
 */
export function MigrationGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        if (localStorage.getItem(FLAG)) return

        const dashboards = readJSON<Dashboard[]>(DASHBOARDS_KEY, [])
        const widgetStores: Record<string, DashboardStore> = {}
        const widgetKeys: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.startsWith(WIDGETS_PREFIX)) {
            widgetKeys.push(key)
            widgetStores[key.slice(WIDGETS_PREFIX.length)] = readJSON<DashboardStore>(
              key,
              { widgets: [], layouts: [] }
            )
          }
        }

        if (Array.isArray(dashboards) && dashboards.length > 0) {
          await fetch("/api/migrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dashboards, widgetStores }),
          })
        }

        localStorage.removeItem(DASHBOARDS_KEY)
        widgetKeys.forEach(k => localStorage.removeItem(k))
        localStorage.setItem(FLAG, new Date().toISOString())
      } catch {
        // Never block the app on a migration failure.
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
        Loading…
      </div>
    )
  }

  return <>{children}</>
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}
