# Architecture

## Overview
A single Next.js 15 App Router application deployed to Vercel, backed by Supabase (Postgres + Auth + Storage). There is no separate API server: pages are React Server Components that query Supabase as the signed-in user, and all writes are **Server Actions** in `src/app/actions/*`.

```
Browser ──► Next.js (Vercel)
             ├─ middleware.ts        refreshes the Supabase session cookie, guards /app /admin /onboarding /saved /account
             ├─ Server Components     read via @supabase/ssr client (user's JWT → RLS applies)
             └─ Server Actions       Zod-validate → rate-limit → write via same client (RLS applies)
                                        │
                                        ▼
                               Supabase Postgres (RLS + triggers + RPCs) / Storage / Auth
```

The service-role key is not used on any request path. Authorization is enforced **in the database** so a bug in a page cannot leak another tenant's data.

## Key modules
| Path | Purpose |
|---|---|
| `src/lib/supabase/{server,client,middleware,admin}.ts` | Supabase clients. `admin.ts` is server-only. |
| `src/lib/session.ts` | `getSession()` (cached per request), `requireUser`, `requireBusiness`, `requireAdmin` |
| `src/lib/queries.ts` | Shared reads: feed, search, profile, viewer state |
| `src/lib/search.ts` | Pure free-text → {service, region, name} parser |
| `src/lib/validation.ts` | Zod schemas + `parseForm` → `ActionState` |
| `src/lib/plans.ts` / `plans.server.ts` | Pricing math + plan loading |
| `src/lib/constants.ts` | Enum labels/tones (mirrors Postgres enums) |
| `src/lib/storage.ts` | Validated uploads, signed URLs |
| `src/lib/rate-limit.ts` | Fixed-window limiter (swap store for Redis later) |
| `src/lib/billing.ts` | Stripe seam |
| `src/lib/legal.ts` | Configurable legal/policy values |

## Multi-tenancy
- Tenant = `businesses` row. Membership = `business_members (business_id, user_id, role)`.
- Tenant tables: customers, leads, projects, project_members, tasks, project_photos, notes, activity_logs, analytics_events, quote_requests, subscriptions.
- RLS uses SECURITY DEFINER helpers `is_business_member(bid)`, `is_business_owner(bid)`, `is_platform_admin()`, `is_business_visible(bid)`.
- `enforce_same_business()` trigger rejects cross-tenant foreign keys and non-member assignees.
- Storage paths are prefixed with the business id and checked by storage policies.

## Data flows
- **Quote request:** form → `submitQuoteRequest` action (Zod, honeypot, IP rate limit) → `submit_quote_request()` RPC (atomic: quote_request + lead + analytics + owner notification + activity, DB throttle 5/hour/contact).
- **Counters** (likes, comments, saves, followers, posts, completed projects) are maintained by triggers so public pages never need to read private tables.
- **Views:** a client `ViewTracker` calls `track_view()` once per browser session (avoids counting prefetches; ignores the business's own members).

## Mobile & native readiness
- Mobile-first layouts, bottom navigation, safe-area insets, PWA manifest (`/manifest.webmanifest`).
- Business logic lives in Postgres (RLS, triggers, RPCs) and in framework-agnostic `lib/` modules, so a future React Native/Expo client can use the same Supabase backend and reuse `plans.ts`, `search.ts`, `constants.ts`, and `validation.ts`.

## Testing
- `npm test`: unit tests (pricing math, search parsing).
- `supabase/tests/core_loop.sql`: 30 assertions covering the full loop, tenant isolation, team permissions and privilege escalation (runs in a rolled-back transaction).
- V1 was additionally verified by a Playwright run of all 16 definition-of-done steps on a 390px viewport against Postgres 16 + PostgREST 12 with a minimal auth/storage stub (the Supabase Docker images were unavailable in the build sandbox). Re-run against a real Supabase stack before release.
