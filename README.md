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
| Frontend | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript |
| Styling | Tailwind CSS 3, custom design system in `src/components/ui` |
| Backend | Google Firebase: Firestore, Firebase Auth, Cloud Storage for Firebase, security rules |
| Server data access | Firebase Admin SDK, server-side only, tenant-scoped (`src/lib/data/tenant.ts`) |
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
    media/[...path] authenticated route for private project photos
  lib/
    firebase/      admin (server-only) and client (Auth only) SDK setup
    data/          tenant boundary, Firestore helpers, business denormalisation
                   session, queries, validation, plans, constants, storage, rate-limit
  proxy.ts         route guard (Next 16 "proxy", formerly middleware)
firestore.rules, storage.rules, firestore.indexes.json, firebase.json
scripts/           seed (reference + DEMO data), make-admin
tests/             unit, security-rules and HTTP isolation tests
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
| `NEXT_PUBLIC_APP_ENV` | yes | `local`, `staging` or `production`. Staging/production refuse to start with emulator settings, a `demo-*` project, missing Firebase config or a non-https site URL (`src/lib/env.ts`). Each environment uses its own Firebase project (`.firebaserc` aliases). |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_APP_ID` | yes | Firebase web app config (safe in the browser; the browser SDK is used for sign-in only) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | prod | **Server only.** Service-account JSON (raw or base64) for the Admin SDK. Never prefix with `NEXT_PUBLIC_`. Not needed with emulators. |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST` | dev | Point both SDKs at the local emulators |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonical URLs, sitemap, invite links |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | no | Shown on contact/legal pages |
| `STRIPE_*` | no | Enables Stripe mode in `lib/billing.ts` once implemented |

## Local development

Requires Node 20+ and Java 11+ (for the Firestore emulator).

```bash
npm install
cp .env.example .env.local       # uncomment the emulator block; any demo-* project id works
npm run emulators                # Auth :9099, Firestore :8080, Storage :9199, UI :4000
npm run seed                     # reference data + DEMO data (emulators only)
npm run dev                      # http://localhost:3000
```

Demo accounts (password `demo-password-123`, all **demo data**):

| Email | Role |
|---|---|
| `owner@kingstonpro.demo` | Owner, Kingston Pro Builders |
| `crew@kingstonpro.demo` | Crew (field role), Kingston Pro Builders: sees only assigned jobs |
| `owner@islandelectrical.demo` | Owner, Island Electrical Services |
| `customer@buildflow.demo` | Customer |
| `admin@buildflow.demo` | Platform admin |

### Checks

```bash
npm run typecheck && npm run lint
npm test                 # unit tests (pricing, search parsing, permissions, env validation, file types)
npm run test:rules       # Firestore rules: every client read/write denied (starts its own emulator)
npm run test:integration # HTTP tenant isolation + crew restrictions (needs emulators + seed + app on :3000)
npm run test:e2e         # browser: roles, the full contractor→customer→job loop, axe + overflow audit
                         # (needs emulators + seed + app on :3000; set CHROMIUM_PATH if Playwright has no browser)
```

## Firebase setup (production)

1. Create a Firebase project. Enable **Authentication → Email/Password**, **Firestore** (production mode) and **Storage**.
2. Add a Web app; copy its config into the `NEXT_PUBLIC_FIREBASE_*` variables.
3. Project settings → Service accounts → generate a key; store the JSON (or base64 of it) as `FIREBASE_SERVICE_ACCOUNT_KEY` in your host's secret store.
4. Deploy rules and indexes: `npx firebase deploy --only firestore:rules,firestore:indexes,storage --project <id>`.
5. Load reference data (services, locations, plans): `npm run seed -- --reference` with production env vars. Demo data refuses to load outside the emulators.
6. Make yourself admin: `npm run make-admin -- you@example.com`.

### Authentication setup
- Authentication → Templates → set the **action URL** to `https://your-domain/auth/action` (handles email verification and password reset).
- Authentication → Settings → Authorized domains: add your production domain.
- Sign-in happens in the browser with the Firebase SDK; the ID token is exchanged for a 14-day **httpOnly session cookie** (`__session`) verified with revocation checks on every server request. Sign-out revokes refresh tokens.

