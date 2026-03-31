"use client"

import { useState } from "react"
import { Plus, CheckCircle, AlertCircle, Loader2, Trash2, Eye, EyeOff, Database } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useDataSources } from "@/hooks/useDataSources"

interface FormState {
  name: string
  apiKey: string
  datafileId: string
  description: string
}

const EMPTY_FORM: FormState = {
  name: "",
  apiKey: "",
  datafileId: "",
  description: "",
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return "1 day ago"
  if (diffDays < 30) return `${diffDays} days ago`

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return "1 month ago"
  if (diffMonths < 12) return `${diffMonths} months ago`

  const diffYears = Math.floor(diffMonths / 12)
  return diffYears === 1 ? "1 year ago" : `${diffYears} years ago`
}

export function DataSourcesClient() {
  const { dataSources, initialized, add, remove } = useDataSources()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showApiKey, setShowApiKey] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const resetDialog = () => {
    setForm(EMPTY_FORM)
    setShowApiKey(false)
    setVerifying(false)
    setVerifyError(null)
  }

  const handleOpenDialog = () => {
    resetDialog()
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    if (verifying) return
    setDialogOpen(false)
    resetDialog()
  }

  const handleFieldChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (verifyError) setVerifyError(null)
  }

  const handleAdd = async () => {
    const { name, apiKey, datafileId, description } = form

    if (!name.trim() || !apiKey.trim() || !datafileId.trim()) {
      setVerifyError("Name, API Key, and File ID are all required.")
      return
    }

    setVerifying(true)
    setVerifyError(null)

    try {
      const res = await fetch("/api/data-sources/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), datafileId: datafileId.trim() }),
      })

      const data = await res.json()

      if (!data.ok) {
        setVerifyError(data.error ?? "Could not connect. Please check your API key and File ID.")
        setVerifying(false)
        return
      }

      add({
        name: name.trim(),
        apiKey: apiKey.trim(),
        datafileId: datafileId.trim(),
        description: description.trim() || undefined,
        status: "connected",
      })

      toast.success(`"${name.trim()}" added successfully`)
      setDialogOpen(false)
      resetDialog()
    } catch {
      setVerifyError("Network error — please try again.")
      setVerifying(false)
    }
  }

  const handleDeleteClick = (id: string) => {
    setConfirmDeleteId(id)
  }

  const handleConfirmDelete = () => {
    if (!confirmDeleteId) return
    const ds = dataSources.find(d => d.id === confirmDeleteId)
    remove(confirmDeleteId)
    toast.success(`Deleted "${ds?.name ?? "data source"}"`)
    setConfirmDeleteId(null)
  }

  const handleCancelDelete = () => {
    setConfirmDeleteId(null)
  }

  if (!initialized) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-64" />
          <div className="h-48 bg-gray-200 rounded-lg mt-8" />
        </div>
      </div>
    )
  }

  const connectedCount = dataSources.filter(ds => ds.status === "connected").length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Sources</h1>
          <p className="text-gray-600">Connect your SnowLeopard datasets</p>
        </div>
        <Button onClick={handleOpenDialog} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Data Source
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Data Sources</p>
              <p className="text-2xl font-bold text-gray-900">{dataSources.length}</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Connected</p>
              <p className="text-2xl font-bold text-gray-900">{connectedCount}</p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Data Sources Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {dataSources.length === 0 ? (
          <div className="p-16 text-center">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-700 font-medium mb-1">No data sources yet</p>
            <p className="text-sm text-gray-400 mb-6">Connect a SnowLeopard dataset to get started</p>
            <Button onClick={handleOpenDialog} variant="outline" className="flex items-center gap-2 mx-auto">
              <Plus className="w-4 h-4" />
              Add your first data source
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dataSources.map((ds) => (
                  <tr key={ds.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <span className="font-medium text-gray-900">{ds.name}</span>
                        {ds.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{ds.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {ds.datafileId.length > 20
                          ? `${ds.datafileId.slice(0, 8)}…${ds.datafileId.slice(-8)}`
                          : ds.datafileId}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {ds.status === "connected" && (
                        <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
                          <CheckCircle className="w-4 h-4" />
                          Connected
                        </span>
                      )}
                      {ds.status === "verifying" && (
                        <span className="inline-flex items-center gap-1.5 text-sm text-blue-700">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying
                        </span>
                      )}
                      {ds.status === "error" && (
                        <span className="inline-flex items-center gap-1.5 text-sm text-red-700">
                          <AlertCircle className="w-4 h-4" />
                          Error
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatRelativeTime(ds.addedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {confirmDeleteId === ds.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm text-gray-600">Delete?</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleConfirmDelete}
                          >
                            Yes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelDelete}
                          >
                            No
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDeleteClick(ds.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Data Source Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Data Source</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="ds-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ds-name"
                placeholder="e.g. Sales Data Q1"
                value={form.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                disabled={verifying}
              />
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <Label htmlFor="ds-apikey">
                SnowLeopard API Key <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="ds-apikey"
                  type={showApiKey ? "text" : "password"}
                  placeholder="sk-••••••••••••••••"
                  value={form.apiKey}
                  onChange={(e) => handleFieldChange("apiKey", e.target.value)}
                  disabled={verifying}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500">Find this in your SnowLeopard account settings</p>
            </div>

            {/* File ID */}
            <div className="space-y-1.5">
              <Label htmlFor="ds-fileid">
                File ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ds-fileid"
                placeholder="e.g. df_abc123"
                value={form.datafileId}
                onChange={(e) => handleFieldChange("datafileId", e.target.value)}
                disabled={verifying}
              />
              <p className="text-xs text-gray-500">Find this on your SnowLeopard playground datafiles page</p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="ds-description">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                id="ds-description"
                placeholder="A brief description of this dataset"
                value={form.description}
                onChange={(e) => handleFieldChange("description", e.target.value)}
                disabled={verifying}
                rows={2}
              />
            </div>

            {/* Inline error */}
            {verifyError && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{verifyError}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseDialog} disabled={verifying}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={verifying}>
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying…
                </>
              ) : (
                "Add"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default DataSourcesClient
