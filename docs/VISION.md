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

## Where it stands (updated 2026-08-29)

- **All app data persists in local SQLite via Prisma 6** — data sources,
  dashboards, widgets, settings. One-time localStorage import via `MigrationGate`.
- **Secrets** (SnowLeopard + Anthropic keys) encrypted at rest (`lib/crypto.ts`),
  never leave the server.
- **Widget system + viz agent** (merged): widgets store raw rows + an editable
  `WidgetSpec`; `ClaudeVizModel` (Haiku) picks the spec when an Anthropic key is
  set, `detectSpec` heuristic otherwise; `/settings` page; per-widget edit panel.
- **CSV / SQLite data sources** (`feat/sql-engine`): upload `.csv` / `.db` files
  → per-source SQLite (`data/sources/*.db`) → `sqlEngine` (Claude writes SQL →
  `validateSql` + retry → run read-only via `better-sqlite3`). The pipeline is a
  TS port of the hardened SpeedySheets project. SnowLeopard stays as a second
  engine, picked by `DataSource.type`.
- **Table management + refreshable widgets** (`feat/widget-refresh`): a `files`
  source's tables can be added to / replaced / dropped from `/data-sources`;
  widgets from a `files` source store their `query` + `dataSourceId` and can be
  re-run (per-widget "Refresh data", dashboard "Refresh all") — manual only.
- **Google Sheets** (`feat/google-sheets`): connect a spreadsheet via the Drive
  Picker (Desktop OAuth, loopback, PKCE, `drive.file` scope). Each tab → a
  table; the same `sqlEngine` / `runSql` / widget-refresh path as `files`. A
  per-source `refreshInterval` (`manual`…`monthly`) re-syncs opportunistically
  on app activity, gated by a Drive `modifiedTime` check. Credentials +
  encrypted refresh token in `Setting` rows; only a short-lived read-only
  access token reaches the browser (for the Picker).
- **Vitest** exists (`npm run test`) — 82 tests: SQL validator, ingestion,
  `runSql`, table management, and the Google integration (token cache,
  `parseSpreadsheet`/`syncSheet`, `isDue`, id parsing).
- **Builds clean.** `npm run build` passes (Next 16, Turbopack), TypeScript OK.
- **`npm install` works with no flags.** 3 `npm audit` warnings remain, all
  cleared by a `next` 16.2.1 → 16.3.x bump (not yet done).
- **`npm run lint` — 6 errors, all pre-existing and none in our code:**
  `ChatPanel.tsx:62` (setState-in-effect for source auto-select) and 5 in
  vendored `components/ui/` (carousel, chart×2, sidebar, use-mobile) — clear by
  regenerating those from shadcn.
- Setup needs `.env` (copy `.env.example`, generate
  `DATA_SOURCE_ENCRYPTION_KEY`) and `npm run db:migrate`.
- **Known broken:** the widget rendering / detection issues (see milestone 4).
- **No tests, no typecheck script.**
- **Demo needs BYO credentials** — the only data source type is Snow Leopard,
  which needs an API key + uploaded datafile. Nothing works out of the box.
- Last real work was 2026-03-30 ("small changes"). The full UI and the Snow
  Leopard happy path are built; everything in _Target architecture_ below is
  not started.

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

Replace localStorage with a local SQLite database, via **Prisma 6** (`prisma-client-js`
generator, `@prisma/client` import — Prisma 7 was tried and reverted: its config
split and "agent skills" scaffolding add friction with no payoff here).

- Tables: `DataSource` (**done**), then `Dashboard`, `Widget` (layout inline).
- Accessed only from route handlers, never the client (`lib/db.ts` is
  `server-only`).
- Secrets (API keys) encrypted at rest with AES-256-GCM (`lib/crypto.ts`).
- Migration path (proven on `DataSource`): keep the hook's return shape; swap its
  internals from `lib/store.ts` to `fetch` against new `/api/**` routes.
  `useDataSources` did change `add`/`remove` to async — the dashboard/widget
  hooks will too.
- **Still to do:** `Dashboard` + `Widget` tables and a one-time
  import from `localStorage` so existing local data isn't lost.

### Retrieval → pluggable engine — done

- `QueryEngine.retrieve(query, source) → { rows, columns:[{name,type}], sql,
  explanation, truncated }` (`lib/query-engine.ts`). `/api/ai/widget` picks the
  impl by `source.type`, then `resolveSpec` → `{ spec, rows }`.
- **`snowLeopardEngine`** — hosted NL→data.
- **`sqlEngine`** (`lib/engines/sql/*`) — uploaded CSV/`.db` → per-source SQLite
  (`data/sources/<id>.db`, `better-sqlite3`) → Claude writes one SELECT →
  `validateSql` (keyword/function scan + `.prepare()` + `stmt.reader`) → one
  retry with the failure reason → run on a `{ readonly: true }` connection.
  Ported + hardened from the SpeedySheets CLI project.
- **`runSql(sql, source)`** (`lib/engines/sql/index.ts`) — re-runs a stored
  SELECT (same `validateSql` + readonly connection, no LLM). Powers widget
  refresh.
