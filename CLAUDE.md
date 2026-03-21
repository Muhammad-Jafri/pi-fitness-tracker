# Pi Fitness Tracker — Codebase Guide

## Stack
- **Frontend:** Next.js 15, React 19, Tailwind CSS 4, shadcn/ui
- **Backend:** Next.js API routes, Prisma 7 (adapter-based), SQLite (dev) / Turso libsql (prod)
- **Auth:** JWT via `jose`, httpOnly cookies, Next.js middleware
- **Forms:** react-hook-form + Zod
- **Charts:** Recharts
- **Icons:** lucide-react

> **IMPORTANT:** Always use `next@15`, NOT `next@16+`. Next.js 16 has a bug where `next dev` exits immediately in non-TTY environments (WSL).

## Directory Structure

```
src/
  app/
    (main)/               # All authenticated pages (protected by middleware)
      layout.tsx          # Sidebar + header with LogWorkoutButton
      page.tsx            # Dashboard
      workouts/page.tsx   # Workouts master-detail
      exercises/page.tsx  # Exercise analytics master-detail
    api/
      workouts/route.ts           # GET all, POST create
      workouts/[id]/route.ts      # GET, PUT, DELETE
      exercises/route.ts          # GET all, POST create custom
      exercises/[id]/route.ts     # DELETE (custom only)
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
      Sidebar.tsx         # Desktop fixed sidebar + mobile bottom nav
      LogWorkoutButton.tsx
      LogoutButton.tsx
    ui/                   # shadcn/ui primitives
  lib/
    db.ts                 # Prisma singleton (BetterSqlite3 locally, PrismaLibSql in prod)
    session.ts            # createSession / deleteSession / verifySession
    utils.ts              # cn()
  types/index.ts          # Shared TS interfaces
  middleware.ts           # JWT auth check, redirects to /login or returns 401
  generated/prisma/       # Auto-generated Prisma client (never edit)
prisma/
  schema.prisma
  seed.ts                 # Seeds 12 built-in exercises (SQLite)
  seed-turso.ts           # Same seed for Turso
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
  session    WorkoutSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  exercise   Exercise       @relation(fields: [exerciseId], references: [id])
}
```

- `isCustom: false` = built-in exercise, cannot be deleted
- `isCustom: true` = user-created, can be deleted (enforced in DELETE /api/exercises/[id])
- Sets cascade-delete with their session

## Prisma Config Gotcha

Prisma 7 does NOT accept `url` in `schema.prisma` datasource. DB URL lives in `prisma.config.ts` only. Adapter pattern is required — see `src/lib/db.ts`.

## DB Client (src/lib/db.ts)

- If `TURSO_DATABASE_URL` env var is set → uses PrismaLibSql (production)
- Otherwise → uses PrismaBetterSqlite3 with `prisma/dev.db` (local dev)
- Singleton pattern to avoid multiple instantiations in Next.js dev mode

## API Routes Summary

| Route | Methods | Notes |
|---|---|---|
| `/api/workouts` | GET, POST | POST creates session + sets atomically |
| `/api/workouts/[id]` | GET, PUT, DELETE | PUT replaces all sets (delete + recreate) |
| `/api/exercises` | GET, POST | POST sets isCustom: true |
| `/api/exercises/[id]` | DELETE | Returns 403 if isCustom: false |
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
AUTH_USERNAME=
AUTH_PASSWORD=
SESSION_SECRET=           # long random string
TURSO_DATABASE_URL=       # production only
TURSO_AUTH_TOKEN=         # production only
```

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
Both modals use react-hook-form with `useFieldArray` for dynamic sets. Each set row has `exerciseId` (Select) + `reps` (number input). Set number is derived from array index.

## Dev Commands

```bash
npm run dev         # Start Next.js dev server
npm run build       # prisma generate && next build
npx prisma studio   # DB GUI
npx ts-node prisma/seed.ts  # Seed local SQLite
```

## Deployment

- Branch `dev` → local testing
- Merge to `main` → Vercel production deploy (auto CI/CD)
- Vercel uses Turso as production DB
- `npm run build` runs `prisma generate` before `next build`
