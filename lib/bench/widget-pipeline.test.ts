// Not a unit test — an end-to-end latency + cost benchmark for the
// question -> widget pipeline. It hits the real Anthropic API, so it's skipped
// unless BENCH=1 and needs a key:
//
//   ANTHROPIC_API_KEY=sk-ant-... BENCH=1 npx vitest run lib/bench
//
// It reports median / p95 wall-clock per widget and the mean model cost.

import { readFileSync } from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"
import type { DataSource as DataSourceRow } from "@prisma/client"
import { afterAll, beforeAll, describe, it } from "vitest"
import { onAnthropicUsage, type AnthropicUsage } from "@/lib/anthropic"
import { sqlEngine } from "@/lib/engines/sql"
import { createTable, rowsFromCsv } from "@/lib/engines/sql/ingest"
import { openWritable, removeSourceDb } from "@/lib/engines/sql/store"
import { resolveSpec } from "@/lib/viz"

const RUN = process.env.BENCH === "1"

// Claude Haiku 4.5, USD per million tokens. Verify against anthropic.com/pricing.
const PRICE_IN = 1.0
const PRICE_OUT = 5.0

const SOURCE_ID = "bench-source"
const REPEATS = 3
const QUESTIONS = [
  "total revenue by region",
  "monthly revenue over time",
  "which channel drives the most revenue?",
  "top 5 products by revenue",
  "how many units were sold in each category?",
  "average order size by region",
  "revenue by category",
  "which supplier's products generate the most revenue?",
  "total revenue in 2025",
  "list every order in the APAC region",
  "monthly revenue for Displays products",
  "how many orders did each channel have?",
]

const source = {
  id: SOURCE_ID,
  type: "files",
  name: "bench",
  status: "connected",
} as DataSourceRow

function seed(): void {
  const dir = path.resolve("sample")
  const db = openWritable(SOURCE_ID)
  try {
    for (const [file, table] of [
      ["sales.csv", "sales"],
      ["products.csv", "products"],
    ]) {
      const { columns, rows } = rowsFromCsv(readFileSync(path.join(dir, file)))
      createTable(db, table, columns, rows)
    }
  } finally {
    db.close()
  }
}

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

describe.skipIf(!RUN)("widget pipeline benchmark", () => {
  beforeAll(seed)
  afterAll(() => removeSourceDb(SOURCE_ID))

  it(
    "measures latency + model cost per widget",
    async () => {
      let pending: AnthropicUsage[] = []
      onAnthropicUsage(u => pending.push(u))

      const samples: { q: string; ms: number; inTok: number; outTok: number; usd: number }[] = []

      for (const q of QUESTIONS) {
        for (let i = 0; i < REPEATS; i++) {
          pending = []
          const t0 = performance.now()
          const result = await sqlEngine.retrieve(q, source)
          await resolveSpec(result, q)
          const ms = performance.now() - t0

          const inTok = pending.reduce((n, u) => n + u.inputTokens, 0)
          const outTok = pending.reduce((n, u) => n + u.outputTokens, 0)
          const usd = (inTok / 1e6) * PRICE_IN + (outTok / 1e6) * PRICE_OUT
          samples.push({ q, ms, inTok, outTok, usd })
        }
      }

      onAnthropicUsage(null)

      const times = samples.map(s => s.ms).sort((a, b) => a - b)
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

      console.log("\n=== widget pipeline benchmark ===")
      console.log(`${samples.length} runs (${QUESTIONS.length} questions x ${REPEATS})\n`)
      console.log(`latency   median ${pct(times, 50).toFixed(0)} ms   p95 ${pct(times, 95).toFixed(0)} ms   mean ${mean(times).toFixed(0)} ms`)
      console.log(`tokens    in ${mean(samples.map(s => s.inTok)).toFixed(0)}   out ${mean(samples.map(s => s.outTok)).toFixed(0)}  (mean per widget)`)
      console.log(`cost      $${mean(samples.map(s => s.usd)).toFixed(5)} per widget   ($${(mean(samples.map(s => s.usd)) * 1000).toFixed(2)} per 1,000)`)
      console.log("================================\n")
    },
    10 * 60_000,
  )
})
