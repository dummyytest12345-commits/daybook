# Daybook API

Express 5 + Mongoose (MongoDB **Atlas**) + Socket.IO. ESM, Node 20+.

## Run

```bash
cd backend
npm install
cp .env.example .env        # fill MONGODB_URI and JWT_SECRET (already done on this machine)
npm run check:db            # connects to Atlas and pings
npm run dev                 # nodemon
npm start                   # plain node
npm test                    # unit + integration + collaboration tests (Atlas, separate "daybook_test" database)
```

`.env` is git-ignored. The Atlas string must include the database name (`.../daybook?retryWrites=true&w=majority`).
The server refuses to start if `MONGODB_URI` points at localhost (you asked for Atlas only). In Atlas, **Network Access** must allow your IP.

## Layout

```
src/
  config/       env.js (validated config), db.js (Atlas connection)
  models/       User, Project, Task, DayLog, Settings (personal)  ·  Team.js (TeamProject, TeamTask, Message, Invite, Notification)
  validators/   zod schemas for every request body/query
  middleware/   auth (JWT), validate, error (one JSON error shape)
  controllers/  thin HTTP handlers
  services/     business logic: progress rules, thread/carry-forward rules, taskService, analyticsService, teamService, email, realtime
  templates/    email templates (HTML + plain text)
  routes/       index.js (personal API) · team.js (collaboration)
  sockets/      index.js (auth, user rooms) · team.js (team rooms, presence, typing)
tests/          logic (pure), api (personal API + sockets), team (collaboration)
```

## Personal API (`/api`, Bearer token)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET/PATCH/DELETE /auth/me`, `POST /auth/password` (5 wrong logins lock the account 15 min) |
| Tasks | `GET/POST /tasks`, `POST /tasks/bulk`, `PATCH /tasks/bulk`, `POST /tasks/bulk-delete`, `GET/PATCH/DELETE /tasks/:id`, `POST /tasks/:id/restore`, `PUT /tasks/:id/progress`, `POST /tasks/move` |
| Threads | `POST /tasks/carry-forward`, `POST /tasks/:id/forward`, `POST /tasks/:id/finish`, `GET /tasks/:id/thread`, `POST/DELETE /tasks/:id/updates` |
| Projects | `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id?mode=unassign\|delete`, `POST /projects/:id/archive\|restore\|duplicate` |
| Other | `GET/PUT /day-logs`, `GET/PUT /settings`, `GET /analytics/summary?from&to`, `GET /sync?since=`, `GET /sync/export`, `POST /sync/import` |

Progress rules (same as the web app): In Progress starts at **0 %**, Completed is **100 %**, Pending is 0 %, setting progress to 100 completes the task, leaving 0 starts it.

## Collaboration API (`/api/team`)

Shared projects live apart from personal data. Roles: `owner`, `editor` (add progress, create tasks), `viewer` (read + chat).

- `GET /users/search?email=&projectId=` tells whether an email has an account and whether they are already in or invited to the project (rate limited).
- `POST /projects/:id/members { email, role }`:
  - **account exists** → added immediately, gets an email + in-app notification
  - **no account** → pending invitation + invitation email; they **join automatically when they register** with that email (invites last 14 days; resend / revoke supported). `GET /invites/:token` is a public preview.
- Tasks: assign people; each assignee sets **their own** progress (`PUT /tasks/:id/my-progress {progress, note}`); the task's overall progress is the average; all assignees at 100 completes it, lowering reopens it.
- Chat: project chat and per-task threads, paging, edit/delete (own, owner can moderate), emoji reactions, `@mentions` create notifications, unread counts, system lines ("Ann set progress to 60 % on WR-1").
- `GET /notifications`, `POST /notifications/read`.

## Realtime (Socket.IO)

Connect with `io(url, { auth: { token } })`. Send `x-socket-id` on HTTP calls so your own device is not echoed.
`changes` (personal data), `settings`, `resync`, `notification`, `team:projects-changed`; after `team:join {projectId}`: `team:changes`, `chat:message`, `chat:updated`, `team:presence`, `chat:typing`.

## Email

Set `SMTP_HOST/PORT/USER/PASS` and `MAIL_FROM` to send real email. With `SMTP_HOST` empty (development) emails are written to `backend/outbox/*.html|txt` so you can open them in a browser. The API never fails because mail failed; the response says `email.sent`.
`APP_URL` is the web app address used for links in emails (`/join?invite=…`).

## Security notes

helmet, CORS allow-list, request size limit, zod validation on every input (unknown fields rejected), bcrypt (12 rounds), JWT, rate limits on auth and email search, every query scoped to the owner or a project member (non-members get 404), no secrets in source.
The Atlas password in your chat message is stored only in `backend/.env`. Because it was shared in plain text, rotate it in Atlas when you can.

## Sync endpoints

- `POST /api/sync/push` sends a device's queued changes (tasks, projects, day logs, settings, tombstones for deletions) and returns the server's changes since the last sync. Conflicts resolve by the later device edit time; repeating a push is safe.
- `GET /api/sync/summary` returns counts and task ids so a client can verify the server holds everything before clearing its local copy.
