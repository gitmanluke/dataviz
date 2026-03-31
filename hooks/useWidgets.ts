"use client"

import { useState, useEffect, useCallback } from "react"
import { getStore, setStore } from "@/lib/store"
import type { Widget, LayoutItem, DashboardStore } from "@/lib/types"

const EMPTY: DashboardStore = { widgets: [], layouts: [] }

export function useWidgets(dashboardId: string) {
  const storeKey = `widgets:${dashboardId}`

  const [store, setStore_] = useState<DashboardStore>(EMPTY)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!dashboardId) return
    const stored = getStore<DashboardStore>(storeKey, EMPTY)
    setStore_(stored)
    setInitialized(true)
  }, [dashboardId, storeKey])

  const save = useCallback((updater: (prev: DashboardStore) => DashboardStore, key: string) => {
    setStore_(prev => {
      const next = updater(prev)
      setStore<DashboardStore>(key, next)
      return next
    })
  }, [])

  const add = useCallback((widget: Omit<Widget, "id">): Widget => {
    const newWidget: Widget = { ...widget, id: String(Date.now()) }
    const newLayout: LayoutItem = { i: newWidget.id, x: 0, y: Infinity, w: 4, h: 3, minW: 2, minH: 2 }
    save(prev => ({
      widgets: [...prev.widgets, newWidget],
      layouts: [...prev.layouts, newLayout],
    }), storeKey)
    return newWidget
  }, [save, storeKey])

  const remove = useCallback((id: string) => {
    save(prev => ({
      widgets: prev.widgets.filter(w => w.id !== id),
      layouts: prev.layouts.filter(l => l.i !== id),
    }), storeKey)
  }, [save, storeKey])

  const duplicate = useCallback((id: string) => {
    save(prev => {
      const original = prev.widgets.find(w => w.id === id)
      if (!original) return prev
      const newWidget: Widget = { ...original, id: String(Date.now()), title: original.title + " (Copy)" }
      const newLayout: LayoutItem = { i: newWidget.id, x: 0, y: Infinity, w: 4, h: 3, minW: 2, minH: 2 }
      return {
        widgets: [...prev.widgets, newWidget],
        layouts: [...prev.layouts, newLayout],
      }
    }, storeKey)
  }, [save, storeKey])

  const updateLayouts = useCallback((newLayouts: LayoutItem[]) => {
    save(prev => ({ ...prev, layouts: newLayouts }), storeKey)
  }, [save, storeKey])

  const rename = useCallback((id: string, title: string) => {
    save(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => w.id === id ? { ...w, title } : w),
    }), storeKey)
  }, [save, storeKey])

  return {
    widgets: store.widgets,
    layouts: store.layouts,
    initialized,
    add,
    remove,
    duplicate,
    updateLayouts,
    rename,
  }
}
