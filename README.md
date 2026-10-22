# BuildFlow

**Run your construction business. Showcase your work. Win more jobs.**

BuildFlow is a mobile-first operating system for contractors and construction service professionals: a CRM, lead pipeline, customer and project management tool, *plus* a public profile and work feed where everyday customers discover contractors and request quotes.

> Status: **V1 prototype.** Core loop works end-to-end. See [Known limitations](#known-limitations).

---

## Product vision

The product is built around one loop:

```
Contractor posts work → customer discovers it → visits profile → requests a quote
   ↑                                                                  ↓
Completed project is posted ← project managed in BuildFlow ← lead captured & converted
```

Every feature exists to acquire, convert, manage, deliver for, or retain customers. Full requirements: [`docs/product-requirements.md`](docs/product-requirements.md).

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router, Server Components, Server Actions), React 19, TypeScript |
| Styling | Tailwind CSS 3, custom design system in `src/components/ui` |
| Backend | Supabase: Postgres, Auth, Storage, Row Level Security |
| Validation | Zod (server-side, every action) |
| Hosting | Vercel |
| Payments | Stripe-ready seam (`src/lib/billing.ts`); V1 runs in "manual" billing mode |

## Architecture

```
src/
  app/
    (site)/        public site: marketing, legal, explore, search, contractor profiles, posts, saved, account
    (auth)/        login, signup, password reset, email verification
    auth/callback  email-link handler
    onboarding/    7-step contractor setup
    app/           contractor workspace: dashboard, leads, customers, projects, posts, profile, team, billing, analytics, notifications
    admin/         platform admin
    actions/       all server actions (auth, onboarding, crm, projects, social, business, admin)
  components/
    ui/            design system (Button, Input, Select, Modal, Card, Avatar, Badge, StatusBadge, Tabs, DataTable, EmptyState, LoadingState, Toast, ConfirmationDialog…)
    cards/         PostCard, ContractorCard, LeadCard, ProjectCard, ProfileHeader
    nav/           TopNavigation, BottomNavigation, SideNavigation, footer
    crm/ forms/ social/
  lib/             supabase clients, session, queries, validation, plans, constants, storage, rate-limit
supabase/
  migrations/      schema + RLS + triggers + RPCs + storage policies
  seed.sql         DEMO data only
  tests/           SQL tests for the core loop & tenant isolation
```

Details: [`docs/architecture.md`](docs/architecture.md). Schema: [`docs/database-schema.md`](docs/database-schema.md).

## Features (V1)

- Email/password auth, logout, password reset, email verification
- Contractor onboarding (7 short steps, skippable)
- Public contractor profile `/contractor/[username]`, conversion-focused: Request a Quote (primary), Contact (secondary), sticky mobile CTA, JSON-LD, Open Graph
- Social feed: posts (6 types incl. before/after), images, likes, saves, comments, follows, share links
- Explore & search, including natural phrases like *"electricians in Kingston"*
- Quote requests create leads automatically (+ notification + analytics)
- CRM: 7-stage lead pipeline, sources, values, assignment, notes, convert lead → customer → project
- Customers: search, detail, notes, projects, lead history
- Projects: status, budget, timeline, team, tasks (priority/status/assignee/due), private site photos, notes, activity history, "Showcase this project"
- Dashboard, basic analytics, in-app notifications
- Team invites with basic owner/member permissions
- Subscription architecture (data-driven plans, seat pricing)
- Admin: metrics, users, businesses (verify/suspend), reports moderation, plan & category management
- Reporting of posts, comments and profiles
- Marketing site, privacy, terms, refund/cancellation pages

## Environment variables

