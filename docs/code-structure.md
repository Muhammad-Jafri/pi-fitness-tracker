# Code Structure — Logic Map

> Quick reference for AI agents. Every meaningful file, what it owns, and where to look for each concern.

---

## API Routes (`src/app/api/`)

### `/api/workouts/route.ts`
- **GET** — fetch all sessions with their sets + exercise names, ordered by date desc
- **POST** — create a `WorkoutSession` + all its `WorkoutSet` records in one transaction. Body: `{ date?, notes?, sets: [{ exerciseId, reps, weight? }] }`

### `/api/workouts/[id]/route.ts`
- **GET** — single session with sets
- **PUT** — replace session (update notes/date + delete all old sets + recreate). Body same as POST sets array
- **DELETE** — delete session (sets cascade via DB relation)

### `/api/exercises/route.ts`
- **GET** — all exercises ordered by name. `export const dynamic = "force-dynamic"` is required here — without it Next.js 15 caches and returns stale data after creates
- **POST** — create custom exercise. Body: `{ name, category }`. Always sets `isCustom: true`. Returns 409 on duplicate name

### `/api/exercises/[id]/route.ts`
- **PUT** — edit name/category of a custom exercise. Returns 403 if built-in (`isCustom: false`). Returns 409 on duplicate name
- **DELETE** — delete custom exercise. Returns 403 if built-in. Cascades: first deletes all `WorkoutSet` records referencing this exercise, then deletes the exercise

### `/api/analytics/[exerciseId]/route.ts`
- **GET** — returns chart data for `?filter=day|week|month`
  - `day`: sets grouped by setNumber for today → `[{ label: "Set 1", reps, weight }, ...]`
  - `week`: total reps per weekday Mon–Sun current week → `[{ label: "Mon", reps }, ...]`
  - `month`: total reps per month Jan–Dec current year

### `/api/auth/login/route.ts`
- **POST** — compares `{ username, password }` against `AUTH_USERNAME`/`AUTH_PASSWORD` env vars. On success: calls `createSession()` which sets httpOnly cookie. Returns 401 on mismatch

### `/api/auth/logout/route.ts`
- **POST** — calls `deleteSession()` (clears cookie), redirects to `/login`

---

## Pages (`src/app/`)

### `(main)/page.tsx` — Dashboard
- Fetches `/api/workouts` on mount and on `"workout-saved"` window event
- Shows: recent sessions list, quick stats (total sessions, total sets, this week)
- No local state beyond the session list

### `(main)/workouts/page.tsx` — Workouts
- Master-detail layout. Left: session list. Right: session detail with sets
- Listens to `"workout-saved"` event for live refresh
- Opens `EditSessionModal` for editing
- Mobile: `showDetail` boolean toggles between list and detail panels

### `(main)/exercises/page.tsx` — Exercise Analytics
- Master-detail. Left: exercise list. Right: analytics charts (Recharts)
- Selected exercise + filter (`day|week|month`) persisted to `localStorage`
- Fetches `/api/analytics/[exerciseId]?filter=...` when selection changes

### `(main)/exercises/manage/page.tsx` — Library (Phase 2)
- Lists all exercises grouped by category (upper / lower / core)
- Built-ins: read-only, show "built-in" badge
- Custom: Pencil (edit) + Trash (delete) buttons
- Dialogs: `ExerciseDialog` (shared add/edit), delete confirmation
- **ESLint rule in effect:** Initial fetch is inlined in `useEffect` with `.then()` — NOT via a `refresh()` call

### `login/page.tsx`
- Simple email/password form, POSTs to `/api/auth/login`

### `(main)/layout.tsx`
- Wraps all authenticated pages with `Sidebar` + `LogWorkoutButton` in header

---

## Components (`src/components/`)

### `LogWorkoutModal.tsx`
- Triggered by `LogWorkoutButton`
- `useFieldArray` for dynamic set rows (exerciseId Select + reps + optional weight)
- On save: POST `/api/workouts`, then `window.dispatchEvent(new Event("workout-saved"))`
- Weight field: `z.union([z.coerce.number().positive(), z.literal("")]).optional()` — empty string maps to null

