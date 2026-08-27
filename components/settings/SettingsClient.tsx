"use client"

import { useEffect, useState } from "react"
import { Sparkles, CheckCircle, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SettingsClient() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then((d: { anthropicKeyConfigured: boolean }) => setConfigured(d.anthropicKeyConfigured))
      .catch(() => setConfigured(false))
  }, [])

  const handleSave = async () => {
    const key = apiKey.trim()
    if (!key) {
      setError("Enter an API key.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/settings/anthropic-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Could not verify the key.")
        return
      }
      setApiKey("")
      setConfigured(true)
      toast.success("Anthropic API key saved")
    } catch {
      setError("Network error — please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    const res = await fetch("/api/settings/anthropic-key", { method: "DELETE" })
    if (res.ok) {
      setConfigured(false)
      toast.success("Anthropic API key removed")
    } else {
      toast.error("Could not remove the key")
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Configure the AI that turns your questions into charts.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-full p-2 shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Anthropic API key</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Lets an LLM choose the chart type and columns from your wording. Without
              it, DataViz falls back to built-in heuristics — you can still edit every
              widget by hand.
            </p>
          </div>
        </div>

        {configured && (
          <div className="flex items-center justify-between rounded-md bg-green-50 border border-green-200 px-3 py-2.5 mb-4">
            <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
              <CheckCircle className="w-4 h-4" />
              A key is configured
            </span>
            <button onClick={handleClear} className="text-xs text-gray-500 hover:text-red-600">
              Remove
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="anthropic-key">{configured ? "Replace key" : "API key"}</Label>
          <div className="relative">
            <Input
              id="anthropic-key"
              type={showKey ? "text" : "password"}
              placeholder="sk-ant-••••••••••••••••"
              value={apiKey}
              onChange={e => {
                setApiKey(e.target.value)
                if (error) setError(null)
              }}
              disabled={saving}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            From{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              console.anthropic.com
            </a>
            . Stored encrypted on this machine.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5 mt-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="mt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default SettingsClient
