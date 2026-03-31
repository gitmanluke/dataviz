"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, TrendingUp, Star, Clock, MoreVertical, Pencil, Copy, Trash2 } from "lucide-react"
import { useDashboards } from "@/hooks/useDashboards"
import type { Dashboard } from "@/lib/types"

export function HomeClient() {
  const router = useRouter()
  const { dashboards, initialized, create, remove, update, toggleFavorite, updateLastViewed } = useDashboards()

  if (!initialized) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-4 bg-gray-200 rounded w-96" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const handleCreateDashboard = () => {
    const newDashboard = create("New Dashboard")
    router.push(`/dashboard/${newDashboard.id}`)
  }

  const favoriteDashboards = dashboards.filter(d => d.isFavorite)
  const recentDashboards = [...dashboards]
    .sort((a, b) => new Date(b.lastViewed).getTime() - new Date(a.lastViewed).getTime())
    .slice(0, 3)

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Hub</h1>
        <p className="text-gray-600">Quick access to your dashboards and analytics</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <button
          onClick={handleCreateDashboard}
          className="bg-blue-600 text-white rounded-lg p-6 hover:bg-blue-700 transition-colors flex items-center space-x-4 text-left"
        >
          <div className="bg-white/20 rounded-full p-3">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <div className="font-semibold">Create Dashboard</div>
            <div className="text-sm text-blue-100">Start with a blank canvas</div>
          </div>
        </button>

        <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-center space-x-4">
          <div className="bg-purple-100 rounded-full p-3">
            <TrendingUp className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{dashboards.length} Dashboards</div>
            <div className="text-sm text-gray-500">Total active</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-center space-x-4">
          <div className="bg-green-100 rounded-full p-3">
            <Star className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{favoriteDashboards.length} Favorites</div>
            <div className="text-sm text-gray-500">Quick access</div>
          </div>
        </div>
      </div>

      {/* Favorite Dashboards */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Star className="w-5 h-5 mr-2 text-yellow-500 fill-yellow-500" />
          Favorite Dashboards
        </h2>
        {favoriteDashboards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favoriteDashboards.map(dashboard => (
              <DashboardCard
                key={dashboard.id}
                dashboard={dashboard}
                onToggleFavorite={toggleFavorite}
                onUpdateLastViewed={updateLastViewed}
                onRename={(id, name) => update(id, { name })}
                onDuplicate={(d) => create(`${d.name} (Copy)`, d.description)}
                onDelete={remove}
                formatDate={formatDate}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No favorite dashboards yet</p>
            <p className="text-sm text-gray-400 mt-1">Click the star icon on any dashboard to add it here</p>
          </div>
        )}
      </div>

      {/* Recently Viewed */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-gray-600" />
          Recently Viewed
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentDashboards.map(dashboard => (
            <DashboardCard
              key={dashboard.id}
              dashboard={dashboard}
              onToggleFavorite={toggleFavorite}
              onUpdateLastViewed={updateLastViewed}
              onRename={(id, name) => update(id, { name })}
              onDuplicate={(d) => create(`${d.name} (Copy)`, d.description)}
              onDelete={remove}
              formatDate={formatDate}
            />
          ))}
        </div>
      </div>

      {/* All Dashboards */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">All Dashboards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map(dashboard => (
            <DashboardCard
              key={dashboard.id}
              dashboard={dashboard}
              onToggleFavorite={toggleFavorite}
              onUpdateLastViewed={updateLastViewed}
              onRename={(id, name) => update(id, { name })}
              onDuplicate={(d) => create(`${d.name} (Copy)`, d.description)}
              onDelete={remove}
              formatDate={formatDate}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface DashboardCardProps {
  dashboard: Dashboard
  onToggleFavorite: (id: string) => void
  onUpdateLastViewed: (id: string) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (dashboard: Dashboard) => void
  onDelete: (id: string) => void
  formatDate: (isoString: string) => string
}

function DashboardCard({
  dashboard,
  onToggleFavorite,
  onUpdateLastViewed,
  onRename,
  onDuplicate,
  onDelete,
  formatDate,
}: DashboardCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(dashboard.name)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== dashboard.name) {
      onRename(dashboard.id, trimmed)
    } else {
      setRenameValue(dashboard.name)
    }
    setIsRenaming(false)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitRename()
    } else if (e.key === "Escape") {
      setRenameValue(dashboard.name)
      setIsRenaming(false)
    }
  }

  const startRename = () => {
    setRenameValue(dashboard.name)
    setIsRenaming(true)
    setShowMenu(false)
    // Focus next tick so element is rendered
    setTimeout(() => renameInputRef.current?.select(), 0)
  }

  return (
    <div className="relative bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-2">
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKeyDown}
              className="w-full font-semibold text-gray-900 border border-blue-400 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={(e) => e.preventDefault()}
            />
          ) : (
            <Link
              href={`/dashboard/${dashboard.id}`}
              onClick={() => onUpdateLastViewed(dashboard.id)}
              className="block"
            >
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                {dashboard.name}
              </h3>
            </Link>
          )}
          <p className="text-sm text-gray-500 mt-1 truncate">{dashboard.description}</p>
        </div>

        <div className="flex items-center space-x-1 flex-shrink-0">
          {/* Favorite */}
          <button
            onClick={(e) => {
              e.preventDefault()
              onToggleFavorite(dashboard.id)
            }}
            className="text-gray-400 hover:text-yellow-500 transition-colors p-1"
          >
            <Star
              className={`w-4 h-4 ${dashboard.isFavorite ? 'fill-yellow-500 text-yellow-500' : ''}`}
            />
          </button>

          {/* Three-dot menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.preventDefault()
                setShowMenu(!showMenu)
                setShowDeleteConfirm(false)
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => {
                    setShowMenu(false)
                    setShowDeleteConfirm(false)
                  }}
                />
                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                  {showDeleteConfirm ? (
                    <div className="p-3 space-y-2">
                      <p className="text-sm text-gray-700">Delete this dashboard?</p>
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            onDelete(dashboard.id)
                            setShowMenu(false)
                          }}
                          className="flex-1 px-2 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            setShowDeleteConfirm(false)
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          startRename()
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          onDuplicate(dashboard)
                          setShowMenu(false)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          setShowDeleteConfirm(true)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Link
        href={`/dashboard/${dashboard.id}`}
        onClick={() => onUpdateLastViewed(dashboard.id)}
        className="flex items-center justify-between text-sm text-gray-500"
      >
        <span>{dashboard.widgetCount} widgets</span>
        <span className="flex items-center">
          <Clock className="w-4 h-4 mr-1" />
          {formatDate(dashboard.lastViewed)}
        </span>
      </Link>
    </div>
  )
}

export default HomeClient
