"use client"

import { X, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Hash, Table } from "lucide-react"
import React, { useState } from "react"
import type { Widget } from "@/lib/types"

type WidgetType = Widget["type"]

interface AddWidgetModalProps {
  onClose: () => void
  onAdd: (widget: Omit<Widget, "id">) => void
}

const widgetTypes: Array<{ type: WidgetType; name: string; icon: React.ElementType; description: string }> = [
  { type: "line-chart", name: "Line Chart", icon: LineChartIcon, description: "Show trends over time" },
  { type: "bar-chart", name: "Bar Chart", icon: BarChart3, description: "Compare values across categories" },
  { type: "pie-chart", name: "Pie Chart", icon: PieChartIcon, description: "Show proportions and percentages" },
  { type: "stat", name: "Stat Card", icon: Hash, description: "Display key metrics and numbers" },
  { type: "table", name: "Data Table", icon: Table, description: "Show detailed tabular data" },
]

export function AddWidgetModal({ onClose, onAdd }: AddWidgetModalProps) {
  const [selectedType, setSelectedType] = useState<WidgetType | "">("")

  const handleAdd = () => {
    if (!selectedType) return

    // Mock data based on widget type
    let mockData
    let title = ""

    switch (selectedType) {
      case "line-chart":
        title = "New Line Chart"
        mockData = [
          { name: "Mon", value: 100 },
          { name: "Tue", value: 150 },
          { name: "Wed", value: 120 },
          { name: "Thu", value: 180 },
          { name: "Fri", value: 200 },
        ]
        break
      case "bar-chart":
        title = "New Bar Chart"
        mockData = [
          { name: "Category A", value: 400 },
          { name: "Category B", value: 300 },
          { name: "Category C", value: 500 },
        ]
        break
      case "pie-chart":
        title = "New Pie Chart"
        mockData = [
          { name: "Segment A", value: 30 },
          { name: "Segment B", value: 25 },
          { name: "Segment C", value: 45 },
        ]
        break
      case "stat":
        title = "New Metric"
        mockData = { value: 1234, change: 5.2, trend: "up" }
        break
      case "table":
        title = "New Table"
        mockData = [
          { id: 1, name: "Item A", value: 100 },
          { id: 2, name: "Item B", value: 200 },
          { id: 3, name: "Item C", value: 150 },
        ]
        break
    }

    if (!selectedType) return
    onAdd({
      type: selectedType,
      title,
      data: mockData,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Add Widget</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-600 mb-6">Choose a widget type to add to your dashboard</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {widgetTypes.map((widget) => {
              const Icon = widget.icon
              return (
                <button
                  key={widget.type}
                  onClick={() => setSelectedType(widget.type)}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    selectedType === widget.type
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${
                      selectedType === widget.type ? "bg-blue-100" : "bg-gray-100"
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        selectedType === widget.type ? "text-blue-600" : "text-gray-600"
                      }`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{widget.name}</h3>
                      <p className="text-sm text-gray-500">{widget.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!selectedType}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Add Widget
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddWidgetModal
