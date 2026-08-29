@AGENTS.md

# CLAUDE.md

Working notes for Claude Code on this repo. For product direction and the
roadmap, see `docs/VISION.md`.

## What this is

DataViz — a local-first dashboard builder. Point it at a data source, ask a
question in plain English, and it turns the result into a chart / stat / table
widget you arrange on a dashboard. Single user, runs on your own machine.
Primary goal right now: a clean, working portfolio piece.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS 4, shadcn/ui (components in `components/ui/` — vendored, don't hand-edit)
- recharts (charts), react-grid-layout (dashboard grid), sonner (toasts)
- Data layer: two `QueryEngine`s picked by `DataSource.type` —
  `sqlEngine` (uploaded CSV / `.db` files → per-source SQLite → NL→SQL via
  Claude, ported from the SpeedySheets project) and `snowLeopardEngine`
  (`@snowleopard-ai/client`)
- Viz layer: Claude Haiku (`@anthropic-ai/sdk`) behind a `VizModel`, with the
  `detectSpec` heuristic as the always-available fallback
- SQLite: Prisma 6 for **app data**; `better-sqlite3` for **uploaded user data**
  (`data/sources/<id>.db`, gitignored). `papaparse` for CSV.
- No localStorage for app state.

## How a widget is made

`ChatPanel` → `POST /api/ai/widget` → engine `.retrieve()` (→ rows + inferred
column types; the SQL engine has Claude write a SELECT, then `validateSql` +
one retry, then runs it on a `{ readonly: true }` connection) → `resolveSpec()`
(`ClaudeVizModel` if an Anthropic key is set, else `detectSpec`) → `{ spec,
rows }`. The widget stores the **raw rows** in `data` and a `WidgetSpec` (type /
xKey / series / sort) in `spec`. `WidgetCard` renders `applySpec(data, spec)`.
The edit panel writes `spec` straight to `PATCH /api/widgets/[id]` — no agent
call.

A widget from a `files` source also stores the `query` (+ `dataSourceId`) that
produced its rows. `POST /api/widgets/[id]/refresh` re-runs that SQL via
`runSql` and swaps in fresh rows — surfaced as "Refresh data" per widget and
"Refresh all" on the dashboard. SnowLeopard widgets have no re-runnable SQL, so
they get no `query` and no refresh control.

## Layout

- `app/` — routes. `app/api/**` route handlers are the only server code.
- `components/` — feature components; `components/ui/` is generated shadcn.
  `MigrationGate` (root layout) does the one-time localStorage → SQLite import
  and is the *only* component allowed to touch localStorage.
- `hooks/` — `useDashboards`, `useWidgets`, `useDataSources` each fetch their
  `/api/**` routes with optimistic local updates; `useWidgetAgent` calls
  `/api/ai/widget`. Components go through these and never `fetch` for data directly.
- `lib/` — `db.ts` (Prisma singleton), `crypto.ts` (AES-256-GCM secrets),
  `settings.ts` (`getAnthropicKey`), `anthropic.ts` / `viz/*` (the viz agent),
  `query-engine.ts` + `engines/*` (data: `columns.ts` shared inference,
  `snowleopard.ts`,
  `sql/{store,validator,ingest,ingest-files,nl-to-sql,tables,index}.ts` —
  `index.ts` also exports `runSql` (re-run a stored SELECT, no LLM) for widget
  refresh; `tables.ts` has `readTables` / `dropTable`),
  `data-sources.ts` (row → client), `widget-detector.ts` (`detectSpec`, pure),
  `widget-spec.ts` (`applySpec`, pure), `widget-data.ts` (chart helpers, pure),
  `dashboards.ts`, `types.ts`. Files that touch the DB, fs, or an API key import
  `"server-only"`; the pure `sql/{validator,ingest}.ts` stay importable by Vitest.
- `prisma/` — `schema.prisma` and committed `migrations/`. `dev.db` is gitignored.
- `pydantic-ai/` — standalone Python example, not part of the web app.

## Commands

- `npm run dev` — dev server (port 3000 is often taken on this machine; it will
  fall back to 3001, or use `PORT=3100 npm run dev`)
- `npm run build` — production build; run this before claiming a change compiles
- `npm run lint` — eslint
- `npm run test` — Vitest (`lib/**/*.test.ts`); `npm run typecheck` — `tsc --noEmit`
- `npm run db:migrate` — create/apply a Prisma migration after editing the schema
- `npm run db:studio` — browse the local DB

Requires `.env` (copy `.env.example`) with `DATABASE_URL` and a generated
`DATA_SOURCE_ENCRYPTION_KEY`. `ANTHROPIC_API_KEY` is optional (or set it at
`/settings`). No test or typecheck script yet (see VISION).

## Conventions

- TypeScript strict; no `any`. Prefer `unknown` + narrowing (see `widget-spec.ts`).
- Don't silence lint/TS errors with `void x` or `eslint-disable` — fix the cause.
- Hooks own persistence via the API. A component that reads/writes `localStorage`
  or `fetch`es a data route directly is a bug (`MigrationGate` is the one
  sanctioned localStorage user).
- `detectSpec` / `applySpec` / `widget-data.ts` are pure and must stay that way.
  The `VizModel` and `QueryEngine` are the seams for new providers/engines.
- The viz agent is best-effort: `ClaudeVizModel.proposeSpec` returns `null` on
  any failure and the caller falls back to `detectSpec`. Never let it throw.
- `components/ui/` is vendored shadcn — regenerate, don't edit.
- Secrets never reach the client. API keys are encrypted at rest in the DB
  (`lib/crypto.ts`); route handlers decrypt them; the client sends a
  `dataSourceId`, never a key. Keep it that way for any new data engine.
- Don't build fake UI. If a feature isn't wired, don't ship a control for it
  (the alert toggles and refresh-interval in `DashboardSettings` are existing
  examples to fix or cut).

## Next.js 16

See AGENTS.md. This is newer than your training data — check
`node_modules/next/dist/docs/` before using framework APIs you're unsure about.

## Working style

- Solo project. No mandatory multi-agent pipeline; the `.claude/agents/` defs
  are available if useful, not required.
- Small, reviewable changes. State what you verified (build ran? lint clean?).
- Match surrounding style. Don't add dependencies without a reason.
