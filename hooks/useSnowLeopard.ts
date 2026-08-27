"use client"

import { useState, useCallback } from "react"
import type { WidgetSpec } from "@/lib/types"

export interface WidgetResult {
  spec: WidgetSpec
  rows: Record<string, unknown>[]
  sql?: string
  explanation?: string | null
  truncated?: boolean
  usedAgent?: boolean
}

export function useSnowLeopard({ dataSourceId }: { dataSourceId: string }) {
  const [isLoading, setIsLoading] = useState(false)

  const retrieve = useCallback(
    async (userQuery: string, priorSpec?: WidgetSpec): Promise<WidgetResult | null> => {
      if (!dataSourceId) return null
      setIsLoading(true)
      try {
        const res = await fetch("/api/ai/retrieve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userQuery, dataSourceId, priorSpec }),
        })
        if (!res.ok) {
          const err = (await res.json()) as { error?: string }
          throw new Error(err.error ?? "Retrieve failed")
        }
        return (await res.json()) as WidgetResult
      } finally {
        setIsLoading(false)
      }
    },
    [dataSourceId]
  )

  return { isLoading, retrieve }
}
