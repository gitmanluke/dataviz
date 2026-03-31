"use client"

import { X, Clock, Bell, AlertTriangle, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { Dashboard } from "@/lib/types"

interface DashboardSettingsProps {
  dashboard: Dashboard
  onClose: () => void
  onUpdate: (changes: Partial<Dashboard>) => void
  onDelete: () => void
}

export function DashboardSettings({ dashboard, onClose, onUpdate, onDelete }: DashboardSettingsProps) {
  const [name, setName] = useState(dashboard.name)
  const [description, setDescription] = useState(dashboard.description)
  const [refreshInterval, setRefreshInterval] = useState("15")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [scheduledAlerts, setScheduledAlerts] = useState([
    { id: "1", name: "Daily Summary", time: "09:00", enabled: true },
    { id: "2", name: "Weekly Report", time: "Monday 08:00", enabled: false },
  ])
  const [thresholdAlerts, setThresholdAlerts] = useState([
    { id: "1", metric: "Revenue", condition: "below", value: "10000", enabled: true },
    { id: "2", metric: "Customers", condition: "above", value: "1000", enabled: true },
  ])

  const handleSave = () => {
    onUpdate({ name: name.trim() || dashboard.name, description })
    toast.success("Dashboard settings saved successfully!")
    onClose()
  }

  const handleDelete = () => {
    onDelete()
    toast.success("Dashboard deleted")
    onClose()
  }

  const toggleScheduledAlert = (id: string) => {
    setScheduledAlerts(prev =>
      prev.map(alert =>
        alert.id === id ? { ...alert, enabled: !alert.enabled } : alert
      )
    )
  }

  const toggleThresholdAlert = (id: string) => {
    setThresholdAlerts(prev =>
      prev.map(alert =>
        alert.id === id ? { ...alert, enabled: !alert.enabled } : alert
      )
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Dashboard Settings</h2>
            <p className="text-sm text-gray-500 mt-1">{dashboard.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Name & Description */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">General</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dashboard Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Dashboard name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Optional description"
                />
              </div>
            </div>
          </div>

          {/* Refresh Interval */}
          <div>
            <div className="flex items-center mb-4">
              <Clock className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Refresh Interval</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              How often should this dashboard automatically refresh its data?
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: "5", label: "5 minutes" },
                { value: "15", label: "15 minutes" },
                { value: "30", label: "30 minutes" },
                { value: "60", label: "1 hour" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setRefreshInterval(option.value)}
                  className={`px-4 py-3 rounded-md border-2 transition-all ${
                    refreshInterval === option.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scheduled Alerts */}
          <div>
            <div className="flex items-center mb-4">
              <Bell className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Scheduled Alerts</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Receive regular updates about this dashboard at scheduled times
            </p>
            <div className="space-y-3">
              {scheduledAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{alert.name}</div>
                    <div className="text-sm text-gray-500">{alert.time}</div>
                  </div>
                  <button
                    onClick={() => toggleScheduledAlert(alert.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      alert.enabled ? "bg-blue-600" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        alert.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              ))}
              <button className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors">
                + Add Scheduled Alert
              </button>
            </div>
          </div>

          {/* Threshold Alerts */}
          <div>
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Threshold Alerts</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Get notified when metrics cross specific thresholds
            </p>
            <div className="space-y-3">
              {thresholdAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {alert.metric} {alert.condition} {alert.value}
                    </div>
                    <div className="text-sm text-gray-500">
                      Alert when {alert.metric.toLowerCase()} is {alert.condition} {alert.value}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleThresholdAlert(alert.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      alert.enabled ? "bg-blue-600" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        alert.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              ))}
              <button className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors">
                + Add Threshold Alert
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="border border-red-200 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-red-700 mb-2">Danger Zone</h3>
            {showDeleteConfirm ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">
                  Are you sure you want to delete <strong>{dashboard.name}</strong>? This action cannot be undone.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                  >
                    Yes, Delete Dashboard
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md text-red-700 hover:bg-red-50 transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Dashboard
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}

export default DashboardSettings