- **Deferred:** "Run SQL directly" mode (`/api/ai/sql` + a chat toggle) so file
  sources work with no Anthropic key; cutting SnowLeopard; a Postgres engine.

### Viz agent → pluggable model — done

- `VizModel.proposeSpec(ctx) → WidgetSpec | null` (`lib/viz/model.ts`).
- `ClaudeVizModel` (Haiku, one strict forced tool) when `getAnthropicKey()` has
  a key; `detectSpec` heuristic otherwise and on any agent failure.
- Later: `OllamaVizModel` for a no-API-key local option.
- Phase 2 (not built): a `request_new_data` tool so "break it down by year" /
  "only the top 3" re-query instead of the user rephrasing. Route loops
  proposeSpec → request_new_data → engine.retrieve → proposeSpec (max 1).

### Data sources → typed connections

`DataSource.type` picks the engine. `datafileId` / `apiKeyCipher` are nullable
(SnowLeopard only).

- `snowleopard` — `{ apiKey, datafileId }`
- `files` — one or more uploaded `.csv` / `.db` files, ingested into
  `data/sources/<id>.db` (one table per file / per source-db table).
  Multi-file → multi-table → joins. Tables are managed from the expanded row
  on `/data-sources`: **Add files** (`POST …/files`; a same-named file
  replaces its table) and a per-table drop (`DELETE …/tables/[name]`).
- `sheets` — a Google spreadsheet, one table per tab, in the same per-source
  SQLite DB. `lib/integrations/google/*` — Desktop OAuth (loopback, PKCE,
  `drive.file`), the Drive Picker, `syncSheet` (batchGet → `createTable`),
  `resyncSource` / `syncDueSheets` (opportunistic, `modifiedTime`-gated), a
  per-source `refreshInterval`. See `docs/google-sheets.md`.
- Later: `postgres`.

A bundled zero-setup sample is a follow-up.

### Secrets — done

- All keys (per-source SnowLeopard, app-level Anthropic) stored encrypted
  (AES-256-GCM, `lib/crypto.ts`) in the local DB, keyed by
  `DATA_SOURCE_ENCRYPTION_KEY` from `.env`. `.env` `ANTHROPIC_API_KEY` is an
  optional override.
- The client sends a `dataSourceId` / `priorSpec`, never a key. Nothing secret
  in a client payload or client-facing type.

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

## Suggested order of work

1. ~~**Warm-up:** clean the dead deps.~~ Done (commit `2321de8`). Still open:
   bump `next` 16.2.1 → 16.3.x to clear the 3 audit warnings.
2. ~~**Prisma + SQLite, `data_sources` first** + secrets fix.~~ Done
   (`feat/prisma-data-sources`). Data sources persist in SQLite; keys encrypted
   at rest; `/api/ai/retrieve` + `/chat` take a `dataSourceId`.
3. ~~**`Dashboard` + `Widget` to Prisma**~~ Done
   (`feat/prisma-dashboards-widgets`). Includes the one-time localStorage import
   and deletes `lib/store.ts`.
4. Milestone 4 — **done**: widget-system rework (`feat/widget-system`, see
   below), then `QueryEngine` + the Claude viz agent + editable widgets
   (`feat/viz-agent`). Still open: a bundled zero-setup sample SQLite source.
5. ~~**Own NL→SQL engine** — CSV / `.db` upload, `sqlEngine`.~~ Done
   (`feat/sql-engine`).
6. ~~**Table management + refreshable widgets**~~ Done (`feat/widget-refresh`):
   add/replace/drop tables on a `files` source; widgets store `query` +
   `dataSourceId` and re-run on demand.
7. ~~**Google Sheets** (`type: "sheets"`)~~ Done (`feat/google-sheets`):
   Desktop OAuth (loopback, PKCE, `drive.file`), Drive Picker, `syncSheet`,
   per-source `refreshInterval` enforced opportunistically. See
   `docs/google-sheets.md`.
8. **Cleanup pass:** cut SnowLeopard; remove the remaining fake UI (the
   `DashboardSettings` alert toggles + its now-superseded refresh-interval
   selector); a bundled zero-setup sample; CI; the README.

### Widget system rework — done (`feat/widget-system`)

All five points landed as one commit each, plus a menu fix:

1. `widget-detector` ignores `id`/key/date columns when picking a measure; pie
   only on a "breakdown/share/percentage" query with ≤8 slices.
2. Shared `{ rows, xKey, series }` contract in `lib/widget-data.ts`
   (`normalizeChartData` also repairs legacy widgets); `WidgetCard` renders one
   bar/line per series with a legend.
3. Per-type default sizes (`lib/dashboards.ts` `defaultSizeFor`); charts fill
   the card via `ChartFrame`; truncated/angled labels, compact numbers.
4. `parseChartIntent` — "pie chart of X" / "as a table" / "just the number"
   override the shape heuristic when the data supports it.
