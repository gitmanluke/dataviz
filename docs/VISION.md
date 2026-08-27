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

## Where it stands (updated 2026-08-27)

- **Data sources persist in local SQLite via Prisma 6**, and SnowLeopard API
  keys are encrypted at rest and never leave the server (branch
  `feat/prisma-data-sources`). Retrieval routes take a `dataSourceId`.
- **Dashboards + widgets still on localStorage** — next milestone, same recipe.
- **Builds clean.** `npm run build` passes (Next 16, Turbopack), TypeScript OK.
- **`npm install` works with no flags.** 3 `npm audit` warnings remain, all
  cleared by a `next` 16.2.1 → 16.3.x bump (not yet done).
- **`npm run lint` — 8 errors, all pre-existing.** 3 in our code:
  `set-state-in-effect` in `hooks/useDashboards|useWidgets` (the
  load-from-localStorage-on-mount pattern — goes with the next migration) and
  `ChatPanel.tsx`. The other 5 are in vendored `components/ui/` (carousel,
  chart×2, sidebar, use-mobile) — clear by regenerating those from shadcn.
- Setup now needs `.env` (copy `.env.example`, generate
  `DATA_SOURCE_ENCRYPTION_KEY`) and `npm run db:migrate`.
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

### Retrieval → pluggable engine

Snow Leopard is the current engine, not a commitment.

- Define `interface QueryEngine { retrieve(query, source): Promise<QueryResult> }`
  with `QueryResult = { rows, columns, sql?, explanation? }`.
- `SnowLeopardEngine` wraps today's client. Later: `SqlEngine` (direct SQL
  against a SQLite/Postgres source, no NL step), possibly a local-LLM engine.
- `widget-detector.ts` already takes plain rows — keep it that way; it never
  learns which engine produced them.
- `app/api/ai/retrieve` becomes a thin adapter over the engine (verification is
  already folded into `POST /api/data-sources`).

### Data sources → typed connections

A data source is `{ id, name, type, config }`. The `DataSource` model already has
a `type` column (defaults to `snowleopard`); today `datafileId` + encrypted
`apiKeyCipher` are explicit columns. When a second type lands, move the
type-specific fields into a JSON `config` column.

- `snowleopard` — `{ apiKey, datafileId }` (today)
- `sqlite` — `{ path }` (natural for a local app; the Snow Leopard sample
  dataset is itself a `.db` file)
- `csv` — uploaded file loaded into a local table
- `postgres` — connection string (later, if ever)

MVP ships `snowleopard` plus one bundled sample so the app works with no signup.

### Secrets — done

- API keys are stored encrypted (AES-256-GCM, `lib/crypto.ts`) in the local DB,
  keyed by `DATA_SOURCE_ENCRYPTION_KEY` from `.env`.
- The client calls `/api/ai/retrieve` with a `dataSourceId`; the route looks up
  the row and decrypts server-side. No `apiKey` in any client payload or in the
  client-facing `DataSource` type.
- Future option if it matters: per-source key derivation, or a `.env`-only mode.

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
3. **`Dashboard` + `Widget` to Prisma** using the same recipe; add the
   one-time localStorage import.
4. **`QueryEngine` abstraction** + bundled sample SQLite data source so the
   app works with no signup — **and the widget-system rework** (see below).
5. **Cleanup pass:** remove fake UI, add `typecheck`/`test` scripts + Vitest +
   CI, write the README.

### Widget system rework (part of milestone 4)

Real data exposed that `lib/widget-detector.ts` and `WidgetCard` don't share a
data contract. Concrete failure: "top 5 superheroes by appearances" returned
`{ id, name, appearance_count }`; the detector's "1 string + multiple numerics"
rule fired (because `id` counts as numeric) and emitted `{ name, id,
appearance_count }`, but `WidgetCard`'s bar renderer is hardcoded to
`<Bar dataKey="value">` and `height={200}`, so it drew axes and no bars.

Needs:
- Detector: drop `id` / `*_id` / key-like columns from metric detection (keep
  them for the table view); pick the value column deliberately; revisit
  pie-vs-bar (ranking queries should stay bars even at ≤8 rows).
- One normalized shape for every chart type, or an explicit `{ nameKey,
  valueKeys[] }` in the detector output; renderer supports multi-series bars.
- Per-type default widget sizes (`hooks/useWidgets.ts` hardcodes `w:4 h:3`);
  charts fill the widget height instead of a fixed 200px; rotate/truncate long
  axis labels.

## "v1 done" checklist

- [x] Secrets server-side only (encrypted at rest)
- [~] SQLite persistence — data sources done; dashboards + widgets + localStorage
      import still to do
- [ ] `QueryEngine` abstraction; Snow Leopard behind it
- [ ] One bundled zero-setup data source (sample SQLite), with matching
      example prompts in `ChatPanel`
- [ ] NL-query → widget flow solid across all five widget types on the sample
      (blocked by the widget-system rework — see milestone 4)
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
- `app/api/ai/chat/route.ts` — streaming chat route, kept in sync with the new
  `dataSourceId` signature but still unused by the UI; decide whether it stays.
- No error boundary or offline handling around retrieval.
- `Dashboard.widgetCount` in `lib/types.ts` is stored but never kept in sync
  with actual widgets.
- An upstream SnowLeopard auth failure on `/api/ai/retrieve` surfaces as a bare
  `HTTP Error: 401` with a 500 status — could map to a friendlier 422.
