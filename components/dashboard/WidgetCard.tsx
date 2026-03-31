"use client"

import { MoreVertical, Copy, Trash2, TrendingUp, TrendingDown, GripVertical, Pencil } from "lucide-react"
import { useState, useRef } from "react"
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface WidgetCardProps {
  widget: {
    id: string
    type: string
    title: string
    data: unknown
  }
  onDelete: () => void
  onDuplicate: () => void
  onRename: (title: string) => void
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']

// Stable label renderer — must not be defined inline or inside a component
// to avoid Recharts treating it as a new component on every render (causes infinite re-renders)
const PieLabel = ({ name, percent }: { name?: string; percent?: number }) =>
  `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`

export function WidgetCard({ widget, onDelete, onDuplicate, onRename }: WidgetCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(widget.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const startRename = () => {
    setRenameValue(widget.title)
    setIsRenaming(true)
    setShowMenu(false)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== widget.title) onRename(trimmed)
    setIsRenaming(false)
  }

  const renderContent = () => {
    switch (widget.type) {
      case "line-chart": {
        const chartData = widget.data as Array<Record<string, unknown>>
        return (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )
      }

      case "bar-chart": {
        const chartData = widget.data as Array<Record<string, unknown>>
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        )
      }

      case "pie-chart": {
        const pieData = widget.data as Array<Record<string, unknown>>
        return (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={PieLabel}
                outerRadius={60}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((_entry, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )
      }

      case "stat": {
        const statData = widget.data as { value: number; change: number; trend: string }
        return (
          <div className="py-8">
            <div className="text-4xl font-bold text-gray-900 mb-2">
              {typeof statData.value === 'number' && statData.value > 1000
                ? statData.value.toLocaleString()
                : statData.value}
            </div>
            <div className={`inline-flex items-center text-sm ${
              statData.trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {statData.trend === 'up' ? (
                <TrendingUp className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-1" />
              )}
              {Math.abs(statData.change)}% vs last period
            </div>
          </div>
        )
      }

      case "table": {
        const tableData = widget.data as Array<Record<string, unknown>>
        return (
          <div className="overflow-x-auto">
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
        <div className="relative shrink-0 ml-2">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                <button
                  onClick={startRename}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Rename
                </button>
                <button
                  onClick={() => { onDuplicate(); setShowMenu(false) }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </button>
                <button
                  onClick={() => { onDelete(); setShowMenu(false) }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="p-4 flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  )
}

export default WidgetCard
