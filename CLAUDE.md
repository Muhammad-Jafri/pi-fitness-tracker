# Pi Fitness Tracker — Codebase Guide

## Stack
- **Frontend:** Next.js 15, React 19, Tailwind CSS 4, shadcn/ui
- **Backend:** Next.js API routes, Prisma 7 (adapter-based), SQLite (dev) / Turso libsql (prod)
- **Auth:** JWT via `jose`, httpOnly cookies, Next.js middleware
- **Forms:** react-hook-form + Zod
- **Charts:** Recharts
- **Icons:** lucide-react

> **IMPORTANT:** Always use `next@15`, NOT `next@16+`. Next.js 16 has a bug where `next dev` exits immediately in non-TTY environments (WSL).

## Phase Status

- **Phase 1 (shipped):** Basic workout logging, exercise analytics, single-user JWT auth, Turso prod DB
- **Phase 2 (shipped):** Custom exercise CRUD (add/edit/delete), weight-per-set tracking, Library page (`/exercises/manage`), ENVIRONMENT-based DB switching, automated Turso migration script
- **Phase 3 (planned):** Multi-user auth (Auth.js v5), Postgres (Neon), AI insights (Claude API), workout templates, body weight tracking, shareable PR cards — see `docs/designs/saas-transformation.md`

## Directory Structure

```
src/
  app/
    (main)/               # All authenticated pages (protected by middleware)
      layout.tsx          # Sidebar + header with LogWorkoutButton
      page.tsx            # Dashboard
      workouts/page.tsx   # Workouts master-detail
      exercises/page.tsx  # Exercise analytics master-detail
      exercises/manage/page.tsx  # Library — CRUD for custom exercises (Phase 2)
    api/
      workouts/route.ts           # GET all, POST create
      workouts/[id]/route.ts      # GET, PUT, DELETE
      exercises/route.ts          # GET all (force-dynamic), POST create custom
      exercises/[id]/route.ts     # PUT edit, DELETE (custom only; cascades sets)
      analytics/[exerciseId]/route.ts  # GET day/week/month analytics
      auth/login/route.ts         # POST login
      auth/logout/route.ts        # POST logout
    login/page.tsx
    layout.tsx            # Root layout
    globals.css
  components/
    LogWorkoutModal.tsx   # New workout form (react-hook-form + Zod, dispatches "workout-saved" event)
    EditSessionModal.tsx  # Edit existing session (same pattern, PUTs to /api/workouts/[id])
    layout/
      Sidebar.tsx         # Desktop fixed sidebar + mobile bottom nav (4 nav items)
      LogWorkoutButton.tsx
      LogoutButton.tsx
    ui/                   # shadcn/ui primitives
  lib/
    db.ts                 # Prisma singleton — switches on ENVIRONMENT=prod (Turso) vs dev (SQLite)
    session.ts            # createSession / deleteSession / verifySession
    utils.ts              # cn()
  types/index.ts          # Shared TS interfaces (Exercise, WorkoutSession, WorkoutSet w/ weight)
  middleware.ts           # JWT auth check, redirects to /login or returns 401
  generated/prisma/       # Auto-generated Prisma client (never edit)
prisma/
  schema.prisma           # Source of truth — WorkoutSet now has weight Float?
  migrations/             # Applied via scripts/migrate-turso.mjs at Vercel build time
  seed.ts                 # Seeds 12 built-in exercises (SQLite)
  seed-turso.ts           # Same seed for Turso
scripts/
  migrate-turso.mjs       # Runs at build time — applies pending prisma/migrations/ to Turso
docs/
  designs/
    saas-transformation.md  # Phase 3 SaaS vision + architecture (CEO plan)
  code-structure.md         # Detailed logic map for AI agents
```

## Data Models

```prisma
model Exercise {
  id        String       @id @default(cuid())
  name      String       @unique
  category  String       // "upper" | "lower" | "core"
  isCustom  Boolean      @default(false)
  createdAt DateTime     @default(now())
  sets      WorkoutSet[]
}

model WorkoutSession {
  id    String       @id @default(cuid())
  date  DateTime     @default(now())
  notes String?
  sets  WorkoutSet[]
}

model WorkoutSet {
  id         String         @id @default(cuid())
  sessionId  String
  exerciseId String
  setNumber  Int
  reps       Int
  weight     Float?                          // kg, optional (Phase 2)
  session    WorkoutSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  exercise   Exercise       @relation(fields: [exerciseId], references: [id])
}
```

- `isCustom: false` = built-in exercise, cannot be deleted
- `isCustom: true` = user-created, can be edited and deleted (enforced in PUT/DELETE /api/exercises/[id])
- Sets cascade-delete with their session
- `weight` is nullable — bodyweight exercises log null

## Prisma Config Gotcha

Prisma 7 does NOT accept `url` in `schema.prisma` datasource. DB URL lives in `prisma.config.ts` only. Adapter pattern is required — see `src/lib/db.ts`.

## DB Client (src/lib/db.ts)

- `ENVIRONMENT=prod` → uses PrismaLibSql with `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`
- `ENVIRONMENT=dev` (or unset) → uses PrismaBetterSqlite3 with `prisma/dev.db`
- Singleton pattern to avoid multiple instantiations in Next.js dev mode
- **Never** check for `TURSO_DATABASE_URL` presence to decide adapter — always use `ENVIRONMENT`