### Storage setup
- `storage.rules` denies all direct client access. Uploads go through server actions that check type (JPEG/PNG/WEBP/HEIC) and size (10 MB).
- `public-media/{businessId|users/uid}/…`: logos, covers, post images, served by tokenised download URLs.
- `project-files/{businessId}/…`: private site photos, streamed only to members via `/media/...`.

## Deployment (Vercel)

1. Import the repo in Vercel (framework: Next.js).
2. Add the environment variables above (Production/Preview). Do **not** set the emulator variables.
3. Deploy, then add the Vercel domain to Firebase Auth's authorized domains.

## Subscription architecture

- Plans live in the `plans` collection (`base_price_cents`, `included_seats`, `additional_seat_price_cents`, Stripe price ids). Admins edit them at `/admin/plans`.
- Each business gets a `subscriptions/{businessId}` doc (14-day trial on Basic) at creation; `seats` follows team size automatically.
- Price math lives in **one** function: `seatPriceBreakdown()` in `src/lib/plans.ts` (Basic: 1 user $50, 2 → $70, 3 → $90, 4 → $110).
- Adding Pro/Business/Enterprise = new documents (+ optional `PLANS` entries for marketing defaults). No restructuring.
- Stripe: implement `createCheckoutSession` + a webhook route in `src/lib/billing.ts` that updates `subscriptions`.

## Security

- **Multi-tenancy:** all CRM/project data lives under `businesses/{businessId}/…`. Server code reaches it only through `tenant(businessId)`, and `businessId` always comes from the verified session (`requireBusiness`), never from request input. A document id sent by a browser can therefore only address a document inside the caller's own business. Membership is re-checked against `businesses/{id}/members/{uid}` on every request.
- **Firestore rules** are a second line of defence: clients can never write, can read only public profiles/posts/reference data and their own user docs, and only members can read a business's subcollections (`tests/rules`).
- Assignees and project members are validated against the member list; owners vs members: only owners delete records, edit the profile, manage team/billing.
- Side effects (counters, notifications, analytics, quote → lead) are written in the same atomic batch/transaction as the main write.
- Server-side Zod validation on every action; honeypot + per-IP rate limit + persistent per-contact limit on quote requests; rate limits on sign-in, comments, reports and view tracking.
- Users can't make themselves admin or verify their business: those fields are only written by admin actions or `scripts/make-admin`.
- Admin SDK credentials are server-only (`import "server-only"`). Security headers in `next.config.ts`.

## Roadmap
See [`docs/roadmap.md`](docs/roadmap.md).

## Known limitations

- **Search** is filter-based (service + parish) with in-memory name matching over at most 500 candidates. Add Algolia/Typesense when the directory grows.
- Lists load up to a few hundred records (no pagination yet).
- Stripe checkout/webhooks are not implemented (manual billing mode; trials don't auto-expire access).
- Invite and notification **emails** are not sent (Firebase sends verification/reset emails only).
- Rate limiting is per server instance (in-memory), except the persistent quote-request limit.
- One business per user account.
- Posts store a copy of the business name/logo; it is re-synced on profile changes (up to a few thousand posts per business).
- Pages under `/app` that are not found render the not-found page with HTTP 200 (streaming behind `loading.tsx`); no data is returned.
- Reviews, messaging, estimates/invoices, calendar and native apps are not built (marked "coming soon").
- Legal pages are drafts and **must be reviewed by counsel** before launch.

## Contributing

1. Branch from `main`; keep PRs focused.
2. New tenant data goes under `businesses/{id}/…` and is accessed via `tenant()`. Add indexes to `firestore.indexes.json`, update `docs/database-schema.md`, and extend `tests/rules` / `tests/integration`.
3. Actions return `{ ok, redirectTo? }` and clients use `useFormAction`/`useServerAction`; don't call `revalidatePath`/`redirect` for `/app` routes (see `src/components/ui/use-form-action.ts`).
4. Run typecheck, lint, unit, rules and integration tests before opening a PR.

## License

Proprietary. © BuildFlow. All rights reserved. (Choose a license before any public release.)
