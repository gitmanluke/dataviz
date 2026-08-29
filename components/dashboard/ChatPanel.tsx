"use client"

import { useState, useRef, useEffect } from "react"
import { Sparkles, X, Send, Loader2, BarChart3, LineChart, PieChart, Hash, Table } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDataSources } from "@/hooks/useDataSources"
import { useWidgetAgent, type WidgetResult } from "@/hooks/useWidgetAgent"
import { parseChartIntent, isRefinement, retypeSpec } from "@/lib/widget-data"
import type { DataSource, Widget } from "@/lib/types"

interface Message {
  id: string
  text: string
  sender: "user" | "ai"
  timestamp: Date
  widget?: WidgetResult
  isLoading?: boolean
}

interface ChatPanelProps {
  onClose: () => void
  onAddWidget: (widget: Omit<Widget, "id">) => void
}

const WIDGET_ICONS: Record<Widget["type"], React.ComponentType<{ className?: string }>> = {
  "line-chart": LineChart,
  "bar-chart": BarChart3,
  "pie-chart": PieChart,
  "stat": Hash,
  "table": Table,
}

export function ChatPanel({ onClose, onAddWidget }: ChatPanelProps) {
  const { dataSources } = useDataSources()
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null)
  const [messages, setMessages] = useState<Message[]>([{
    id: "1",
    text: "Hi! Select a data source and ask me anything about your data. I'll answer in plain English and generate a chart or widget you can add to your dashboard.",
    sender: "ai",
    timestamp: new Date(),
  }])
  const [input, setInput] = useState("")
  const [lastResult, setLastResult] = useState<WidgetResult | null>(null)
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then((d: { anthropicKeyConfigured: boolean }) => setAiEnabled(d.anthropicKeyConfigured))
      .catch(() => setAiEnabled(false))
  }, [])

  const { isLoading, generate } = useWidgetAgent({
    dataSourceId: selectedSource?.id ?? "",
  })

  // Auto-select first connected source
  useEffect(() => {
    if (!selectedSource) {
      const connected = dataSources.find(ds => ds.status === "connected")
      if (connected) setSelectedSource(connected)
    }
  }, [dataSources, selectedSource])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    const query = input.trim()
    if (!query || isLoading) return
    setInput("")

    const userMsgId = String(Date.now())
    const aiMsgId = String(Date.now() + 1)

    setMessages(prev => [
      ...prev,
      { id: userMsgId, text: query, sender: "user", timestamp: new Date() },
      { id: aiMsgId, text: "", sender: "ai", timestamp: new Date(), isLoading: true },
    ])

    // Follow-up like "make that a pie chart" — re-render the last result's rows
    // under a new spec without another query.
    const intent = parseChartIntent(query)
    if (intent && lastResult && isRefinement(query)) {
      const newSpec = retypeSpec(lastResult.spec, intent)
      const updated: WidgetResult = { ...lastResult, spec: newSpec }
      setLastResult(updated)
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId
          ? {
              ...m,
              isLoading: false,
              text: `Here's the same data as a ${newSpec.type.replace("-", " ")}.`,
              widget: updated,
            }
          : m
      ))
      return
    }

    if (!selectedSource) {
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId
          ? { ...m, text: "Please select a data source using the dropdown above.", isLoading: false }
          : m
      ))
      return
    }

    try {
      const result = await generate(query, lastResult?.spec)

      if (!result) {
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId
            ? { ...m, text: "I couldn't find relevant data for that query. Try rephrasing.", isLoading: false }
            : m
        ))
        return
      }

      const dialogueText =
        result.explanation ??
        `Here's what I found: a ${result.spec.type.replace("-", " ")} based on your query.`

      setLastResult(result)
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId
          ? { ...m, text: dialogueText, isLoading: false, widget: result }
          : m
      ))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId
          ? { ...m, text: `Error: ${msg}`, isLoading: false }
          : m
      ))
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg flex flex-col h-[calc(100vh-12rem)] sticky top-24">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-full p-1.5">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900">AI Assistant</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors lg:hidden">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Data source selector */}
      <div className="px-4 py-2 border-b border-gray-100">
        {dataSources.filter(d => d.status === "connected").length === 0 ? (
          <p className="text-xs text-gray-500">
            No data sources connected.{" "}
            <a href="/data-sources" className="text-blue-600 hover:underline">Add one →</a>
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Source:</span>
            <select
              value={selectedSource?.id ?? ""}
              onChange={e => setSelectedSource(dataSources.find(d => d.id === e.target.value) ?? null)}
              className="text-xs border border-gray-200 rounded px-2 py-1 flex-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select…</option>
              {dataSources.filter(ds => ds.status === "connected").map(ds => (
                <option key={ds.id} value={ds.id}>{ds.name}</option>
              ))}
            </select>
          </div>
        )}
        {aiEnabled !== null && (
          <p className="text-[10px] text-gray-400 mt-1.5">
            {aiEnabled ? (
              <span className="inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-500" />
                Claude is choosing the charts
              </span>
            ) : (
              <>
                Using built-in chart rules.{" "}
                <a href="/settings" className="text-blue-600 hover:underline">Enable Claude →</a>
              </>
            )}
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-4 py-2.5 ${
              msg.sender === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
            }`}>
              {msg.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin my-0.5" />
              ) : (
                <>
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>

                  {/* Widget preview card */}
                  {msg.widget && (
                    <div className="mt-3 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        {(() => {
                          const Icon = WIDGET_ICONS[msg.widget.spec.type]
                          return <Icon className="w-4 h-4 text-blue-600 shrink-0" />
                        })()}
                        <span className="text-xs font-semibold text-gray-800 flex-1 truncate">
                          {msg.widget.spec.title}
                        </span>
                        {msg.widget.usedAgent && (
                          <Sparkles className="w-3 h-3 text-blue-500 shrink-0" aria-label="Chosen by Claude" />
                        )}
                        <span className="text-[10px] text-gray-400 capitalize shrink-0">
                          {msg.widget.spec.type.replace("-", " ")}
                        </span>
                      </div>
                      {msg.widget.sql && (
                        <details className="mb-2">
                          <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                            View SQL
                          </summary>
                          <code className="text-[10px] text-gray-600 block mt-1 bg-gray-50 rounded p-1.5 overflow-x-auto whitespace-pre">
                            {msg.widget.sql}
                          </code>
                        </details>
                      )}
                      <button
                        onClick={() => onAddWidget({
                          type: msg.widget!.spec.type,
                          title: msg.widget!.spec.title,
                          data: msg.widget!.rows,
                          spec: msg.widget!.spec,
                          query: msg.widget!.sql,
                          dataSourceId: selectedSource?.id,
                        })}
                        className="w-full text-xs bg-blue-600 text-white rounded-lg py-1.5 hover:bg-blue-700 transition-colors font-medium"
                      >
                        + Add to Dashboard
                      </button>
                    </div>
                  )}
                </>
              )}
              <p className={`text-[10px] mt-1 ${msg.sender === "user" ? "text-blue-100" : "text-gray-400"}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {/* Example prompts on first message only */}
        {messages.length === 1 && (
          <div className="space-y-1.5 mt-1">
            <p className="text-xs text-gray-400 font-medium px-1">Try asking:</p>
            {[
              "What percentage of users booked solo trips?",
              "Show me a breakdown by country",
              "Which traveller type is most common?",
              "Total number of users",
            ].map(p => (
              <button key={p} onClick={() => setInput(p)}
                className="w-full text-left text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50 transition-colors">
                {p}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={selectedSource ? "Ask about your data…" : "Select a data source first…"}
            disabled={isLoading}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50"
          />
          <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="sm" className="rounded-md">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ChatPanel
