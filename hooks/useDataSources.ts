"use client"

import { useCallback, useEffect, useState } from "react"
import type { DataSource, NewDataSource } from "@/lib/types"

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

export function useDataSources() {
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/data-sources")
      .then(res => (res.ok ? res.json() : []))
      .then((rows: DataSource[]) => {
        if (!cancelled) setDataSources(rows)
      })
      .catch(() => {
        if (!cancelled) setDataSources([])
      })
      .finally(() => {
        if (!cancelled) setInitialized(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Verifies + persists server-side. Throws Error(message) on failure.
  const add = useCallback(async (input: NewDataSource): Promise<DataSource> => {
    const res = await fetch("/api/data-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(await readError(res))
    const created = (await res.json()) as DataSource
    setDataSources(prev => [created, ...prev])
    return created
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/data-sources/${id}`, { method: "DELETE" })
    if (!res.ok && res.status !== 404) throw new Error(await readError(res))
    setDataSources(prev => prev.filter(ds => ds.id !== id))
  }, [])

  return { dataSources, initialized, add, remove }
}
