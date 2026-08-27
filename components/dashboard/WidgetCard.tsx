"use client"

import { MoreVertical, Copy, Trash2, GripVertical, Pencil } from "lucide-react"
import { useState, useRef } from "react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { normalizeChartData, seriesLabel, compactNumber, truncateLabel } from "@/lib/widget-data"
import { applySpec, type ChartView } from "@/lib/widget-spec"
import type { Widget } from "@/lib/types"

interface WidgetCardProps {
  widget: Pick<Widget, "id" | "type" | "title" | "data" | "spec">
  onDelete: () => void
  onDuplicate: () => void
  onRename: (title: string) => void
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']

const AXIS = "#6b7280"
const GRID = "#e5e7eb"

// Stable label renderer — must not be defined inline or inside a component
// to avoid Recharts treating it as a new component on every render (causes infinite re-renders)
const PieLabel = ({ name, percent }: { name?: string; percent?: number }) =>
  (percent ?? 0) >= 0.04
    ? `${truncateLabel(name, 12)} ${((percent ?? 0) * 100).toFixed(0)}%`
    : ""

const truncTick = (v: unknown) => truncateLabel(v, 16)
const compactTick = (v: unknown) => compactNumber(v)

// Makes a recharts chart fill the widget body at any size.
function ChartFrame({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-full w-full min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export function WidgetCard({ widget, onDelete, onDuplicate, onRename }: WidgetCardProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(widget.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const startRename = () => {
    setRenameValue(widget.title)
    setIsRenaming(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== widget.title) onRename(trimmed)
    setIsRenaming(false)
  }

  const view: ChartView = widget.spec
    ? applySpec(widget.data, widget.spec)
    : normalizeChartData(widget.data)

  const renderContent = () => {
    switch (widget.type) {
      case "line-chart": {
        const { rows, xKey, series } = view
        return (
          <ChartFrame>
            <LineChart data={rows} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis
                dataKey={xKey}
                stroke={AXIS}
                tick={{ fontSize: 11 }}
                tickFormatter={truncTick}
                minTickGap={16}
              />
              <YAxis stroke={AXIS} tick={{ fontSize: 11 }} width={44} tickFormatter={compactTick} />
              <Tooltip formatter={(v) => compactNumber(v)} />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {series.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={seriesLabel(key)}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ChartFrame>
        )
      }

      case "bar-chart": {
        const { rows, xKey, series } = view
        return (
          <ChartFrame>
            <BarChart data={rows} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis
                dataKey={xKey}
                stroke={AXIS}
                tick={{ fontSize: 11 }}
                tickFormatter={truncTick}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={64}
              />
              <YAxis stroke={AXIS} tick={{ fontSize: 11 }} width={44} tickFormatter={compactTick} />
              <Tooltip formatter={(v) => compactNumber(v)} />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {series.map((key, i) => (
                <Bar key={key} dataKey={key} name={seriesLabel(key)} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ChartFrame>
        )
      }

      case "pie-chart": {
        const { rows, xKey, series } = view
        const valueKey = series[0] ?? "value"
        return (
          <ChartFrame>
            <PieChart>
              <Pie
                data={rows}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={PieLabel}
                nameKey={xKey}
                dataKey={valueKey}
                outerRadius="80%"
                fill="#8884d8"
              >
                {rows.map((_entry, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => compactNumber(v)} />
            </PieChart>
          </ChartFrame>
        )
      }

      case "stat": {
        const key = view.series[0]
        const raw = widget.spec
          ? view.rows[0]?.[key]
          : (widget.data as { value?: unknown } | null)?.value
        const num = Number(raw)
        const display = Number.isFinite(num)
          ? num > 9999
            ? num.toLocaleString()
            : String(num)
          : String(raw ?? "—")
        return (
          <div className="h-full flex flex-col justify-center">
            <div className="text-4xl font-bold text-gray-900 tabular-nums">{display}</div>
            {widget.spec && key && (
              <div className="text-sm text-gray-500 mt-1">{seriesLabel(key)}</div>
            )}
          </div>
        )
      }

      case "table": {
        const tableData = view.rows
        return (
          <div className="h-full overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {Object.keys(tableData[0] || {}).map((key) => (
                    <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, idx: number) => (
                  <tr key={idx} className="border-b border-gray-100">
                    {Object.values(row).map((value, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-2 text-gray-900">
                        {String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      default:
        return <div className="text-gray-500">Unknown widget type</div>
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between drag-handle cursor-move bg-gray-50">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />
          {isRenaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === "Enter") commitRename()
                if (e.key === "Escape") setIsRenaming(false)
              }}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              className="flex-1 font-semibold text-gray-900 bg-white border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-text"
            />
          ) : (
            <h3
              className="font-semibold text-gray-900 truncate cursor-text"
              onDoubleClick={startRename}
              title="Double-click to rename"
            >
              {widget.title}
            </h3>
          )}
        </div>
        <div className="shrink-0 ml-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              onMouseDown={e => e.stopPropagation()}
              className="text-gray-400 hover:text-gray-600 transition-colors outline-none"
              aria-label="Widget options"
            >
              <MoreVertical className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onMouseDown={e => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => startRename()}>
                <Pencil className="w-4 h-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDuplicate()}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onDelete()}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-3">
        {renderContent()}
      </div>
    </div>
  )
}

export default WidgetCard
