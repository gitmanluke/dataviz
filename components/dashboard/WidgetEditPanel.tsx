"use client"

import { useMemo } from "react"
import { BarChart3, LineChart, PieChart, Hash, Table } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { detectSpec } from "@/lib/widget-detector"
import type { Widget, WidgetSpec, WidgetType } from "@/lib/types"

const TYPES: Array<{ value: WidgetType; label: string; Icon: typeof BarChart3 }> = [
  { value: "bar-chart", label: "Bar", Icon: BarChart3 },
  { value: "line-chart", label: "Line", Icon: LineChart },
  { value: "pie-chart", label: "Pie", Icon: PieChart },
  { value: "stat", label: "Stat", Icon: Hash },
  { value: "table", label: "Table", Icon: Table },
]

function columnsOf(data: unknown): { all: string[]; numeric: string[] } {
  const rows = Array.isArray(data)
    ? (data as Array<Record<string, unknown>>)
    : data && typeof data === "object" && Array.isArray((data as { rows?: unknown }).rows)
      ? ((data as { rows: Array<Record<string, unknown>> }).rows)
      : []
  if (rows.length === 0) return { all: [], numeric: [] }
  const all = Object.keys(rows[0])
  const numeric = all.filter(c =>
    rows.slice(0, 20).some(r => {
      const v = r[c]
      return typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)))
    })
  )
  return { all, numeric }
}

interface Props {
  widget: Pick<Widget, "type" | "title" | "data" | "spec">
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (spec: WidgetSpec) => void
}

export function WidgetEditPanel({ widget, open, onOpenChange, onChange }: Props) {
  const { all, numeric } = useMemo(() => columnsOf(widget.data), [widget.data])

  // Current spec, synthesised for legacy widgets that don't have one.
  const spec: WidgetSpec = useMemo(() => {
    if (widget.spec) return widget.spec
    const rows = Array.isArray(widget.data) ? widget.data : []
    return detectSpec(rows, widget.title)
  }, [widget.spec, widget.data, widget.title])

  const set = (patch: Partial<WidgetSpec>) => onChange({ ...spec, ...patch })

  const toggleSeries = (col: string) => {
    const next = spec.series.includes(col)
      ? spec.series.filter(s => s !== col)
      : [...spec.series, col]
    set({ series: next.length > 0 ? next : spec.series })
  }

  const isChart = spec.type === "bar-chart" || spec.type === "line-chart" || spec.type === "pie-chart"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-sm overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit widget</SheetTitle>
          <SheetDescription>Changes apply immediately.</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-5">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <ToggleGroup
              type="single"
              value={spec.type}
              onValueChange={(v) => v && set({ type: v as WidgetType })}
              className="justify-start flex-wrap gap-1"
            >
              {TYPES.map(({ value, label, Icon }) => (
                <ToggleGroupItem key={value} value={value} aria-label={label} className="flex-col h-auto py-2 px-3 gap-1">
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px]">{label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="w-title">Title</Label>
            <Input
              id="w-title"
              value={spec.title}
              onChange={e => set({ title: e.target.value })}
            />
          </div>

          {isChart && (
            <div className="space-y-1.5">
              <Label>X-axis</Label>
              <Select value={spec.xKey} onValueChange={(v) => set({ xKey: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a column" />
                </SelectTrigger>
                <SelectContent>
                  {all.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(isChart || spec.type === "stat") && (
            <div className="space-y-1.5">
              <Label>{spec.type === "stat" || spec.type === "pie-chart" ? "Value" : "Series"}</Label>
              <div className="space-y-1.5 rounded-md border border-gray-200 p-2">
                {numeric.length === 0 && (
                  <p className="text-xs text-gray-400">No numeric columns</p>
                )}
                {numeric.map(c => {
                  const single = spec.type === "stat" || spec.type === "pie-chart"
                  return (
                    <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={spec.series.includes(c)}
                        onCheckedChange={() =>
                          single ? set({ series: [c] }) : toggleSeries(c)
                        }
                      />
                      {c}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {isChart && (
            <div className="space-y-1.5">
              <Label>Sort</Label>
              <Select
                value={spec.sort ?? "none"}
                onValueChange={(v) => set({ sort: v as WidgetSpec["sort"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Original order</SelectItem>
                  <SelectItem value="desc">Highest first</SelectItem>
                  <SelectItem value="asc">Lowest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
