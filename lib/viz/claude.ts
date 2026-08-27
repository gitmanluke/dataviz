import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { createAnthropic, VIZ_MODEL } from "@/lib/anthropic"
import type { WidgetSpec, WidgetType } from "@/lib/types"
import type { Column } from "@/lib/query-engine"
import type { VizContext, VizModel } from "@/lib/viz/model"

const WIDGET_TYPES: WidgetType[] = ["line-chart", "bar-chart", "pie-chart", "stat", "table"]

const SYSTEM_PROMPT = `You are a data-visualization specialist. Given a natural-language
request and the shape of some query results, decide how to display them by calling
emit_widget_spec exactly once. Make a sensible default choice — never ask questions.

Widget types:
- bar-chart: rankings, comparisons across categories
- line-chart: trends over time (the axis column is a date / year / month)
- pie-chart: parts of a whole — only with 7 or fewer categories, otherwise use bar-chart
- stat: a single headline number
- table: multi-column detail with no clear chart mapping

Choosing columns (use the exact column names given):
- xKey: the category or time column. For stat, use "".
- series: the measure column(s) to plot. bar/line take one or more; pie takes exactly
  one; stat takes exactly one; table takes [].
- Never put id, uuid, or *_id columns in series.

If the user names a chart type ("as a pie chart", "just the number", "in a table"),
honour it when the data supports it.

sort: "desc" for "top/most/highest", "asc" for "bottom/least/lowest", otherwise "none"
(the query is usually already ordered).

title: a short phrase derived from the request.`

const SPEC_TOOL: Anthropic.Tool = {
  name: "emit_widget_spec",
  description: "Emit the visualization spec for the query result.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["type", "title", "xKey", "series", "sort"],
    properties: {
      type: { type: "string", enum: WIDGET_TYPES },
      title: { type: "string" },
      xKey: { type: "string", description: 'axis column; "" for stat' },
      series: { type: "array", items: { type: "string" } },
      sort: { type: "string", enum: ["none", "asc", "desc"] },
    },
  },
}

function buildUserMessage(ctx: VizContext): string {
  const cols = ctx.columns.map(c => `- ${c.name} (${c.type})`).join("\n")
  const samples = ctx.sampleRows.map(r => JSON.stringify(r)).join("\n")
  const parts = [
    `Columns:\n${cols || "(none)"}`,
    `Sample rows:\n${samples || "(none)"}`,
    ctx.sql ? `SQL:\n${ctx.sql}` : null,
    `User request: "${ctx.userQuery}"`,
    ctx.priorSpec
      ? `The user is adjusting this existing widget — keep what still makes sense:\n${JSON.stringify(ctx.priorSpec)}`
      : null,
  ]
  return parts.filter(Boolean).join("\n\n")
}

/** Repair a raw tool input into a usable spec, or null if the type is invalid. */
function validate(input: unknown, columns: Column[]): WidgetSpec | null {
  if (input == null || typeof input !== "object") return null
  const o = input as Record<string, unknown>

  const type = o.type as WidgetType
  if (!WIDGET_TYPES.includes(type)) return null

  const names = columns.map(c => c.name)
  const numeric = columns.filter(c => c.type === "number").map(c => c.name)
  const nonNumeric = columns.filter(c => c.type !== "number").map(c => c.name)

  const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : "Widget"

  let xKey = typeof o.xKey === "string" ? o.xKey : ""
  if (type === "stat") xKey = ""
  else if (!names.includes(xKey)) xKey = nonNumeric[0] ?? names[0] ?? ""

  let series = Array.isArray(o.series) ? o.series.filter((s): s is string => typeof s === "string") : []
  series = series.filter(s => names.includes(s))
  if (type === "table") series = numeric
  else if (series.length === 0) series = numeric.slice(0, type === "pie-chart" || type === "stat" ? 1 : numeric.length)
  else if (type === "pie-chart" || type === "stat") series = series.slice(0, 1)

  const sort = o.sort === "asc" || o.sort === "desc" ? o.sort : "none"

  return { type, title, xKey, series, sort }
}

export class ClaudeVizModel implements VizModel {
  constructor(private readonly apiKey: string) {}

  async proposeSpec(ctx: VizContext): Promise<WidgetSpec | null> {
    try {
      const client = createAnthropic(this.apiKey)
      const res = await client.messages.create(
        {
          model: VIZ_MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: [SPEC_TOOL],
          tool_choice: { type: "tool", name: "emit_widget_spec" },
          messages: [{ role: "user", content: buildUserMessage(ctx) }],
        },
        { timeout: 8_000 }
      )
      const block = res.content.find(b => b.type === "tool_use")
      if (!block || block.type !== "tool_use") return null
      return validate(block.input, ctx.columns)
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        console.warn("[viz/claude] API error:", error.status, error.message)
      } else {
        console.warn("[viz/claude] error:", error)
      }
      return null
    }
  }
}
