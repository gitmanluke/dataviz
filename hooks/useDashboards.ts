"use client"

import { useState, useEffect, useCallback } from "react"
import { getStore, setStore } from "@/lib/store"
import type { Dashboard } from "@/lib/types"

const STORE_KEY = "dashboards"

export function useDashboards() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    setDashboards(getStore<Dashboard[]>(STORE_KEY, []))
    setInitialized(true)
  }, [])

  // All mutations use the functional form of setDashboards so they don't
  // close over `dashboards` state — this lets useCallback use [] deps,
  // giving stable function references that are safe in useEffect dep arrays.

  const create = useCallback((name: string, description = ""): Dashboard => {
    const newDashboard: Dashboard = {
      id: `dashboard-${Date.now()}`,
      name,
      description,
      lastViewed: new Date().toISOString(),
      isFavorite: false,
      widgetCount: 0,
    }
    setDashboards(prev => {
      const updated = [...prev, newDashboard]
      setStore(STORE_KEY, updated)
      return updated
    })
    return newDashboard
  }, [])

  const update = useCallback((id: string, changes: Partial<Dashboard>) => {
    setDashboards(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, ...changes } : d)
      setStore(STORE_KEY, updated)
      return updated
    })
  }, [])

  const remove = useCallback((id: string) => {
    setDashboards(prev => {
      const updated = prev.filter(d => d.id !== id)
      setStore(STORE_KEY, updated)
      return updated
    })
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    setDashboards(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, isFavorite: !d.isFavorite } : d)
      setStore(STORE_KEY, updated)
      return updated
    })
  }, [])

  const updateLastViewed = useCallback((id: string) => {
    setDashboards(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, lastViewed: new Date().toISOString() } : d)
      setStore(STORE_KEY, updated)
      return updated
    })
  }, [])

  return { dashboards, initialized, create, update, remove, toggleFavorite, updateLastViewed }
}
