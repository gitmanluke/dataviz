"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, CheckCircle, Eye, EyeOff, Loader2, AlertCircle, Sheet } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface GoogleStatus {
  credentialsConfigured: boolean
  connected: boolean
  needsReconnect: boolean
}

interface SettingsResponse {
  anthropicKeyConfigured: boolean
  google: GoogleStatus
}

export function SettingsClient() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null)

  const refresh = useCallback(
    () =>
      fetch("/api/settings")
        .then(res => res.json())
        .then((d: SettingsResponse) => setSettings(d))
        .catch(() => setSettings(null)),
    [],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Configure the AI and your connected data services.</p>
      </div>

      <div className="space-y-6">
        <AnthropicCard
          configured={settings?.anthropicKeyConfigured ?? null}
          onChange={refresh}
        />
        <GoogleSheetsCard status={settings?.google ?? null} onChange={refresh} />
      </div>
    </div>
  )
}

// --- Anthropic key --------------------------------------------------------

function AnthropicCard({
  configured,
  onChange,
}: {
  configured: boolean | null
  onChange: () => void
}) {
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      onChange()
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
      onChange()
      toast.success("Anthropic API key removed")
    } else {
      toast.error("Could not remove the key")
    }
  }

  return (
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
  )
}

// --- Google Sheets -----------------------------------------------------

function GoogleSheetsCard({
  status,
  onChange,
}: {
  status: GoogleStatus | null
  onChange: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState({ clientId: "", clientSecret: "", apiKey: "" })
  const [showSecrets, setShowSecrets] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // One-shot: read ?google=connected|error from the OAuth redirect, toast, clean URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get("google")
    if (!result) return
    if (result === "connected") toast.success("Google connected")
    else toast.error(`Google connection failed (${params.get("reason") ?? "unknown"})`)
    router.replace("/settings")
    onChange()
  }, [router, onChange])

  const set = (k: keyof typeof form, v: string) => {
    setForm(p => ({ ...p, [k]: v }))
    setError(null)
  }

  const handleSave = async () => {
    const { clientId, clientSecret, apiKey } = form
    if (!clientId.trim() || !clientSecret.trim() || !apiKey.trim()) {
      setError("Client ID, client secret, and API key are all required.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/integrations/google/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          apiKey: apiKey.trim(),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Could not save credentials.")
        return
      }
      setForm({ clientId: "", clientSecret: "", apiKey: "" })
      onChange()
      toast.success("Google credentials saved")
    } catch {
      setError("Network error — please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    const res = await fetch("/api/integrations/google/credentials", { method: "DELETE" })
    if (res.ok) {
      onChange()
      toast.success("Google credentials removed")
    } else {
      toast.error("Could not remove credentials")
    }
  }

  const handleDisconnect = async () => {
    const res = await fetch("/api/integrations/google", { method: "DELETE" })
    if (res.ok) {
      onChange()
      toast.success("Google disconnected")
    } else {
      toast.error("Could not disconnect")
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-full p-2 shrink-0">
          <Sheet className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Google Sheets</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Connect a Google account to add spreadsheets as data sources that
            refresh when the sheet changes. Needs a Google Cloud OAuth client
            (Desktop app) and an API key — see <code>docs/google-sheets.md</code>.
          </p>
        </div>
      </div>

      {status?.needsReconnect && (
        <div className="flex items-center justify-between rounded-md bg-red-50 border border-red-200 px-3 py-2.5 mb-4">
          <span className="inline-flex items-center gap-1.5 text-sm text-red-700">
            <AlertCircle className="w-4 h-4" />
            Google connection expired — reconnect
          </span>
          <a
            href="/api/integrations/google/start"
            className="text-xs font-medium text-red-700 hover:underline"
          >
            Reconnect
          </a>
        </div>
      )}

      {status?.connected && !status.needsReconnect && (
        <div className="flex items-center justify-between rounded-md bg-green-50 border border-green-200 px-3 py-2.5 mb-4">
          <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
            <CheckCircle className="w-4 h-4" />
            Connected
          </span>
          <button onClick={handleDisconnect} className="text-xs text-gray-500 hover:text-red-600">
            Disconnect
          </button>
        </div>
      )}

      {status?.credentialsConfigured ? (
        <div className="space-y-3">
          {!status.connected && !status.needsReconnect && (
            <a href="/api/integrations/google/start">
              <Button>Connect Google</Button>
            </a>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>Credentials saved.</span>
            <button onClick={handleRemove} className="hover:text-red-600">
              Replace / remove
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="g-client-id">OAuth client ID</Label>
            <Input
              id="g-client-id"
              placeholder="•••••••.apps.googleusercontent.com"
              value={form.clientId}
              onChange={e => set("clientId", e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-client-secret">OAuth client secret</Label>
            <Input
              id="g-client-secret"
              type={showSecrets ? "text" : "password"}
              placeholder="GOCSPX-••••••••"
              value={form.clientSecret}
              onChange={e => set("clientSecret", e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-api-key">API key</Label>
            <div className="relative">
              <Input
                id="g-api-key"
                type={showSecrets ? "text" : "password"}
                placeholder="AIza••••••••"
                value={form.apiKey}
                onChange={e => set("apiKey", e.target.value)}
                disabled={saving}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecrets(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save credentials"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

export default SettingsClient
