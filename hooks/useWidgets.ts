"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Widget, LayoutItem, DashboardStore, WidgetSpec } from "@/lib/types"

const EMPTY: DashboardStore = { widgets: [], layouts: [] }

/**
 * Widgets for one dashboard, backed by SQLite. Same surface as before; reads
 * once on mount, mutations are optimistic. Layout drags are debounced before
 * they hit the API.
 */
export function useWidgets(dashboardId: string) {
  const [store, setStore] = useState<DashboardStore>(EMPTY)
  const [initialized, setInitialized] = useState(false)
  const layoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!dashboardId) return
    let cancelled = false
    // dashboardId only changes via full navigation (each /dashboard/[id] is a
    // fresh mount), so `initialized` starting false on mount is enough.
    fetch(`/api/dashboards/${dashboardId}/widgets`)
      .then(res => (res.ok ? res.json() : EMPTY))
      .then((data: DashboardStore) => {
        if (!cancelled) setStore(data ?? EMPTY)
      })
      .catch(() => {
        if (!cancelled) setStore(EMPTY)
      })
      .finally(() => {
        if (!cancelled) setInitialized(true)
      })
    return () => {
      cancelled = true
    }
  }, [dashboardId])

  const add = useCallback(async (widget: Omit<Widget, "id">): Promise<Widget> => {
    const res = await fetch(`/api/dashboards/${dashboardId}/widgets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(widget),
    })
    if (!res.ok) throw new Error("Could not add widget")
    const { widget: created, layout } = (await res.json()) as {
      widget: Widget
      layout: LayoutItem
    }
    setStore(prev => ({
      widgets: [...prev.widgets, created],
      layouts: [...prev.layouts, layout],
    }))
    return created
  }, [dashboardId])

  const remove = useCallback((id: string) => {
    setStore(prev => ({
      widgets: prev.widgets.filter(w => w.id !== id),
      layouts: prev.layouts.filter(l => l.i !== id),
    }))
    void fetch(`/api/widgets/${id}`, { method: "DELETE" }).catch(() => {})
  }, [])

  const duplicate = useCallback(async (id: string) => {
    const original = store.widgets.find(w => w.id === id)
    if (!original) return
    await add({
      type: original.type,
      title: `${original.title} (Copy)`,
      data: original.data,
      spec: original.spec,
    })
  }, [store.widgets, add])

  const updateLayouts = useCallback((newLayouts: LayoutItem[]) => {
    setStore(prev => ({ ...prev, layouts: newLayouts }))
    if (layoutTimer.current) clearTimeout(layoutTimer.current)
    layoutTimer.current = setTimeout(() => {
      void fetch(`/api/dashboards/${dashboardId}/widgets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLayouts),
      }).catch(() => {})
    }, 500)
  }, [dashboardId])

  const rename = useCallback((id: string, title: string) => {
    setStore(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => (w.id === id ? { ...w, title } : w)),
    }))
    void fetch(`/api/widgets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).catch(() => {})
  }, [])

  const updateSpec = useCallback((id: string, spec: WidgetSpec) => {
    setStore(prev => ({
      ...prev,
      widgets: prev.widgets.map(w =>
        w.id === id ? { ...w, spec, type: spec.type, title: spec.title } : w
      ),
    }))
    void fetch(`/api/widgets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec }),
    }).catch(() => {})
  }, [])

  // Re-run a widget's stored query and swap in the fresh rows.
  const refresh = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/widgets/${id}/refresh`, { method: "POST" })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error ?? "Refresh failed")
    }
    const updated = (await res.json()) as Widget
    setStore(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => (w.id === id ? { ...w, data: updated.data } : w)),
    }))
  }, [])

  const refreshAll = useCallback(async (): Promise<{ ok: number; failed: number }> => {
    const targets = store.widgets.filter(w => w.query && w.dataSourceId)
    const results = await Promise.allSettled(targets.map(w => refresh(w.id)))
    return {
      ok: results.filter(r => r.status === "fulfilled").length,
      failed: results.filter(r => r.status === "rejected").length,
    }
  }, [store.widgets, refresh])

  useEffect(() => {
    return () => {
      if (layoutTimer.current) clearTimeout(layoutTimer.current)
    }
  }, [])

  return {
    widgets: store.widgets,
    layouts: store.layouts,
    initialized,
    add,
    remove,
    duplicate,
    updateLayouts,
    rename,
    updateSpec,
    refresh,
    refreshAll,
  }
}
