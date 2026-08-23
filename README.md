# ebbyforms-server

Express REST API for **Ebbyforms**, a full-stack scaffold (Nuxt 4 + Express + Sequelize/MySQL).
**Clerk owns authentication** (email/password, OAuth, sessions, verification); the API exposes the app-side **user profile** for the signed-in user.

## Stack

- **Express 5** (`express`, `cors`)
- **Sequelize 6** + **mysql2** (MySQL)
- **Clerk** — `@clerk/express` (`clerkMiddleware`, `getAuth`) validates session tokens; identity lives in Clerk, not in this database

## What it does

- Registers `clerkMiddleware()` high in the pipeline so every request carries Clerk auth context.
- `GET /api/health` — public; returns `{ "status": "ok" }`.
- `GET /api/me` — protected; returns the app-side profile for the signed-in Clerk user.
  - Requires `Authorization: Bearer <session-token>` (the Clerk session JWT from the frontend).
  - On a user's **first** request, a profile row is created from the session claims (email, names, avatar). Clerk users are always marked `emailVerified`.
- Internal (staff) portal endpoints — `requireUser` + `requireRole('internal')` (platform role from the `users` table):
  - `GET /api/internal/stats` — user + organization counts.
  - `GET /api/internal/users?limit&offset` — every Clerk user, with the platform role from our schema.
  - `PATCH /api/internal/users/:id/role` — set a user's platform role (users table + Clerk metadata).
  - `GET /api/internal/organizations?limit&offset` — tenants.
  - `POST /api/internal/organizations` — create a tenant.
  - `GET /api/internal/organizations/:id/members` — members of a tenant.
  - `POST /api/internal/organizations/:id/members` — add a member by email (`admin` | `basic_member`).
  - `DELETE /api/internal/organizations/:id/members/:userId` — remove a member.
- Rejects unauthenticated requests with `401 { "error": "Unauthorized" }`; non-internal with `403 { "error": "Forbidden" }`.

> The `users` table is a **profile store**, not an identity store. It is keyed by Clerk's `user_id` (`clerk_id`) and mirrors the profile fields the app needs, so it's safe to add app-specific columns (plan, role, settings, …). Credentials, password resets, and verification are all handled by Clerk. Keeping profiles in sync with Clerk (deletes, name/email changes) is done with [Clerk webhooks](https://clerk.com/docs/webhooks) — not yet wired up.

## Prerequisites

- Node.js 20+
- A running MySQL server (this dev environment uses a local MySQL on port `3307`; the `acme-mysql` Docker container on `3306` also works)
- A populated `.env` file (see below)

## Setup

```bash
npm install
```

### Environment (`.env`)

| Variable | Description |
|---|---|
| `CLERK_SECRET_KEY` | Clerk secret key — validates session JWTs (from `clerk env pull`) |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key (pulled alongside the secret) |
| `MYSQL_HOST` | MySQL host (e.g. `localhost`) |
| `MYSQL_PORT` | MySQL port (default `3306`; a local instance may use `3307`) |
| `MYSQL_DATABASE` | Database name — `ebbyforms` in this dev setup |
| `MYSQL_USER` | MySQL user |
| `MYSQL_PASSWORD` | MySQL password |
| `PORT` | HTTP port (default `4000`) |

`.env` is git-ignored. Pull the Clerk keys for the dev instance:

```bash
clerk env pull --app app_3IKO9tXabG3QQsTDnvTUHtyUiO0 --file .env
```

Then add the `MYSQL_*` values. Two dev setups are in use: the `acme-mysql` Docker container (`root` / `rootpassword` on `3306`) or a local MySQL service (`root` / `root` on `3307` in the author's environment). Note that `sequelize.sync()` creates **tables**, not the database itself — create the `ebbyforms` schema once: `CREATE DATABASE IF NOT EXISTS ebbyforms;` (or the server will fail with `Unknown database`).

## Development

```bash
npm run dev      # node --watch index.js — auto-restarts on change
npm start        # plain node index.js
```

On startup the server connects to MySQL, runs `sequelize.sync()` (auto-creates missing tables) and listens on `http://localhost:4000`.

Or run both services from the repo root:

```bash
cd .. && npm run dev   # starts server (:4000) + client (:3000)
```

## Database

`users` table (created by `sequelize.sync()`):

| Column | Type | Notes |
|---|---|---|
| `id` | `INT` | PK, auto-increment |
| `clerk_id` | `VARCHAR(255)` | **UNIQUE, NOT NULL** — the join key with Clerk (`user_...`) |
| `email` | `VARCHAR(255)` | UNIQUE (nullable — mirrored from Clerk claims) |
| `email_verified` | `BOOLEAN` | Always true for Clerk users |
| `first_name` / `last_name` / `image_url` | `VARCHAR(255)` | Profile fields mirrored from Clerk |
| `created_at` / `updated_at` | `DATETIME` | Sequelize timestamps |

> Schema changes: `sequelize.sync()` auto-creates missing tables but won't alter existing ones — drop/rename columns with a manual migration in dev.

## Key files

| Path | Purpose |
|---|---|
| `index.js` | Express app: middleware pipeline, routes, DB connect + sync, listen |
| `db.js` | Sequelize connection (reads `MYSQL_*` env vars) |
| `models/User.js` | `User` profile model — keyed by `clerkId`, with platform `role` column |
| `middleware/auth.js` | `requireUser` — validates the Clerk session, creates the profile on first request; `requireRole(...roles)` / `requireInternal` — role gate for staff tiers |
| `routes/internal.js` | Staff portal endpoints: user list + role management, org CRUD + member management |
| `scripts/promote-staff.js` | `npm run promote-staff <clerk-user-id|email> [role]` — sets a user's platform role (users table + Clerk metadata) |
| `openapi.js` | OpenAPI 3.0 spec served by Swagger UI |
| `.env.example` | Template of expected environment variables |

## API reference

Interactive documentation is served by **Swagger UI**:

- `GET /api-docs` — browsable UI (try requests right from the browser)
- `GET /api-docs.json` — raw OpenAPI 3.0 spec (`openapi.js`)

### `GET /api/health`

Public. `200 { "status": "ok" }`

### `GET /api/me`

Protected. Requires `Authorization: Bearer <token>` — a Clerk session token (obtain it on the frontend with `useAuth().getToken()`).

- Missing/invalid token → `401 { "error": "Unauthorized" }`
- Valid token → `200 { "user": { id, clerkId, email, emailVerified, firstName, lastName, imageUrl, createdAt, updatedAt } }`

## Troubleshooting

- **401s from the client** — the frontend and backend must use keys from the **same** Clerk dev instance; re-run `clerk env pull` in both folders if they drift.
- **`Access denied for user`** — check `MYSQL_USER`/`MYSQL_PASSWORD` match the MySQL instance (Docker `acme-mysql` uses `root`/`rootpassword`; a local Windows MySQL often uses `root`/`root` on port `3307`).
- **`Unknown database 'ebbyforms'`** — create it once: `CREATE DATABASE IF NOT EXISTS ebbyforms;` (table creation is automatic).
- **CORS** — `app.use(cors())` currently allows all origins; restrict the origin list before deploying.