Copy `.env.example` to `.env.local`.

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon/publishable key (safe in browser; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | no | **Server only.** Reserved for billing webhooks / tooling. Never prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | yes | Used for email links, canonical URLs, sitemap |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | no | Shown on contact/legal pages |
| `STRIPE_*` | no | Enables Stripe mode in `lib/billing.ts` once implemented |
| `RESEND_API_KEY`, `EMAIL_FROM` | no | For future email notifications |

## Local development

```bash
npm install
npx supabase start               # local Postgres/Auth/Storage (Docker)
npx supabase db reset            # applies migrations + seed.sql
cp .env.example .env.local       # paste the URL + anon key printed by `supabase start`
npm run dev                      # http://localhost:3000
```

Demo accounts (password `demo-password-123`, all **demo data**):

| Email | Role |
|---|---|
| `owner@kingstonpro.demo` | Owner, Kingston Pro Builders |
| `crew@kingstonpro.demo` | Team member, Kingston Pro Builders |
| `owner@islandelectrical.demo` | Owner, Island Electrical Services |
| `customer@buildflow.demo` | Customer |
| `admin@buildflow.demo` | Platform admin |

### Checks

```bash
npm run typecheck
npm run lint
npm test                                                         # unit tests (pricing, search parsing)
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/core_loop.sql # 30 DB checks: full loop + tenant isolation
```

## Supabase setup (hosted)

1. Create a project at supabase.com.
2. `npx supabase link --project-ref <ref>` then `npx supabase db push` (applies `supabase/migrations`). **Do not** run `seed.sql` in production.
3. Make yourself admin: `update profiles set is_platform_admin = true where id = '<your-user-id>';`

### Authentication setup
- Auth → URL configuration: Site URL = your domain; add `https://your-domain/auth/callback` to redirect URLs.
- Email confirmations: on for production. The callback route handles `code` and `token_hash` links, including password recovery.
- Customise email templates and SMTP sender before launch.

### Storage setup
The migration creates two buckets with policies:
- `public-media` (public read): logos, covers, post images. Writes only under `{business_id}/…` by members, or `users/{uid}/…`.
- `project-files` (private): site photos, served via short-lived signed URLs.
Both limit files to 10 MB and JPEG/PNG/WEBP/HEIC; the app validates the same on the server.

## Deployment (Vercel)

1. Import the repo in Vercel (framework: Next.js).
2. Set the environment variables above for Production/Preview.
3. Deploy. Update Supabase Auth redirect URLs with the Vercel domain.

## Subscription architecture

- Plans live in `subscription_plans` (`base_price_cents`, `included_seats`, `additional_seat_price_cents`, Stripe price IDs). Admins edit them at `/admin/plans`.
- Each business gets a `subscriptions` row (14-day trial on Basic) when created; `seats` tracks team size automatically.
- Price math lives in **one** function: `seatPriceBreakdown()` in `src/lib/plans.ts` (Basic: 1 user $50, 2 → $70, 3 → $90, 4 → $110).
- Adding Pro/Business/Enterprise = insert rows (+ optional entries in `PLANS` for marketing defaults). No code restructuring.
- Stripe: implement `createCheckoutSession` + a webhook route in `src/lib/billing.ts` that updates `subscriptions` using the service-role key.

## Security

- **Multi-tenancy:** every CRM/project row carries `business_id`; RLS allows access only to members (`is_business_member()`). Triggers reject cross-tenant references (e.g. a task pointing at another business's project) and non-member assignees.
- Public data (profiles, posts, comments) is readable without auth only when the business is public and not suspended.
- Anonymous writes go only through `submit_quote_request()` and `track_view()` RPCs (with DB-side throttling).
- Users can't self-promote to admin, self-verify, un-suspend, or change ownership/counters (protection triggers).
- Owners vs members: only owners delete records, edit the profile, manage team/billing.
- Server-side Zod validation on every action; file type/size checks; honeypot on quote form; rate limits on auth, quotes, comments and reports (`src/lib/rate-limit.ts`, in-memory — swap to Redis for multi-instance).
- Service-role key is server-only (`import "server-only"`). Security headers in `next.config.ts`.

## Roadmap
See [`docs/roadmap.md`](docs/roadmap.md).

## Known limitations

- Stripe checkout/webhooks are not implemented (manual billing mode; trials don't auto-expire access).
- Invite and notification **emails** are not sent; owners share invite links manually; notifications are in-app.
- Rate limiting is per server instance (in-memory).
- Profile display names are publicly readable (needed for comments).
- One owned business per user account.
- Lead/project lists load up to a few hundred rows (no pagination yet).
- Reviews, messaging, estimates/invoices, calendar and native apps are not built (marked "coming soon" where they appear).
- Legal pages are drafts and **must be reviewed by counsel** before launch.
- During development the full Supabase Docker stack could not be pulled in the CI sandbox; the app was verified against Postgres 16 + PostgREST 12 with an auth stub (see `docs/architecture.md#testing`). Run against real Supabase before release.

## Contributing

1. Branch from `main`; keep PRs focused.
2. Schema changes go in a **new** migration file; update `docs/database-schema.md` and add a check to `supabase/tests/core_loop.sql`.
3. Run typecheck, lint, unit tests and the SQL tests before opening a PR.
4. Reuse `src/components/ui` instead of one-off styling. Keep forms mobile-first (44px targets, minimal typing).

## License

Proprietary. © BuildFlow. All rights reserved. (Choose a license before any public release.)
