"use client"

import { useCallback, useEffect, useState } from "react"
import type { Dashboard } from "@/lib/types"

/**
 * Dashboards live in SQLite (see prisma/schema.prisma). Reads happen once on
 * mount; mutations update local state optimistically and fire the request in
 * the background so the UI stays responsive.
 */
export function useDashboards() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/dashboards")
      .then(res => (res.ok ? res.json() : []))
      .then((rows: Dashboard[]) => {
        if (!cancelled) setDashboards(rows)
      })
      .catch(() => {
        if (!cancelled) setDashboards([])
      })
      .finally(() => {
        if (!cancelled) setInitialized(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const create = useCallback(async (name: string, description = ""): Promise<Dashboard> => {
    const res = await fetch("/api/dashboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    })
    if (!res.ok) throw new Error("Could not create dashboard")
    const created = (await res.json()) as Dashboard
    setDashboards(prev => [created, ...prev])
    return created
  }, [])

  const patch = useCallback((id: string, changes: Partial<Dashboard>, body: Record<string, unknown>) => {
    setDashboards(prev => prev.map(d => (d.id === id ? { ...d, ...changes } : d)))
    void fetch(`/api/dashboards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {})
  }, [])

  const update = useCallback(
    (id: string, changes: Partial<Dashboard>) => patch(id, changes, changes),
    [patch]
  )

  const remove = useCallback((id: string) => {
    setDashboards(prev => prev.filter(d => d.id !== id))
    void fetch(`/api/dashboards/${id}`, { method: "DELETE" }).catch(() => {})
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    setDashboards(prev => {
      const target = prev.find(d => d.id === id)
      if (target) {
        const next = !target.isFavorite
        void fetch(`/api/dashboards/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFavorite: next }),
        }).catch(() => {})
      }
      return prev.map(d => (d.id === id ? { ...d, isFavorite: !d.isFavorite } : d))
    })
  }, [])

  const updateLastViewed = useCallback((id: string) => {
    const now = new Date().toISOString()
    patch(id, { lastViewed: now }, { lastViewed: now })
  }, [patch])

  return { dashboards, initialized, create, update, remove, toggleFavorite, updateLastViewed }
}
