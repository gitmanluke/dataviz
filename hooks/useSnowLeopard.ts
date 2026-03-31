"use client"

import { useState, useCallback } from "react"
import type { Widget } from "@/lib/types"

export interface DetectedWidget {
  widgetType: Widget["type"]
  title: string
  data: unknown
  confidence: "high" | "medium" | "low"
  sql?: string
  explanation?: string | null
}

export function useSnowLeopard({ datafileId, apiKey }: { datafileId: string; apiKey: string }) {
  const [isLoading, setIsLoading] = useState(false)

  const retrieve = useCallback(async (userQuery: string): Promise<DetectedWidget | null> => {
    if (!datafileId || !apiKey) return null
    setIsLoading(true)
    try {
      const res = await fetch("/api/ai/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userQuery, datafileId, apiKey }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? "Retrieve failed")
      }
      return await res.json() as DetectedWidget
    } finally {
      setIsLoading(false)
    }
  }, [datafileId, apiKey])

  return { isLoading, retrieve }
}
