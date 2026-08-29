"use client"

import { useEffect, useRef, useState } from "react"
import {
  Plus, CheckCircle, AlertCircle, Loader2, Trash2, Eye, EyeOff,
  Database, Upload, ChevronRight, ChevronDown, FileSpreadsheet,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useDataSources } from "@/hooks/useDataSources"
import type { DataSource } from "@/lib/types"

interface TableInfo {
  name: string
  rowCount: number
  columns: { name: string; type: string }[]
}

function formatRelativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return days === 1 ? "1 day ago" : `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`
  const years = Math.floor(months / 12)
  return years === 1 ? "1 year ago" : `${years} years ago`
}

export function DataSourcesClient() {
  const { dataSources, initialized, add, upload, remove } = useDataSources()
  const [dialog, setDialog] = useState<"none" | "snowleopard" | "upload">("none")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    const ds = dataSources.find(d => d.id === id)
    setConfirmDeleteId(null)
    try {
      await remove(id)
      toast.success(`Deleted "${ds?.name ?? "data source"}"`)
    } catch {
      toast.error("Could not delete data source")
    }
  }

  if (!initialized) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-48 bg-gray-200 rounded-lg mt-8" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Sources</h1>
          <p className="text-gray-600">Upload files or connect SnowLeopard, then ask questions of your data.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add data source
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDialog("upload")}>
              <Upload className="w-4 h-4 mr-2" />
              Upload files (CSV / SQLite)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog("snowleopard")}>
              <Database className="w-4 h-4 mr-2" />
              Connect SnowLeopard
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {dataSources.length === 0 ? (
          <div className="p-16 text-center">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-700 font-medium mb-1">No data sources yet</p>
            <p className="text-sm text-gray-400 mb-6">Upload a CSV or a .db file to get started</p>
            <Button onClick={() => setDialog("upload")} variant="outline" className="flex items-center gap-2 mx-auto">
              <Upload className="w-4 h-4" />
              Upload files
            </Button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Source</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Added</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dataSources.map(ds => (
                <SourceRow
                  key={ds.id}
                  ds={ds}
                  confirmingDelete={confirmDeleteId === ds.id}
                  onAskDelete={() => setConfirmDeleteId(ds.id)}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  onConfirmDelete={() => handleDelete(ds.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SnowLeopardDialog
        open={dialog === "snowleopard"}
        onClose={() => setDialog("none")}
        add={add}
      />
      <UploadDialog
        open={dialog === "upload"}
        onClose={() => setDialog("none")}
        upload={upload}
      />
    </div>
  )
}

// --- row -----------------------------------------------------------------

function SourceRow({
  ds, confirmingDelete, onAskDelete, onCancelDelete, onConfirmDelete,
}: {
  ds: DataSource
  confirmingDelete: boolean
  onAskDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [tables, setTables] = useState<TableInfo[] | null>(null)
  const fetched = useRef(false)
  const isFiles = ds.type === "files"

  useEffect(() => {
    if (!expanded || !isFiles || fetched.current) return
    fetched.current = true
    let alive = true
    fetch(`/api/data-sources/${ds.id}/tables`)
      .then(r => (r.ok ? r.json() : []))
      .then((d: unknown) => {
        if (alive) setTables(Array.isArray(d) ? (d as TableInfo[]) : [])
      })
      .catch(() => {
        if (alive) setTables([])
      })
    return () => {
      alive = false
    }
  }, [expanded, isFiles, ds.id])

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4">
          <button
            className="flex items-center gap-1.5 text-left"
            onClick={() => isFiles && setExpanded(v => !v)}
            disabled={!isFiles}
          >
            {isFiles && (expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />)}
            <span>
              <span className="font-medium text-gray-900">{ds.name}</span>
              {ds.description && <p className="text-sm text-gray-500 mt-0.5">{ds.description}</p>}
            </span>
          </button>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          {isFiles ? (
            <span className="inline-flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-gray-400" />
              Uploaded files
            </span>
          ) : (
            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
              {(ds.datafileId ?? "").length > 20
                ? `${ds.datafileId!.slice(0, 8)}…${ds.datafileId!.slice(-8)}`
                : ds.datafileId}
            </span>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          {ds.status === "connected" && (
            <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
              <CheckCircle className="w-4 h-4" /> Connected
            </span>
          )}
          {ds.status === "error" && (
            <span className="inline-flex items-center gap-1.5 text-sm text-red-700">
              <AlertCircle className="w-4 h-4" /> Error
            </span>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {formatRelativeTime(ds.createdAt)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right">
          {confirmingDelete ? (
            <div className="flex items-center justify-end gap-2">
              <span className="text-sm text-gray-600">Delete?</span>
              <Button size="sm" variant="destructive" onClick={onConfirmDelete}>Yes</Button>
              <Button size="sm" variant="outline" onClick={onCancelDelete}>No</Button>
            </div>
          ) : (
            <button onClick={onAskDelete} className="text-gray-400 hover:text-red-600" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </td>
      </tr>
      {expanded && isFiles && (
        <tr>
          <td colSpan={5} className="px-6 pb-4 bg-gray-50">
            {tables === null ? (
              <p className="text-sm text-gray-400 py-2">Loading tables…</p>
            ) : tables.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No tables</p>
            ) : (
              <div className="space-y-2 pt-2">
                {tables.map(t => (
                  <div key={t.name} className="text-sm">
                    <span className="font-mono font-medium text-gray-800">{t.name}</span>
                    <span className="text-gray-400"> · {t.rowCount.toLocaleString()} rows</span>
                    <span className="text-gray-500"> — {t.columns.map(c => c.name).join(", ")}</span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// --- upload dialog -----------------------------------------------------

function UploadDialog({
  open, onClose, upload,
}: {
  open: boolean
  onClose: () => void
  upload: (form: FormData) => Promise<DataSource>
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [files, setFiles] = useState<FileList | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName(""); setDescription(""); setFiles(null); setBusy(false); setError(null)
  }

  const handleSubmit = async () => {
    if (!name.trim()) return setError("A name is required.")
    if (!files || files.length === 0) return setError("Choose at least one file.")
    setBusy(true)
    setError(null)
    const form = new FormData()
    form.set("name", name.trim())
    if (description.trim()) form.set("description", description.trim())
    for (const f of Array.from(files)) form.append("files", f)
    try {
      await upload(form)
      toast.success(`"${name.trim()}" added`)
      reset()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !busy) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Upload files</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="up-name">Name <span className="text-red-500">*</span></Label>
            <Input id="up-name" placeholder="e.g. Sales Data" value={name}
              onChange={e => { setName(e.target.value); setError(null) }} disabled={busy} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="up-files">Files <span className="text-red-500">*</span></Label>
            <Input id="up-files" type="file" multiple accept=".csv,.db,.sqlite,.sqlite3"
              onChange={e => { setFiles(e.target.files); setError(null) }} disabled={busy} />
            <p className="text-xs text-gray-500">
              One or more .csv files, or a .db / SQLite file. Each file becomes a table you can query.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="up-desc">Description <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Textarea id="up-desc" rows={2} value={description}
              onChange={e => setDescription(e.target.value)} disabled={busy} />
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose() }} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</> : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- snowleopard dialog ---------------------------------------------

function SnowLeopardDialog({
  open, onClose, add,
}: {
  open: boolean
  onClose: () => void
  add: (input: { name: string; apiKey: string; datafileId: string; description?: string }) => Promise<DataSource>
}) {
  const [form, setForm] = useState({ name: "", apiKey: "", datafileId: "", description: "" })
  const [showKey, setShowKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setForm({ name: "", apiKey: "", datafileId: "", description: "" })
    setShowKey(false); setBusy(false); setError(null)
  }
  const set = (k: keyof typeof form, v: string) => {
    setForm(p => ({ ...p, [k]: v }))
    setError(null)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.apiKey.trim() || !form.datafileId.trim()) {
      return setError("Name, API key, and File ID are all required.")
    }
    setBusy(true)
    setError(null)
    try {
      await add({
        name: form.name.trim(),
        apiKey: form.apiKey.trim(),
        datafileId: form.datafileId.trim(),
        description: form.description.trim() || undefined,
      })
      toast.success(`"${form.name.trim()}" added`)
      reset()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect.")
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !busy) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Connect SnowLeopard</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sl-name">Name <span className="text-red-500">*</span></Label>
            <Input id="sl-name" placeholder="e.g. Superheroes" value={form.name}
              onChange={e => set("name", e.target.value)} disabled={busy} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sl-key">SnowLeopard API Key <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input id="sl-key" type={showKey ? "text" : "password"} placeholder="sk-••••••••"
                value={form.apiKey} onChange={e => set("apiKey", e.target.value)} disabled={busy} className="pr-10" />
              <button type="button" onClick={() => setShowKey(v => !v)} tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sl-file">File ID <span className="text-red-500">*</span></Label>
            <Input id="sl-file" placeholder="e.g. df_abc123" value={form.datafileId}
              onChange={e => set("datafileId", e.target.value)} disabled={busy} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sl-desc">Description <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Textarea id="sl-desc" rows={2} value={form.description}
              onChange={e => set("description", e.target.value)} disabled={busy} />
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose() }} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</> : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DataSourcesClient
