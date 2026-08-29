"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Settings, MessageSquare, RefreshCw } from "lucide-react"
import { DashboardSettings } from "@/components/dashboard/DashboardSettings"
import { ChatPanel } from "@/components/dashboard/ChatPanel"
import { DashboardGrid } from "@/components/dashboard/DashboardGrid"
import { useWidgets } from "@/hooks/useWidgets"
import { useDashboards } from "@/hooks/useDashboards"
import { toast } from "sonner"
import type { Widget, Dashboard } from "@/lib/types"

export default function DashboardPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const dashboardId = id || "default"

  const [showSettings, setShowSettings] = useState(false)
  const [showChat, setShowChat] = useState(false)

  const { widgets, layouts, initialized: widgetsInitialized, add, remove, duplicate, updateLayouts, rename, updateSpec, refresh, refreshAll } = useWidgets(dashboardId)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const { dashboards, initialized: dashboardsInitialized, create, update, remove: removeDashboard, updateLastViewed } = useDashboards()

  const hasCreated = useRef(false)

  // Handle "new" dashboard creation
  useEffect(() => {
    if (dashboardId === "new" && !hasCreated.current && dashboardsInitialized) {
      hasCreated.current = true
      create("New Dashboard").then(newDash => {
        router.replace(`/dashboard/${newDash.id}`)
      })
    }
  }, [dashboardId, dashboardsInitialized, create, router])

  // Update last viewed on mount (for real dashboards)
  useEffect(() => {
    if (dashboardId !== "new" && dashboardsInitialized) {
      updateLastViewed(dashboardId)
    }
  }, [dashboardId, dashboardsInitialized, updateLastViewed])

  const dashboard: Dashboard | undefined = dashboards.find(d => d.id === dashboardId)

  // Fallback name while loading or for unknown IDs
  const dashboardName =
    dashboard?.name ?? (dashboardId === "new" ? "New Dashboard" : "Dashboard")

  const handleAddWidget = (widget: Omit<Widget, "id">) => {
    add(widget)
    toast.success("Widget added to dashboard")
  }

  const refreshableCount = widgets.filter(w => w.query).length

  const handleRefreshAll = async () => {
    setRefreshingAll(true)
    try {
      const { ok, failed } = await refreshAll()
      if (failed > 0) toast.error(`Refreshed ${ok}, ${failed} failed`)
      else toast.success(ok === 1 ? "1 widget refreshed" : `${ok} widgets refreshed`)
    } finally {
      setRefreshingAll(false)
    }
  }

  const handleSettingsUpdate = (changes: Partial<Dashboard>) => {
    update(dashboardId, changes)
  }

  const handleSettingsDelete = () => {
    removeDashboard(dashboardId)
    router.push("/")
  }

  // Don't render settings modal if dashboard not found
  const settingsDashboard: Dashboard = dashboard ?? {
    id: dashboardId,
    name: dashboardName,
    description: "",
    lastViewed: new Date().toISOString(),
    isFavorite: false,
    widgetCount: 0,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard Header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{dashboardName}</h1>
              <p className="text-sm text-gray-500 mt-1">Last updated: {new Date().toLocaleString()}</p>
            </div>

            <div className="flex items-center space-x-3">
              {refreshableCount > 0 && (
                <button
                  onClick={handleRefreshAll}
                  disabled={refreshingAll}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshingAll ? "animate-spin" : ""}`} />
                  Refresh all
                </button>
              )}
              <button
                onClick={() => setShowChat(!showChat)}
                className={`inline-flex items-center px-4 py-2 rounded-md transition-colors ${
                  showChat
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                AI Assistant
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Dashboard Grid */}
          <div className={`flex-1 transition-all ${showChat ? 'lg:mr-0' : ''}`}>
            <DashboardGrid
              dashboardId={dashboardId}
              widgets={widgets}
              layouts={layouts}
              initialized={widgetsInitialized}
              onAdd={add}
              onRemove={remove}
              onDuplicate={duplicate}
              onRename={rename}
              onUpdateSpec={updateSpec}
              onRefresh={refresh}
              onLayoutChange={updateLayouts}
            />
          </div>

          {/* Chat Panel */}
          {showChat && (
            <div className="w-full lg:w-96 flex-shrink-0">
              <ChatPanel
                onClose={() => setShowChat(false)}
                onAddWidget={handleAddWidget}
              />
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <DashboardSettings
          dashboard={settingsDashboard}
          onClose={() => setShowSettings(false)}
          onUpdate={handleSettingsUpdate}
          onDelete={handleSettingsDelete}
        />
      )}
    </div>
  )
}