5. `ChatPanel` keeps the last widget; a refinement message ("make that a pie
   chart") re-renders it via `retypeSpec` with no SnowLeopard call.
6. Fixed the widget options menu (was clipped by the card's `overflow-hidden`
   — now the Radix `DropdownMenu`).

### Viz agent + editable widgets — done (`feat/viz-agent`)

1. Widgets store raw rows + a `WidgetSpec`; `applySpec` renders (sort, cap,
   repair). `detectWidget` → `detectSpec` (real column names).
2. `QueryEngine` / `snowLeopardEngine`; route renamed `/api/ai/widget`.
3. `/settings` + `Setting` table for the encrypted Anthropic key.
4. `ClaudeVizModel` (Haiku, strict forced tool) + `resolveSpec` fallback chain.
5. `WidgetEditPanel` — type / title / x-axis / series / sort, live, no agent call.

### Table management + refreshable widgets — done (`feat/widget-refresh`)

1. `Widget` gains `query` + `dataSourceId` (`onDelete: SetNull`). The widgets
   POST route only stores `query` for `files` sources — SnowLeopard SQL can't
   be re-run, so those widgets get no refresh control.
2. `runSql(sql, source)` (`lib/engines/sql/index.ts`) — re-runs a stored SELECT
   through `validateSql` + a readonly connection, no LLM.
   `POST /api/widgets/[id]/refresh` persists the fresh rows.
3. `useWidgets` → `refresh(id)` / `refreshAll()`; `WidgetCard` "Refresh data"
   item (only when `widget.query`); dashboard header "Refresh all".
4. `lib/engines/sql/tables.ts` — `readTables()` / `dropTable()`.
   `POST /api/data-sources/[id]/files` (a same-named file replaces its table),
   `DELETE /api/data-sources/[id]/tables/[table]`, both surfaced in the
   expanded `SourceRow` on `/data-sources`.

### Google Sheets — done (`feat/google-sheets`)

1. `DataSource` gains `sheetId` / `sheetModifiedAt` / `lastSyncedAt` /
   `refreshInterval` / `syncError`. `lib/integrations/google/*`: `auth`+`token`
   (OAuth client, encrypted `Setting` rows, in-memory access-token cache),
   `rest` (Sheets/Drive GET), `sheets` (`parseSpreadsheet` + `syncSheet`),
   `sync` (`isDue` / `resyncSource` / `syncDueSheets`), `ids`, `intervals`.
2. OAuth loopback: `/api/integrations/google/{start,callback,credentials,token}`
   + a status/disconnect handler. PKCE verifier/state in a short-lived httpOnly
   cookie. Scope `drive.file` (non-sensitive → consent screen can be
   "production" → refresh tokens don't expire).
3. Drive Picker (`lib/picker/load.ts` + `GoogleSheetDialog`) — the one place a
   Google token (short-lived, read-only) reaches the client.
   `POST /api/data-sources/sheets` validates via Drive, creates, `syncSheet`s,
   rolls back on failure.
4. `runSql` / `/api/ai/widget` / widget-refresh treat `sheets` like `files`.
   Sheets widget refresh re-pulls from Google first. `POST …/[id]/sync` +
   "Sync now"; interval `Select` via `PATCH …/[id]`. `syncDueSheets` runs
   (bounded) from the dashboard-widgets GET and (background) from data-sources
   GET.

## "v1 done" checklist

- [x] Secrets server-side only (encrypted at rest)
- [x] SQLite persistence — data sources, dashboards, widgets, settings
- [x] `QueryEngine` abstraction; SnowLeopard + `sqlEngine` behind it
- [x] LLM viz agent (Claude Haiku) with a heuristic + edit-panel floor
- [x] Own NL→SQL data engine — CSV / `.db` upload, no vendor dependency
- [ ] One bundled zero-setup data source (sample CSV/SQLite), with matching
      example prompts in `ChatPanel`
- [x] NL-query → widget flow (agent + heuristic + editable spec)
- [ ] Remove dead/fake UI (alert toggles, non-functional refresh interval,
      dead `AddWidgetModal`, unused `/api/ai/chat`)
- [~] `npm run typecheck` + `npm run test` exist; Vitest covers the SQL engine —
      still want `widget-detector` / route coverage + CI
- [ ] README: what it is, screenshots/GIF, one-command run, short architecture note
- [ ] Deployed demo (Vercel) or a documented one-command local run
- [ ] Preserve the Figma design link:
      <https://www.figma.com/design/IOpFAuI3PlGilnuELgoBMy/Customizable-Data-Dashboard-App>

## Known debt

- `components/dashboard/DashboardSettings.tsx` — scheduled/threshold alert
  toggles and the refresh-interval selector are non-functional local state.
- `components/dashboard/AddWidgetModal.tsx` — dead (not imported); delete or wire.
- `app/dashboard/[id]/page.tsx` — "Last updated" renders `new Date()` every
  render, not a stored timestamp.
- `app/api/ai/chat/route.ts` — streaming chat route on the old
  `{ userQuery, dataSourceId }` shape, unused by the UI; delete or revive.
- No error boundary or offline handling around retrieval / the agent.
- `Dashboard.widgetCount` (client type) is computed server-side per request but
  not reflected back after add/remove without a refetch.
- Legacy widgets (pre-`feat/viz-agent`) have collapsed data + no spec — they
  render via the `normalizeChartData` fallback but can't be re-mapped in the
  edit panel.
