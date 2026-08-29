"use client"

import { useState } from "react"
import { Loader2, AlertCircle, Sheet } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { REFRESH_INTERVALS } from "@/lib/integrations/google/intervals"
import { loadPicker } from "@/lib/picker/load"
import type { DataSource } from "@/lib/types"

interface PickedSheet {
  id: string
  name: string
}

const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet"

export function GoogleSheetDialog({
  open,
  onClose,
  connected,
  addSheet,
}: {
  open: boolean
  onClose: () => void
  connected: boolean
  addSheet: (payload: {
    name?: string
    spreadsheetId: string
    refreshInterval?: string
  }) => Promise<DataSource>
}) {
  const [picked, setPicked] = useState<PickedSheet | null>(null)
  const [name, setName] = useState("")
  const [interval, setInterval] = useState("on-open")
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setPicked(null)
    setName("")
    setInterval("on-open")
    setPicking(false)
    setBusy(false)
    setError(null)
  }

  const openPicker = async () => {
    setPicking(true)
    setError(null)
    try {
      await loadPicker()
      const res = await fetch("/api/integrations/google/token")
      if (!res.ok) throw new Error("Google connection unavailable — reconnect in Settings.")
      const { accessToken, apiKey } = (await res.json()) as {
        accessToken: string
        apiKey: string
      }

      const { google } = window
      const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setMimeTypes(
        SPREADSHEET_MIME,
      )
      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setTitle("Choose a spreadsheet")
        .setCallback(data => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0]
            setPicked({ id: doc.id, name: doc.name })
            setName(prev => prev || doc.name)
          }
          if (
            data.action === google.picker.Action.PICKED ||
            data.action === google.picker.Action.CANCEL
          ) {
            setPicking(false)
          }
        })
        .build()
      picker.setVisible(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the picker")
      setPicking(false)
    }
  }

  const handleAdd = async () => {
    if (!picked) return
    setBusy(true)
    setError(null)
    try {
      await addSheet({
        name: name.trim() || undefined,
        spreadsheetId: picked.id,
        refreshInterval: interval,
      })
      toast.success(`"${name.trim() || picked.name}" added`)
      reset()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect the sheet")
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        if (!o && !busy) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Google Sheets</DialogTitle>
        </DialogHeader>

        {!connected ? (
          <div className="py-4 space-y-1 text-sm text-gray-600">
            <p>Connect a Google account first.</p>
            <a href="/settings" className="text-blue-600 hover:underline">
              Open Settings →
            </a>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Spreadsheet</Label>
              {picked ? (
                <div className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <Sheet className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="truncate">{picked.name}</span>
                  </span>
                  <button
                    onClick={openPicker}
                    className="text-xs text-gray-500 hover:text-gray-800 shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={openPicker}
                  disabled={picking}
                  className="w-full"
                >
                  {picking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Opening…
                    </>
                  ) : (
                    "Choose from Google Drive"
                  )}
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gs-name">Name</Label>
              <Input
                id="gs-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Defaults to the sheet's title"
                disabled={busy}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gs-interval">Refresh</Label>
              <Select value={interval} onValueChange={setInterval} disabled={busy}>
                <SelectTrigger id="gs-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFRESH_INTERVALS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              reset()
              onClose()
            }}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={busy || !picked || !connected}>
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting…
              </>
            ) : (
              "Add"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