## API Routes Summary

| Route | Methods | Notes |
|---|---|---|
| `/api/workouts` | GET, POST | POST creates session + sets atomically |
| `/api/workouts/[id]` | GET, PUT, DELETE | PUT replaces all sets (delete + recreate) |
| `/api/exercises` | GET, POST | `force-dynamic`; POST sets isCustom: true |
| `/api/exercises/[id]` | PUT, DELETE | PUT edits name/category; DELETE returns 403 if built-in, cascades sets |
| `/api/analytics/[exerciseId]` | GET | `?filter=day\|week\|month` |
| `/api/auth/login` | POST | Validates against AUTH_USERNAME/AUTH_PASSWORD env vars |
| `/api/auth/logout` | POST | Deletes session cookie |

## Auth

- Single-user: credentials from `AUTH_USERNAME` + `AUTH_PASSWORD` env vars
- JWT signed with `SESSION_SECRET`, 30-day expiry, httpOnly cookie
- Middleware protects everything except `/login` and `/api/auth/login`
- API routes get 401, page routes get redirect to /login

## Environment Variables

```
ENVIRONMENT=dev           # "dev" = SQLite, "prod" = Turso (set to "prod" in Vercel)
DATABASE_URL=file:./prisma/dev.db  # SQLite path — used by Prisma CLI only
AUTH_USERNAME=
AUTH_PASSWORD=
SESSION_SECRET=           # long random string
TURSO_DATABASE_URL=       # production only (libsql://... URL)
TURSO_AUTH_TOKEN=         # production only
```

**Prisma CLI vs runtime:** `prisma.config.ts` uses `DATABASE_URL` (SQLite) for CLI commands (`prisma migrate dev`, `prisma studio`). Runtime adapter is chosen by `ENVIRONMENT` in `src/lib/db.ts` — Turso is never touched by the CLI.

## Key Patterns

**Live page refresh after workout save:**
`LogWorkoutModal` dispatches `new Event("workout-saved")` on the window after successful POST. Dashboard and Workouts pages listen to this event to re-fetch without a full page reload.

**Master-detail layout (Workouts + Exercises pages):**
- Desktop: fixed left panel (w-56) + scrollable right panel
- Mobile: full-screen list OR full-screen detail, toggled via `showDetail` state + back button
- Selected exercise/filter persisted to `localStorage` on exercises page

**Exercise analytics filters:**
- `day` → sets grouped by setNumber for today (label: "Set 1", "Set 2", …)
- `week` → total reps per weekday Mon–Sun, current week
- `month` → total reps per month Jan–Dec, current year

**Form pattern (modals):**
Both modals use react-hook-form with `useFieldArray` for dynamic sets. Each set row has `exerciseId` (Select) + `reps` (number input) + optional `weight` (number input, kg). Set number is derived from array index.

**`react-hooks/set-state-in-effect` rule:**
Never call a function that calls `setState` from inside `useEffect`. Inline fetch with `.then()` chaining directly in `useEffect` instead. This is an ESLint error that `tsc` won't catch — only `npm run build` catches it.

**`force-dynamic` on GET routes:**
Any API GET route that has no dynamic path params must export `export const dynamic = "force-dynamic"` or Next.js 15 will cache the response and return stale data. Applied to `/api/exercises/route.ts`.

## Dev Commands

```bash
npm run dev         # Start Next.js dev server
npm run build       # prisma generate + migrate-turso + next build (runs ESLint)
npx prisma studio   # DB GUI
npx ts-node prisma/seed.ts  # Seed local SQLite
```

## Pre-commit Rule — Always run `npm run build` before committing

`npx tsc --noEmit` does NOT catch ESLint errors. `next build` runs ESLint as part of compilation and will fail on lint errors that tsc misses (e.g. `react-hooks/set-state-in-effect`). Always run `npm run build` locally and confirm it passes before committing and pushing to avoid breaking production.

## Turso Migrations

`scripts/migrate-turso.mjs` runs automatically during `npm run build` (and therefore on every Vercel deploy):

1. Reads all dirs in `prisma/migrations/` in alphabetical (chronological) order
2. Checks a `_migrations` table in Turso to find which are already applied
3. For each pending migration, runs each SQL statement individually (not as a batch)
4. Skips statements that fail with "already exists" or "duplicate column" — continues rest
5. On full failure, exits 1 and aborts the build
6. Records applied migration name in `_migrations`

**Adding a new migration:** Run `npx prisma migrate dev --name <desc>` locally (SQLite). This creates a new dir in `prisma/migrations/`. Commit it. The next Vercel deploy applies it to Turso automatically.

**Never** run `npx prisma migrate deploy` in production — it doesn't understand the Turso adapter. Use the script.

## Deployment

- Branch `main` → Vercel production deploy (auto CI/CD)
- Vercel env: `ENVIRONMENT=prod`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_USERNAME`, `AUTH_PASSWORD`, `SESSION_SECRET`
- Build command: `prisma generate && node scripts/migrate-turso.mjs && next build`
- Vercel uses Turso as production DB; `DATABASE_URL` is not needed in Vercel
