"use client"

import { useCallback, useEffect, useState } from "react"
import type { DataSource } from "@/lib/types"

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

  // Uploads CSV/.db files as a new "files" data source. Throws on failure.
  const upload = useCallback(async (form: FormData): Promise<DataSource> => {
    const res = await fetch("/api/data-sources/upload", { method: "POST", body: form })
    if (!res.ok) throw new Error(await readError(res))
    const created = (await res.json()) as DataSource
    setDataSources(prev => [created, ...prev])
    return created
  }, [])

  // Connects a Google spreadsheet as a new "sheets" data source. Throws on failure.
  const addSheet = useCallback(
    async (payload: {
      name?: string
      description?: string
      spreadsheetId: string
      refreshInterval?: string
    }): Promise<DataSource> => {
      const res = await fetch("/api/data-sources/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await readError(res))
      const created = (await res.json()) as DataSource
      setDataSources(prev => [created, ...prev])
      return created
    },
    [],
  )

  // Renames a source or changes a sheets source's refresh interval.
  const update = useCallback(
    async (id: string, changes: { name?: string; refreshInterval?: string }): Promise<void> => {
      const res = await fetch(`/api/data-sources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      })
      if (!res.ok) throw new Error(await readError(res))
      const updated = (await res.json()) as DataSource
      setDataSources(prev => prev.map(ds => (ds.id === id ? { ...ds, ...updated } : ds)))
    },
    [],
  )

  // Pulls the latest from Google for a sheets source. Throws on failure.
  const syncNow = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/data-sources/${id}/sync`, { method: "POST" })
    if (!res.ok) throw new Error(await readError(res))
    const updated = (await res.json()) as DataSource
    setDataSources(prev => prev.map(ds => (ds.id === id ? { ...ds, ...updated } : ds)))
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/data-sources/${id}`, { method: "DELETE" })
    if (!res.ok && res.status !== 404) throw new Error(await readError(res))
    setDataSources(prev => prev.filter(ds => ds.id !== id))
  }, [])

  return { dataSources, initialized, upload, addSheet, update, syncNow, remove }
}
