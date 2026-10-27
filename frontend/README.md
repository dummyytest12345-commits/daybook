# Daybook

A personal work diary (React + Vite, plain JavaScript) that turns daily task notes into reports.
All data stays in your browser (localStorage). Local accounts (register / sign in) keep each user's data separate. No tracking.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build (also generates the PWA service worker)
npm run test       # Vitest: selectors, parsers, exporters, store, components
npm run e2e        # Playwright. Starts the API on port 4100 against Atlas in a throwaway "daybook_e2e" database (dropped afterwards) plus the built app
npm run lint
```

## What is in it

- **Today**: quick add ("Fix bug tomorrow 2h #consent !high @FE-122"), progress ring, carry-over panel, streak, standup copy.
- **Log**: Day (drag reorder), Week (drag between days), Month, Board (drag to change status), Table (sortable, column chooser, virtualised past 500 rows). Filters and period live in the URL.
- **Analytics**: 8 KPI cards with deltas, stacked status bars, donut, trend, burn-up, hours vs capacity, modules, weekday, task aging, period comparison, calendar heatmap, pivot, rule-based insights. Click a bar/slice to filter; every chart has "Data" and PNG/CSV download.
- **Reports**: Daily/Weekly/Monthly/Manager/Custom templates to Excel (multi-sheet, real SUM formulas), PDF (A4 landscape, charts), CSV (BOM, formula-injection safe), Markdown/plain text, print.
- **Import**: CSV, XLSX, JSON backup, and pasted legacy notes; column mapping, preview, error report, duplicate handling.
- **Power features**: timer, command palette (Ctrl+K), shortcuts (`?`), recurring tasks, subtasks, undo/redo with toasts, reminders, dark theme, installable offline PWA.
- **Settings**: week start, capacity, date format, hours mode (equal split / manual / timer), status labels, modules (rename updates history), holidays, backups, clear data.

## Progress (0-100 %)

- Moving a task to **In Progress** starts it at **0 %**; the user then updates it (slider, 0/25/50/75/100 chips, or the task form); **Completed** is always **100 %**; setting 100 completes it, leaving 0 starts it. Blocked keeps the value reached. Carried-forward days continue from the same percentage; completing the last day marks the earlier days 100 %.
- UI: gradient bar with a moving sheen, ring with the stage in words ("Over halfway"), styled slider with a value bubble, quick chips (`components/ui/Progress.jsx`, `components/tasks/ProgressControl.jsx`).
- Analytics: **Avg progress** KPI (with change vs previous period), **Progress of open tasks** distribution chart, average progress per project (cards, project page, tooltip).

## Team projects (needs the backend)

Start the API (`../backend`, see its README), then open **Team** (`/team`). Connecting creates a *Daybook Cloud* login for this device (scoped per local account); the personal log stays local.

- **Add people by email**: type an address, the app looks it up. Has an account → "Add to project" (they get an email + notification). No account → "Send invitation"; the email links to `/join`, where they create their account and join automatically.
- **Per-member progress**: assign tasks to several people; each updates *their own* progress (with a note); the task's overall progress is the average, 100 % for everyone completes it. Per-person bars on every task and on the People tab.
- **Chat**: project chat and a thread per task, real time (typing indicator, reactions, edit/delete, `@mentions`, unread badges). Progress, status and join events appear as activity lines.
- Notification bell (live), presence ("2 online"), roles (owner / can edit / view only).
- Real time via Socket.IO; set `VITE_API_URL`.

## Carry forward and threads

- Unfinished tasks are **carried to the next working day automatically** (when the app opens, when you return after midnight, and while it is open). Each day gets its own row, so day views, hours and reports stay per-day; the rows share a **thread** and keep the same project reference (`WEB-12`). Weekends, leave and holidays are skipped; recurring tasks and tasks older than 21 days (configurable) are not carried. It is idempotent: copies get deterministic ids, so reopening or using two tabs never duplicates.
- **Thread view** (click the `Day 3` chip or open a task): a conversation of the days the work was open, with progress notes as message bubbles, "carried forward · 2 days later" notes, who resolved what, and a box to add today's update.
- **Complete later**: completing a carried row marks its earlier days completed too ("all days completed", setting: or leave them as they were). Reopening it reopens the days it resolved. Completing an *earlier* day (you forgot to tick it) removes the later carried copies.
- **Finished on another day…**: pick the day the work really ended (any day from the first row to today); a row is created for it if needed.
- **Remove from today** deletes a carried copy and stops it from coming back; **Stop carrying forward / Resume** control a task without deleting. Every action is undoable and tells you what else changed. Streaks ignore rows that were only carried automatically.

## Startup, redirects and theme

- **No pointless loading for signed-out visitors**: the session lives in localStorage, so the app knows synchronously whether you are signed in. Signed out on a private URL goes straight to `/login`; `/` shows the public landing page. Signed in, a branded loading screen (CSS ring from `index.html`, then the Lottie loader) is shown for at least ~0.45 s while your data opens, so it never blinks.
- **One theme everywhere**: light, dark or system, stored per device (`daybook:theme`) and applied before first paint, so the landing page, sign-in and the app always agree and there is no flash. Toggle it from any page; Settings has the same choice. Status colours, project chips and focus rings have dark variants.

## Loading animation

Sign-in, registration and the session check show a Lottie animation (built in code so it follows the theme, played by the light lottie-web player loaded on demand) instead of text. It stays up at least 0.7 s so it does not flash, and shows a still frame for `prefers-reduced-motion`.

## Projects (optional)

- Create projects from **Projects** (`/projects`) or the sidebar: name, 2-6 character **key** (tasks are numbered `KEY-1`, `KEY-2`), colour, one of 24 hand-drawn SVG icons, status, start/target dates, description.
- Tasks without a project keep working exactly as before. **Move tasks any time**: row menu, bulk bar, task modal, `Move to project…` dialog or the command palette. Moving renumbers into the target project; moving out clears the project. Everything is undoable.
- A project page has **Overview** (KPIs, status donut, burn-up), **List** (grouped by status, quick add into the project) and a **Board** with per-column **WIP limits** (columns turn red when over).
- Also: favourites, archive/restore, duplicate (with or without tasks), delete (keep tasks or delete them too), health badge (on track / at risk / off track, always icon plus text), due dates with overdue badges, project filter on Log/Analytics/Reports, per-project breakdown chart, pivot by project, project column in imports and exports.
- Quick add: `~KEY` picks a project, `due:+3d` / `due:2026-10-01` sets a due date.
- Data model: `projects` are stored per user; tasks gain optional `projectId`, `number`, `dueDate`. Older tasks and older backups (schema 1) load unchanged as "no project". Tasks pointing at a deleted project are treated as unassigned.

## Landing page

`/` shows a public landing page to signed-out visitors (and Today once signed in): animated three.js hero (task cards orbit a progress ring, click a card to complete it), self-playing quick-add parser and Kanban/WIP demos, an interactive 3D bar chart, scroll reveals, FAQ. The 3D scenes load in a separate chunk, pause when off screen or in a hidden tab, dispose their GPU resources, show a still frame for `prefers-reduced-motion`, and fall back to SVG without WebGL.

## Accounts and data separation

- Register and sign in at `/login` and `/register`. Passwords are salted and hashed (PBKDF2-SHA256 via WebCrypto); five wrong attempts lock that email for 30 seconds. "Keep me signed in" stores the session in localStorage, otherwise it ends with the tab. Sign-in/out syncs across tabs.
- Every user's data lives under its own key prefix (`worklog:v1:u:<userId>:*`), so tasks, settings, views and backups never mix. Signing out flushes writes and clears all in-memory data.
- The first account created on a browser adopts any data from before accounts existed.
- Settings has change name, change password, sign out and delete account (removes that user's data).
- Limits: accounts are on this device only, there is no email reset, and anyone with access to the browser profile can read localStorage. This separates users, it is not server-grade security. The backend phase would replace `services/auth.js`.

## SEO and icons

- Landing page has JSON-LD (WebSite, Organization, SoftwareApplication, FAQPage, BreadcrumbList), a semantic heading outline, skip link, per-page title/description/canonical/Open Graph, and static fallback content in `index.html`. `sitemap.xml`, `robots.txt` (private pages disallowed) and `llms.txt` are provided.

- `index.html` has title, description, canonical, Open Graph, Twitter card, theme colours and JSON-LD; `useSeo` sets per-page titles. Login/register are indexable, signed-in screens are `noindex`.
- Set `VITE_SITE_URL` in `.env` to your deployed URL: the build then emits `sitemap.xml` and `robots.txt` with absolute URLs.
- SVG logo (`public/favicon.svg`, `Logo.jsx`), inline illustrations, PNG icons (192/512/maskable/apple-touch) and the 1200x630 social image are generated from SVG by `node scripts/generate-icons.mjs`.

## Architecture

`components -> hooks -> selectors (pure) -> Zustand store -> repository -> storage`

- `src/selectors/` is the whole analytics engine (pure, tested).
- `src/services/repository/` defines the `WorkLogRepository` boundary. `LocalStorageRepository` is zod-validated, versioned (`worklog:v1:*`), debounced, handles quota errors and cross-tab sync, and keeps 5 rolling daily snapshots. Add an `ApiRepository` to move to a backend; tasks already have client ids, `updatedAt` and soft-delete `deletedAt`.
- Dates are `YYYY-MM-DD` strings, never `Date`, to avoid timezone shifts.
- ExcelJS, jsPDF and html-to-image load only when you export or import Excel.

## Not done yet

Phase 10 (backend/sync/auth) is intentionally out of scope. Activity history is session-only.

## Accounts, storage and offline mode

- **Accounts and data live on the server.** Sign-in and registration go to the backend (`/api/auth/*`); passwords are never stored on the device, only a login token. The same login covers Teams, so there is no second sign-in. If the token is missing, Teams asks you to confirm your password once.
- **The device keeps an offline copy.** All changes are saved locally first. When offline, an "You're offline" banner shows and edits queue on the device.
- **Reconnecting:** the session is verified with `/api/auth/me` first. If it was rejected you are signed out and sent to `/`; otherwise queued changes upload through `/api/sync/push` (last-write-wins, idempotent) and the server's changes are merged back.
- **Settings > Sync and device storage:** optionally remove this device's data on sign-out, or rebuild the device copy from the server. Both only happen after `/api/sync/summary` confirms the server holds everything.
- Older local-only accounts are moved to the server the first time you sign in with their password.
