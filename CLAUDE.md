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
- Data/AI layer: Snow Leopard (`@snowleopard-ai/client`), treated as a
  swappable engine — see VISION
- Persistence: **all app data** (data sources, dashboards, widgets) → local
  SQLite via Prisma 6. No more localStorage for app state.

## Layout

- `app/` — routes. `app/api/**` route handlers are the only server code.
- `components/` — feature components; `components/ui/` is generated shadcn.
  `MigrationGate` (in the root layout) does the one-time localStorage → SQLite
  import and is the *only* component allowed to touch localStorage.
- `hooks/` — `useDashboards`, `useWidgets`, `useDataSources` each fetch their
  `/api/**` routes with optimistic local updates; `useSnowLeopard` wraps
  retrieval. Components go through these and never `fetch` for data directly.
- `lib/` — `db.ts` (Prisma singleton, server-only), `crypto.ts` (AES-256-GCM
  for secrets at rest, server-only), `dashboards.ts` (row → client serializers,
  server-only), `widget-detector.ts` (pure: rows → widget spec), `types.ts`,
  `snowleopard.ts` (server-only client factory + `verifyConnection`).
- `prisma/` — `schema.prisma` and committed `migrations/`. The `dev.db` file is
  local and gitignored.
- `pydantic-ai/` — standalone Python example, not part of the web app.

## Commands

- `npm run dev` — dev server (port 3000 is often taken on this machine; it will
  fall back to 3001, or use `PORT=3100 npm run dev`)
- `npm run build` — production build; run this before claiming a change compiles
- `npm run lint` — eslint
- `npm run db:migrate` — create/apply a Prisma migration after editing the schema
- `npm run db:studio` — browse the local DB

Requires `.env` (copy `.env.example`) with `DATABASE_URL` and a generated
`DATA_SOURCE_ENCRYPTION_KEY`. No test or typecheck script yet (see VISION).

## Conventions

- TypeScript strict; no `any`. Prefer `unknown` + narrowing (see `widget-detector.ts`).
- Don't silence lint/TS errors with `void x` or `eslint-disable` — fix the cause.
  `lib/widget-detector.ts:15` is existing debt to remove, not a pattern to copy.
- Hooks own persistence via the API. A component that reads/writes `localStorage`
  or `fetch`es a data route directly is a bug (`MigrationGate` is the one
  sanctioned localStorage user).
- Keep `widget-detector.ts` pure and engine-agnostic: plain rows in, widget
  spec out. New data engines adapt their output to that shape.
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