### `EditSessionModal.tsx`
- Same form pattern as `LogWorkoutModal` but pre-fills from existing session
- PUT `/api/workouts/[id]` with same body structure

### `layout/Sidebar.tsx`
- 4 nav items: Dashboard, Workouts, Exercises (analytics), Library (manage)
- Desktop: fixed vertical sidebar. Mobile: bottom tab bar
- Active state via `usePathname()`

### `layout/LogWorkoutButton.tsx`
- Button that opens `LogWorkoutModal`

### `layout/LogoutButton.tsx`
- POSTs to `/api/auth/logout`

### `ui/` — shadcn/ui primitives
- Button, Badge, Dialog, Select, etc. Never edit these directly

---

## Library (`src/lib/`)

### `db.ts` — Prisma Client Singleton
```
ENVIRONMENT=prod  →  PrismaLibSql(TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)
ENVIRONMENT=dev   →  PrismaBetterSqlite3(prisma/dev.db)
```
Singleton via global `globalThis.__prisma` to survive Next.js hot reloads.

### `session.ts` — JWT Auth
- `createSession(userId)` — signs JWT with `SESSION_SECRET`, sets httpOnly cookie (30d)
- `verifySession()` — reads + verifies cookie, returns payload or null
- `deleteSession()` — clears cookie

### `utils.ts`
- `cn(...classes)` — Tailwind class merging (clsx + tailwind-merge)

---

## Types (`src/types/index.ts`)

```typescript
interface Exercise {
  id: string; name: string; category: ExerciseCategory; isCustom: boolean; createdAt: string;
}
type ExerciseCategory = "upper" | "lower" | "core";

interface WorkoutSet {
  id: string; sessionId: string; exerciseId: string;
  setNumber: number; reps: number;
  weight?: number | null;   // kg — null for bodyweight
  exercise?: Exercise;
}

interface WorkoutSession {
  id: string; date: string; notes?: string | null; sets: WorkoutSet[];
}
```

---

## Middleware (`src/middleware.ts`)

- Runs on every request to `/(main)/*` and `/api/*` (except `/api/auth/login`)
- Calls `verifySession()`. If invalid:
  - API requests → 401 JSON
  - Page requests → redirect to `/login`

---

## Prisma (`prisma/`)

### `schema.prisma`
Source of truth for DB schema. Three models: `Exercise`, `WorkoutSession`, `WorkoutSet`. See CLAUDE.md for full schema.

### `prisma.config.ts` (repo root)
Used by Prisma CLI only. Points at `DATABASE_URL` (SQLite). Turso is never touched by the CLI — runtime adapter handles it.

### `migrations/`
One dir per migration, named `YYYYMMDDHHMMSS_<desc>/migration.sql`. Applied to SQLite by `prisma migrate dev`. Applied to Turso by `scripts/migrate-turso.mjs` at build time.

### `seed.ts` / `seed-turso.ts`
Inserts 12 built-in exercises (4 upper, 4 lower, 4 core). Run once per environment.

---

## Scripts (`scripts/`)

### `migrate-turso.mjs`
Runs at `npm run build` → applies pending `prisma/migrations/` to Turso. Tracks applied in `_migrations` table. Runs SQL statements individually; skips "already exists"/"duplicate column" errors. See CLAUDE.md for full details.

---

## Key Invariants

| Invariant | Where enforced |
|-----------|---------------|
| Built-in exercises cannot be edited or deleted | `/api/exercises/[id]` PUT/DELETE — returns 403 |
| Exercise names must be unique | DB unique constraint + 409 in POST/PUT |
| Sets cascade-delete with session | Prisma `onDelete: Cascade` on WorkoutSet.sessionId |
| When deleting an exercise, orphaned sets are removed first | DELETE handler manually deletes sets before exercise |
| `ENVIRONMENT` controls DB adapter, not presence of env vars | `src/lib/db.ts` |
| All GET-only routes with no path params need `force-dynamic` | Applied to `/api/exercises/route.ts` |
| Never call setState-containing functions inside useEffect body | ESLint `react-hooks/set-state-in-effect` — inline fetch instead |
