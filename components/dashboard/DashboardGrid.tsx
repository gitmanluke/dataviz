"use client"

import { useState, useEffect, useRef } from "react"
import { Sparkles } from "lucide-react"
import { WidgetCard } from "./WidgetCard"
import dynamic from "next/dynamic"
import type { Layout } from "react-grid-layout"
import { toast } from "sonner"
import type { Widget, LayoutItem, WidgetSpec } from "@/lib/types"
import "react-grid-layout/css/styles.css"

const GridLayout = dynamic(() => import("react-grid-layout"), { ssr: false })

interface DashboardGridProps {
  dashboardId: string
  widgets: Widget[]
  layouts: LayoutItem[]
  initialized: boolean
  onAdd: (widget: Omit<Widget, "id">) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onRename: (id: string, title: string) => void
  onUpdateSpec: (id: string, spec: WidgetSpec) => void
  onLayoutChange: (newLayouts: LayoutItem[]) => void
}

export function DashboardGrid({
  widgets,
  layouts,
  initialized,
  onRemove,
  onDuplicate,
  onRename,
  onUpdateSpec,
  onLayoutChange,
}: DashboardGridProps) {
  const [gridWidth, setGridWidth] = useState(1200)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateWidth = () => {
      if (gridRef.current) setGridWidth(gridRef.current.offsetWidth)
    }
    updateWidth()
    window.addEventListener("resize", updateWidth)
    return () => window.removeEventListener("resize", updateWidth)
  }, [])

  if (!initialized) {
    return (
      <div className="animate-pulse grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 bg-gray-200 rounded-lg" />
        ))}
      </div>
    )
  }

  if (widgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white border-2 border-dashed border-gray-200 rounded-xl text-center px-8">
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-full p-3 mb-4">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No widgets yet</h3>
        <p className="text-sm text-gray-500 max-w-xs">
          Open the AI Assistant and ask a question about your data — widgets will be created automatically from the results.
        </p>
      </div>
    )
  }

  return (
    <div ref={gridRef}>
      <GridLayout
        className="layout"
        layout={layouts}
        cols={12}
        rowHeight={100}
        width={gridWidth}
        onLayoutChange={(newLayout: Layout[]) => onLayoutChange(newLayout as LayoutItem[])}
        draggableHandle=".drag-handle"
        compactType="vertical"
        preventCollision={false}
      >
        {widgets.map(widget => (
          <div key={widget.id}>
            <WidgetCard
              widget={widget}
              onDelete={() => { onRemove(widget.id); toast.success("Widget removed") }}
              onDuplicate={() => { onDuplicate(widget.id); toast.success("Widget duplicated") }}
              onRename={(title) => onRename(widget.id, title)}
              onUpdateSpec={(spec) => onUpdateSpec(widget.id, spec)}
            />
          </div>
        ))}
      </GridLayout>
    </div>
  )
}

export default DashboardGrid
