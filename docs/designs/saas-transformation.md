# SaaS Transformation — Design Doc

> Generated via CEO plan review on 2026-03-21
> Mode: SCOPE EXPANSION | Branch: dev

---

## Vision

### 10x Check
The 10x version doesn't just log reps — it understands your training. It tells you when you're plateauing, predicts readiness, lets coaches manage athletes, and creates viral sharing moments when you hit PRs.

Revenue model (Phase 3):
- **Free** — basic logging (what exists today)
- **Pro $9/mo** — analytics + AI insights + unlimited history
- **Coach $29/mo** — manage multiple athletes

### Platonic Ideal
A user logs 3 sets in 20 seconds after a workout. The app immediately tells them: *"Strongest push day in 6 weeks. Volume up 18% this month. Ready to add 5kg next session."* One tap shares a PR card to their gym WhatsApp. Their coach sees everything without a separate login. The free tier is genuinely useful. Pro is obviously worth $9.

---

## Scope Decisions

| # | Feature | Effort | Decision |
|---|---------|--------|----------|
| 1 | Multi-user auth (email + Google OAuth) | L | ✅ ACCEPTED |
| 2 | Stripe billing (Free / Pro / Coach) | M | 📋 DEFERRED — after auth stabilises |
| 3 | Workout templates | S | ✅ ACCEPTED |
| 4 | AI-generated insights (Claude API) | M | ✅ ACCEPTED |
| 5 | Shareable PR cards (@vercel/og) | S | ✅ ACCEPTED |
| 6 | Body weight tracking | S | ✅ ACCEPTED |
| 7 | Postgres migration (Neon/Supabase) | L | ✅ ACCEPTED |

---

## Priority Build Order

1. **Postgres** — foundation, everything else builds on this
2. **Multi-user auth** — Auth.js v5, unblocks all other features
3. **userId scoping on all API routes** — security critical, do immediately after auth
4. **Body weight tracking** — quick win, S effort
5. **Workout templates** — high retention impact, S effort
6. **AI insights** — key differentiator, M effort
7. **Shareable PR cards** — viral growth loop, S effort

---

## Target Architecture

```
                    ┌─────────────────────────────────────┐
                    │           Next.js 15 (Vercel)        │
                    │                                     │
  Browser ──────▶  │  /(auth)     /(main)    /api/       │
                    │  login       dashboard  workouts    │
                    │  register    workouts   exercises   │
                    │  oauth-cb    exercises  analytics   │
                    │              library    insights    │
                    │              templates  bodyweight  │
                    │              profile    og/pr-card  │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │          Auth.js v5                  │
                    │  Session cookies + JWT              │
                    │  Providers: Email, Google           │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │     Postgres (Neon/Supabase)         │
                    │                                     │
                    │  User  WorkoutSession  WorkoutSet   │
                    │  Exercise  Template    BodyWeight   │
                    │  Insight   PRRecord                 │
                    └──────────────────┬──────────────────┘
                                       │
                         ┌─────────────┴────────────┐
                         │                          │
              ┌──────────▼──────────┐   ┌──────────▼──────────┐
              │    Claude API        │   │  @vercel/og          │
              │  (insight gen)       │   │  (PR card images)    │
              └─────────────────────┘   └─────────────────────┘
```

---

## Schema Changes Required

### New models

```prisma
model User {
  id            String           @id @default(cuid())
  email         String           @unique
  name          String?
  image         String?
  createdAt     DateTime         @default(now())
  sessions      WorkoutSession[]
  exercises     Exercise[]
  bodyWeights   BodyWeight[]
  insights      Insight[]
  prRecords     PRRecord[]
  templates     WorkoutTemplate[]
}

model BodyWeight {
  id     String   @id @default(cuid())
  userId String
  date   DateTime
  weight Float                   // kg
  user   User     @relation(fields: [userId], references: [id])
  @@unique([userId, date])       // one entry per day, upsert-safe
}

model WorkoutTemplate {
  id        String         @id @default(cuid())
  userId    String
  name      String
  createdAt DateTime       @default(now())
  sets      TemplateSet[]
  user      User           @relation(fields: [userId], references: [id])
}

model TemplateSet {
  id          String          @id @default(cuid())
  templateId  String
  exerciseId  String
  setNumber   Int
  reps        Int
  weight      Float?
  template    WorkoutTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  exercise    Exercise        @relation(fields: [exerciseId], references: [id])
}

model Insight {
  id        String   @id @default(cuid())
  userId    String
  content   String   // AI-generated text
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}

model PRRecord {
  id         String   @id @default(cuid())
  userId     String
  exerciseId String
  weight     Float?
  reps       Int
  setAt      DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id])
}
```

### Modified models (add userId foreign key)

```prisma
// WorkoutSession — add userId
// Exercise — add userId (for custom exercises)
// Both need @relation to User and userId scoping on all queries
```

---

## Critical Security Requirements

