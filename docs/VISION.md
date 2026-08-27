# DataViz — Vision & Roadmap

_Last updated 2026-08-27._

## Context

Rebuilt from a Figma Make export into a Next.js app. The original Vite/Figma
frontend and an experimental `agent` branch were dropped; salvaged pieces live
in `pydantic-ai/` (a Snow Leopard + PydanticAI reference) and `.claude/agents/`.
Now a solo project, split from the original team repo into `gitmanluke/dataviz`.

## What it is

A **local-first dashboard builder**. You connect a data source, ask questions in
natural language, and DataViz turns each answer into a chart, stat, or table
widget you drag onto a dashboard. Data and dashboards stay on your machine.

The core loop already works:

1. Add a data source (currently a Snow Leopard datafile: API key + file id).
2. Open a dashboard, open the AI panel, ask a question.
3. The server queries the source; `lib/widget-detector.ts` picks a widget type
   from the returned rows; you preview it and add it to the grid.
4. Dashboards, widgets, and layouts persist (localStorage today).

## Goals, in priority order

1. **Presentable portfolio piece.** Clean code, honest UI, a demo a reviewer
   can run in one step, screenshots in the README, green CI.
2. **Works end to end** with at least one zero-setup data source.
3. **Maybe useful to me** — it stays a general tool; if I end up using it to
   track job applications or anything else, that's a bonus, not the direction.

Non-goals for now: multi-tenant hosting, auth, billing, teams, real-time
collaboration. Also a non-goal: hard-coding the app around any one kind of
data — it's a general-purpose dashboard builder.

## Target architecture

### Persistence → local SQLite

Replace localStorage with a local SQLite database.

- Tables: `dashboards`, `widgets` (layout fields inline), `data_sources`.
- Accessed only from route handlers / server actions, never the client.
- ORM: use **Prisma**. (An ORM lets you define your tables once as a schema and
  then read/write rows as typed objects instead of hand-writing SQL strings.)
  Prisma has the gentlest learning curve, generates database migrations for you,
  and ships a GUI (Prisma Studio) for inspecting the local DB — and it's the one
  a reviewer is most likely to recognize. Drizzle is a lighter, more
  SQL-flavored alternative; not worth the extra friction here.
- Migration path: keep the `useDashboards` / `useWidgets` / `useDataSources`
  hook signatures identical; swap their internals from `lib/store.ts` to `fetch`
  calls against new `/api/**` routes. Components shouldn't change.
- Provide a one-time "import from browser storage" so existing local data isn't
  lost.

### Retrieval → pluggable engine

Snow Leopard is the current engine, not a commitment.

- Define `interface QueryEngine { retrieve(query, source): Promise<QueryResult> }`
  with `QueryResult = { rows, columns, sql?, explanation? }`.
- `SnowLeopardEngine` wraps today's client. Later: `SqlEngine` (direct SQL
  against a SQLite/Postgres source, no NL step), possibly a local-LLM engine.
- `widget-detector.ts` already takes plain rows — keep it that way; it never
  learns which engine produced them.
- `app/api/ai/retrieve` and `app/api/data-sources/verify` become thin adapters
  over the engine.

### Data sources → typed connections

A data source is `{ id, name, type, config }`:

- `snowleopard` — `{ apiKey, datafileId }` (today)
- `sqlite` — `{ path }` (natural for a local app; the Snow Leopard sample
  dataset is itself a `.db` file)
- `csv` — uploaded file loaded into a local table
- `postgres` — connection string (later, if ever)

MVP ships `snowleopard` plus one bundled sample so the app works with no signup.

### Secrets

- Move API keys out of localStorage and out of client → server request bodies.
- Single-tenant: keys live in the `data_sources` row (local DB) and/or
  `.env.local`, read server-side only.
- The client calls `/api/ai/retrieve` with a `dataSourceId`; the route looks up
  the key. **This is the first real work item** — the current flow sends the key
  from the browser on every call.

### Packaging (deferred)

"Local app" = clone + `npm run dev` for now. If it graduates to a real desktop
app, evaluate **Tauri** (light Rust shell) vs Electron. Not before v1.

## Sample data & the demo

DataViz stays a general-purpose dashboard builder — it makes no assumptions
about what kind of data you point it at. But the demo has to work with zero
setup, so:

- Bundle one small sample dataset (a SQLite file) and register it as a data
  source on first run. A reviewer clones, runs one command, and can immediately
  ask questions and build a dashboard.
- Pick a sample that exercises every widget type — something with a time series,
  some categories, and a few plain numbers (the Snow Leopard `superheroes.db`
  or a similar public dataset works).
- Replace the current hard-coded travel-survey example prompts in `ChatPanel`
  with ones that match whatever sample ships.

Personal use — e.g. importing a CSV of job applications and building a tracker —
is just one thing the general tool can do. Nothing in the codebase should
hard-code it.

## "v1 done" checklist

- [ ] SQLite persistence; localStorage removed (with one-time import)
- [ ] Secrets server-side only
- [ ] `QueryEngine` abstraction; Snow Leopard behind it
- [ ] One bundled zero-setup data source (sample SQLite), with matching
      example prompts in `ChatPanel`
- [ ] NL-query → widget flow solid across all five widget types on the sample
- [ ] Remove dead/fake UI (alert toggles, non-functional refresh interval)
- [ ] `npm run typecheck` + `npm run test` scripts; Vitest on `widget-detector`
      and route handlers; CI running lint + typecheck + test + build
- [ ] README: what it is, screenshots/GIF, one-command run, short architecture note
- [ ] Deployed demo (Vercel) or a documented one-command local run
- [ ] Preserve the Figma design link:
      <https://www.figma.com/design/IOpFAuI3PlGilnuELgoBMy/Customizable-Data-Dashboard-App>

## Known debt

- `lib/widget-detector.ts:15` — `void NUMERIC_TYPES` lint hack; `NUMERIC_TYPES`
  is dead.
- `components/dashboard/DashboardSettings.tsx` — scheduled/threshold alert
  toggles and the refresh-interval selector are non-functional local state.
- `app/dashboard/[id]/page.tsx` — "Last updated" renders `new Date()` every
  render, not a stored timestamp.
- `app/api/ai/chat/route.ts` — a streaming chat route exists but the UI uses
  `/retrieve`; decide whether streaming chat stays.
- No error boundary or offline handling around retrieval.
- `Dashboard.widgetCount` in `lib/types.ts` is stored but never kept in sync
  with actual widgets.
