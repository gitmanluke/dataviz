# Google Sheets integration

Connect a Google spreadsheet as a data source. Each tab becomes a table in a
per-source SQLite DB (`data/sources/<id>.db`), queried by the same `sqlEngine`
as uploaded files. Bound widgets re-run when the sheet changes — manually
("Refresh data" / "Sync now") and on a per-source interval.

## How it works

- **Auth:** a Desktop-app OAuth client, PKCE, loopback redirect
  (`/api/integrations/google/callback`). The **refresh token** is stored
  AES-GCM-encrypted in a `Setting` row and never leaves the server. Access
  tokens are minted on demand and cached in memory
  (`lib/integrations/google/auth.ts` + `token.ts`).
- **Scope:** `drive.file` only — non-sensitive, so no Google verification and
  refresh tokens don't expire once the consent screen is "In production". The
  Drive Picker still browses the whole Drive (it runs on the user's own Google
  session); only the picked file is exposed to our token.
- **Picker:** a browser-only widget. `GET /api/integrations/google/token`
  returns a short-lived, read-only access token + the API key for it. This is
  the one spot a Google token reaches the client — see CLAUDE.md.
- **Sync:** `syncSheet` (`lib/integrations/google/sheets.ts`) reads every GRID
  tab via one `values:batchGet`, first row = headers, and mirrors them into the
  source DB (tables for removed/renamed tabs are dropped). `resyncSource`
  (`sync.ts`) checks Drive `modifiedTime` first and only re-pulls + re-runs
  widgets if it advanced. `syncDueSheets` runs opportunistically from the
  dashboard-widgets and data-sources GET routes, gated by `isDue`.
- Row cap per tab: `SHEET_ROW_CAP` (50,000).

## Google Cloud setup (one-time)

1. **Create / pick a project** at <https://console.cloud.google.com>.
2. **Enable APIs** (APIs & Services → Library): **Google Sheets API**,
   **Google Drive API**, **Google Picker API**.
3. **OAuth consent screen** (APIs & Services → OAuth consent screen):
   - User type **External**.
   - Fill app name + your email.
   - **Scopes:** add `.../auth/drive.file`.
   - Add **yourself as a test user**.
   - **Publish app → "In production".** Accept the "unverified" state — this is
     what stops refresh tokens from expiring after 7 days. (`drive.file` is
     non-sensitive so no verification is required.) If you leave it in
     "Testing", you'll have to reconnect about weekly.
4. **OAuth client** (Credentials → Create credentials → OAuth client ID):
   - Application type **Desktop app**.
   - Note the **client ID** and **client secret**. Desktop clients accept any
     `http://localhost:<port>/...` loopback redirect, so nothing to register.
5. **API key** (Credentials → Create credentials → API key):
   - Restrict it: **Application restrictions → HTTP referrers** →
     `http://localhost:*`; **API restrictions** → Sheets + Drive + Picker.

## In the app

1. `npm run db:migrate` (once), then `npm run dev`.
2. **`/settings` → Google Sheets** → paste client ID / secret / API key → **Save
   credentials** → **Connect Google** → approve on Google → you land back on
   `/settings` showing **Connected**.
3. **`/data-sources` → Add data source → Connect Google Sheets** → **Choose from
   Google Drive** → pick a spreadsheet → set a refresh interval → **Add**.
   Expand the row to see one table per tab.
4. Open a dashboard → AI Assistant → pick the sheets source → ask a question →
   add the widget. (Needs an Anthropic key, same as file sources.)
5. Edit the sheet → widget ⋮ → **Refresh data** (or the source row's **Sync
   now**). With an interval other than "Manual", reloading a dashboard that
   uses the source refreshes it automatically when Drive reports a change.

## Limitations

- Consent screen left in "Testing" → refresh tokens die after ~7 days; the
  Settings card shows a reconnect prompt.
- A renamed tab is treated as a new table; a widget bound to the old name will
  show a refresh error until re-created.
- Sync is opportunistic (on app activity), not a background scheduler.
- One Google account per app.