Every API route must verify resource ownership. Shared helper:

```typescript
// src/lib/ownership.ts
export async function assertOwns(
  model: "workoutSession" | "exercise",
  id: string,
  userId: string
): Promise<void>  // throws 403 if not owner
```

**Data isolation:** Every Prisma query must include `where: { userId }`. Missing this = data leak between users. The ownership test (User A cannot read User B's session) is the single most important test to write before launch.

---

## AI Insight Flow

Insights are generated asynchronously — never block the session save response.

```
POST /api/workouts (session saved)
      │
      ├─ 201 returned immediately
      │
      └─ Background: GenerateInsight(userId)
              │
              ├─ Fetch last 30 days of sessions
              ├─ Build prompt (sanitise exercise names)
              ├─ Call Claude API
              │       ├─ Timeout → retry x2 → save null, log warning
              │       ├─ 429 → backoff → retry → save null
              │       └─ Success → save Insight record
              └─ Client polls /api/insights/latest on dashboard load
```

Prompt injection risk: user exercise names are included in the Claude prompt. Sanitise all user-controlled strings before interpolation.

---

## PR Card Flow

```
Session saved
      │
      ├─ PR Detection: SELECT MAX(weight) WHERE userId + exerciseId
      │       │
      │       ├─ New PR → create PRRecord, set flag
      │       └─ No PR → done
      │
      └─ If PR flagged:
              Dashboard shows "🎉 New PR — share it"
              Link: /api/og/pr-card?exerciseId=X&weight=Y&reps=Z
              OG image rendered by @vercel/og (public route, no auth)
```

---

## Postgres Migration Sequence

```
1. Provision Neon/Supabase Postgres
2. Update prisma.config.ts → DATABASE_URL (Postgres)
3. npx prisma migrate deploy (creates tables from migration history)
4. If migrating existing data: export Turso → import Postgres (one-time)
5. Remove ENVIRONMENT var, remove TURSO_* vars from Vercel
6. Remove scripts/migrate-turso.mjs (dead code)
7. Build command simplifies: prisma generate && prisma migrate deploy && next build
8. Deploy + verify
9. Monitor Neon connection pool dashboard
```

**Critical:** Use Neon's pooled connection string (`-pooler` suffix) on Vercel. Without it the app falls over at ~50 concurrent users (serverless = new connection per invocation).

**Rollback:** Keep Turso env vars commented out in Vercel for 48h. If Postgres fails, re-enable Turso URL → Vercel redeploys in ~60s.

---

## Error Handling Requirements

| Codepath | Failure | Required handling |
|----------|---------|-------------------|
| Login | Brute force | Rate limit: 5 attempts / 15 min per IP |
| OAuth callback | Provider down | Friendly error + fallback to email login |
| Claude API | Timeout | Retry x2 with backoff, save null insight, log warning |
| Claude API | 429 rate limit | Exponential backoff, retry, fallback |
| Claude API | Malformed response | Validate JSON, save null insight |
| Body weight save | Duplicate same day | Upsert by (userId, date) — not bare insert |
| PR card render | @vercel/og fails | Fallback to static placeholder image |
| Template use | Exercise deleted | Nullify templateSet.exerciseId gracefully |
| Postgres | Pool exhausted | Use pooled connection URL |

---

## Observability (minimum for launch)

- Structured logging via `pino` — auth events, API errors, Claude calls
- Sentry for error tracking (free tier covers it)
- Vercel Analytics for page-level metrics
- Alerts: error rate > 1% on `/api/workouts POST`, Claude failure rate > 10%
- Dashboard: signups/day, DAU/WAU, sessions logged/day

---

## NOT in Scope (this phase)

| Item | Rationale |
|------|-----------|
| Stripe billing | Deferred — build auth stability first |
| Coach portal | Phase 3 — needs billing tier defined |
| Mobile app | Phase 3 — needs stable API first |
| Public API / OAuth2 | Phase 3 |
| Progress photos | Not selected |
| Rest timer | Not selected |
| Social feed | Not selected |
| CSV export | Not selected |

---

## Phase 3 Preview

Once SaaS foundation ships:
- Stripe billing (Free / Pro $9 / Coach $29)
- Coach portal — assign programs, view athlete dashboards
- React Native mobile app (same API)
- Public API with developer keys

---

## What Already Exists (reuse these)

| Feature | Existing code | Action |
|---------|--------------|--------|
| Exercise CRUD | `/api/exercises/[id]` PUT/DELETE | Add userId scope |
| Workout logging | `LogWorkoutModal`, `/api/workouts` | Add userId scope |
| Analytics charts | `exercises/page.tsx` + `/api/analytics` | Extend for body weight |
| Auth middleware | `src/middleware.ts` | Rewrite with Auth.js |
| Migration tooling | `scripts/migrate-turso.mjs` | Delete after Postgres |
| Session management | `src/lib/session.ts` | Replace with Auth.js |
