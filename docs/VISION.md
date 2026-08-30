# DataViz — Vision & Roadmap

_Last updated 2026-08-30._

## Context

Rebuilt from a Figma Make export into a Next.js app; a solo project split from
the original team repo into `gitmanluke/dataviz`. A standalone Snow Leopard +
PydanticAI reference lives in `pydantic-ai/` (not part of the web app).

## What it is

A **local-first dashboard builder**. Connect a data source, ask questions in
plain English, and DataViz turns each answer into a chart, stat, or table widget
you drag onto a dashboard. Everything runs and stays on your machine.

The loop:

1. Add a data source — upload CSV / SQLite files, or connect a Google Sheet.
2. Open a dashboard, open the AI panel, ask a question.
3. Claude writes a SELECT against the source's schema; it's validated and run
   read-only; a second model picks the widget type (heuristic fallback).
4. Preview it, add it to the grid. Dashboards / widgets / layouts persist in
   local SQLite.

## Where it stands

- **All app data in local SQLite via Prisma 6** — data sources, dashboards,
  widgets, settings.
- **One data engine** (`sqlEngine`): every source gets a per-source SQLite DB
  (`data/sources/<id>.db`, `better-sqlite3`); Claude writes one SELECT against
  its schema; `validateSql` (keyword/function denylist + prepared-statement
  parsing + read-only check) rejects unsafe queries, with a one-shot retry; runs
  on a `{ readonly: true }` connection.
- **Two source types**: `files` (uploaded `.csv` / `.db`, add/replace/drop
  tables from `/data-sources`) and `sheets` (a Google spreadsheet, one table
  per tab).
- **Viz layer**: `ClaudeVizModel` (Haiku) picks the `WidgetSpec` when an
  Anthropic key is set, `detectSpec` heuristic otherwise. Widgets store raw
  rows + an editable spec; `/settings` page; per-widget edit panel.
- **Refreshable widgets**: every widget stores the `query` + `dataSourceId`
  that produced it. Per-widget "Refresh data" + dashboard "Refresh all" re-run
  it via `runSql` (no LLM).
- **Google Sheets** (`lib/integrations/google/*`): Desktop OAuth loopback +
  PKCE, `drive.file` scope, Drive Picker for selection, encrypted refresh token
  in a `Setting` row (only a short-lived read-only access token reaches the
  browser, for the Picker). A per-source `refreshInterval` (`manual`…`monthly`)
  re-syncs opportunistically on app activity, gated by a Drive `modifiedTime`
  check; a changed sheet re-runs its bound widgets.
- **Tests**: `npm run test` — 82 Vitest tests (SQL validator, ingestion,
  `runSql`, table management, Google token cache / `parseSpreadsheet` /
  `syncSheet` / `isDue` / id parsing). `npm run typecheck` clean; `npm run
  build` clean (Next 16, Turbopack).
- **`npm run lint`** — 6 errors, all in vendored `components/ui/` (carousel,
  chart×2, sidebar, use-mobile); clear by regenerating from shadcn.
- Setup: `.env` (`DATABASE_URL`, generated `DATA_SOURCE_ENCRYPTION_KEY`),
  `npm run db:migrate`. `ANTHROPIC_API_KEY` and Google credentials are optional
  and configurable at `/settings`.

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
  explanation, truncated }` (`lib/query-engine.ts`). `/api/ai/widget` calls it,
  then `resolveSpec` → `{ spec, rows }`. The interface stays even with one impl
  so the route + viz agent don't depend on how rows are fetched.
- **`sqlEngine`** (`lib/engines/sql/*`) — per-source SQLite
  (`data/sources/<id>.db`, `better-sqlite3`) → Claude writes one SELECT →
  `validateSql` (keyword/function scan + `.prepare()` + `stmt.reader`) → one
  retry with the failure reason → run on a `{ readonly: true }` connection.
  Ported + hardened from the SpeedySheets CLI project.
- **`runSql(sql, source)`** (`lib/engines/sql/index.ts`) — re-runs a stored
  SELECT (same `validateSql` + readonly connection, no LLM). Powers widget
  refresh.
- **Deferred:** "Run SQL directly" mode (`/api/ai/sql` + a chat toggle) so
  sources work with no Anthropic key; a Postgres engine.

### Viz agent → pluggable model — done

- `VizModel.proposeSpec(ctx) → WidgetSpec | null` (`lib/viz/model.ts`).
- `ClaudeVizModel` (Haiku, one strict forced tool) when `getAnthropicKey()` has
  a key; `detectSpec` heuristic otherwise and on any agent failure.
- Later: `OllamaVizModel` for a no-API-key local option.
- Phase 2 (not built): a `request_new_data` tool so "break it down by year" /
  "only the top 3" re-query instead of the user rephrasing. Route loops
  proposeSpec → request_new_data → engine.retrieve → proposeSpec (max 1).

### Data sources → typed connections

`DataSource.type` is `files` or `sheets`; both feed `sqlEngine`.

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

- All secrets (Anthropic key, Google OAuth client secret + API key + refresh
  token) stored encrypted (AES-256-GCM, `lib/crypto.ts`) in `Setting` rows,
  keyed by `DATA_SOURCE_ENCRYPTION_KEY` from `.env`. `.env` `ANTHROPIC_API_KEY`
  is an optional override.
- The client sends a `dataSourceId` / `priorSpec`, never a secret. The one
  exception: a short-lived, read-only Google access token for the Drive Picker
  (a browser-only widget) — see `CLAUDE.md`.

### Packaging (deferred)

"Local app" = clone + `npm run dev` for now. If it graduates to a real desktop
app, evaluate **Tauri** (light Rust shell) vs Electron. Not before v1.

## Sample data & the demo

DataViz stays a general-purpose dashboard builder — it makes no assumptions
about what kind of data you point it at.

- `sample/sales.csv` + `sample/products.csv` — a small B2B hardware dataset
  (orders joinable to a product catalog) that exercises every widget type: a
  15-month time series, categorical breakdowns, single headline numbers, and a
  cross-table join.
- **Still to do:** register the sample as a data source on first run (clone →
  one command → build a dashboard), and replace the hard-coded travel-survey
  example prompts in `ChatPanel` with sales ones.

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
8. ~~**Portfolio cleanup**~~ In progress (`chore/portfolio-cleanup`): cut
   SnowLeopard, removed the dead `AddWidgetModal` / `/api/ai/chat` /
   `DashboardSettings` fake UI. Remaining: README + GIFs, `LICENSE`, CI.

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
- [x] `QueryEngine` abstraction; `sqlEngine` behind it, no vendor dependency
- [x] LLM viz agent (Claude Haiku) with a heuristic + edit-panel floor
- [x] Own NL→SQL data engine — CSV / `.db` upload + Google Sheets
- [x] NL-query → widget flow (agent + heuristic + editable spec)
- [x] Remove dead/fake UI (`AddWidgetModal`, `/api/ai/chat`, `DashboardSettings`)
- [x] `npm run typecheck` + `npm run test`; Vitest covers the SQL engine + Google
      integration — still want `widget-detector` / route coverage
- [ ] `sample/` CSVs wired as example prompts in `ChatPanel`
- [ ] README: what it is, GIFs, one-command run, architecture note
- [ ] `LICENSE` + CI (`build && lint && test`)
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
