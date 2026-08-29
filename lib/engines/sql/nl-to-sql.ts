import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { createAnthropic, VIZ_MODEL } from "@/lib/anthropic"

const SYSTEM = `You convert a natural-language question into a single read-only SQLite query.

Rules:
1. Return exactly one SELECT (a leading CTE is fine), inside a \`\`\`sql fenced block.
2. SQLite syntax. Read-only only - never INSERT / UPDATE / DELETE / DDL / PRAGMA.
3. Use only the tables and columns in the schema below. Column names are case-sensitive.
4. After the SQL block, add a \`\`\`text block with one plain-English sentence
   describing what the query returns.
5. The result feeds a chart - keep it focused. Add ORDER BY and a LIMIT when the
   question implies a ranking or "top N".
6. If the question cannot be answered from this schema, reply with exactly:
   generation unavailable`

export interface GeneratedSql {
  sql: string
  summary: string
}

function extract(pattern: RegExp, text: string): string | null {
  const m = text.match(pattern)
  const v = m?.[1]?.trim()
  return v || null
}

export async function nlToSql(
  apiKey: string,
  schema: Record<string, string[]>,
  question: string,
  retry?: { sql: string; reason: string },
): Promise<GeneratedSql | null> {
  const tables = Object.entries(schema).map(([t, cols]) => `- ${t}(${cols.join(", ")})`)
  const parts = [
    "Schema:",
    tables.join("\n") || "(no tables)",
    "",
    `Question: "${question}"`,
  ]
  if (retry) {
    parts.push(
      "",
      "Your previous query was rejected:",
      "```sql\n" + retry.sql + "\n```",
      `Reason: ${retry.reason}`,
      "Produce a corrected query.",
    )
  }

  try {
    const res = await createAnthropic(apiKey).messages.create(
      {
        model: VIZ_MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: "user", content: parts.join("\n") }],
      },
      { timeout: 15_000 },
    )
    const block = res.content.find(b => b.type === "text")
    if (!block || block.type !== "text") return null
    if (block.text.trim().toLowerCase() === "generation unavailable") return null

    const sql = extract(/```sql\s*([\s\S]*?)```/i, block.text)
    const summary = extract(/```text\s*([\s\S]*?)```/i, block.text) ?? ""
    return sql ? { sql, summary } : null
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.warn("[sql/nl-to-sql] API error:", error.status, error.message)
    } else {
      console.warn("[sql/nl-to-sql] error:", error)
    }
    return null
  }
}
