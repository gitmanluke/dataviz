"use client"

import { useState, useEffect } from "react"
import { getStore, setStore } from "@/lib/store"
import type { DataSource } from "@/lib/types"

const STORE_KEY = "datasources"

// Start empty — users will add their own SnowLeopard connections
const INITIAL: DataSource[] = []

export function useDataSources() {
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const stored = getStore<DataSource[]>(STORE_KEY, INITIAL)
    setDataSources(stored)
    setInitialized(true)
  }, [])

  const save = (updated: DataSource[]) => {
    setDataSources(updated)
    setStore(STORE_KEY, updated)
  }

  const add = (ds: Omit<DataSource, "id" | "addedAt">): DataSource => {
    const newDs: DataSource = {
      ...ds,
      id: `ds-${Date.now()}`,
      addedAt: new Date().toISOString(),
    }
    save([...dataSources, newDs])
    return newDs
  }

  const update = (id: string, changes: Partial<DataSource>) => {
    save(dataSources.map(ds => ds.id === id ? { ...ds, ...changes } : ds))
  }

  const remove = (id: string) => {
    save(dataSources.filter(ds => ds.id !== id))
  }

  return { dataSources, initialized, add, update, remove }
}
