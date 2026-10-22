# Architecture

## Overview
A single Next.js 16 App Router application (deploy on Vercel) backed by Google Firebase: **Firebase Auth**, **Cloud Firestore** and **Cloud Storage for Firebase**. There is no separate API server and no Cloud Functions: pages are React Server Components and every write is a **Server Action** in `src/app/actions/*`, both using the Firebase **Admin SDK** on the server.

```
Browser ──► Next.js (Vercel)
 │           ├─ proxy.ts            cheap gate: no __session cookie → /login for /app /admin /onboarding /saved /account
 │           ├─ getSession()        verifySessionCookie(cookie, checkRevoked) → users/{uid} → businesses/{id}/members/{uid}
 │           ├─ Server Components   read via Admin SDK, tenant-scoped
 │           └─ Server Actions      Zod-validate → rate-limit → batched/transactional writes (+ side effects)
 │                                       │
 └─ Firebase Auth (browser SDK,          ▼
    sign-in only) ──ID token──► session cookie     Firestore · Storage · Auth (Admin SDK)
```

### Why server-only data access
- One place to enforce authorization (TypeScript, testable) instead of duplicating business rules in security rules.
- Side effects that were database triggers in a SQL design (counters, notifications, analytics, quote → lead) run in the same atomic batch/transaction as the main write, without Cloud Functions.
- Security rules still exist as defence in depth: no client writes at all, reads limited to public data, own user docs, and member-only tenant data (`firestore.rules`, tested in `tests/rules`).

## Key modules
| Path | Purpose |
|---|---|
| `src/lib/firebase/admin.ts` | Admin SDK (server-only). Uses `FIREBASE_SERVICE_ACCOUNT_KEY`, or the emulators when `*_EMULATOR_HOST` is set. |
| `src/lib/firebase/client.ts` | Browser SDK, used **only** for Firebase Auth. |
| `src/lib/session.ts` | Session cookie verification, `requireUser`, `requireBusiness`, `requireAdmin` |
| `src/lib/data/tenant.ts` | **Tenant boundary** (`tenant(businessId)`), plus helpers to queue events, activity and notifications on a batch |
| `src/lib/data/business.ts` | Denormalisation helpers (services/region on business; business snapshot + visibility on posts) |
| `src/lib/queries.ts` | Public reads: feed, search, profiles, viewer state |
| `src/lib/search.ts` | Pure free-text → {service, region, name} parser |
| `src/lib/storage.ts`, `src/app/media/[...path]` | Validated uploads; private photo streaming with a membership check |
| `src/components/ui/use-form-action.ts` | Client navigation/refresh after actions (see below) |
| `src/lib/plans.ts` / `plans.server.ts` | Pricing math + plan loading |
| `src/lib/billing.ts` | Stripe seam |
| `src/lib/legal.ts` | Configurable legal/policy values |

## Multi-tenancy
- Tenant = `businesses/{businessId}`. All private data are subcollections: `customers`, `leads`, `projects`, `tasks`, `photos`, `notes`, `activity`, `events`, `quote_requests`, `members`, `followers`.
- Server code only reaches them via `tenant(businessId)`, and `businessId` comes from `requireBusiness()` (the verified session plus a membership doc check). Ids from the browser are only ever used *inside* that path, so cross-tenant access is structurally impossible rather than filtered.
- Cross-entity references are validated inside the tenant (a project's customer, a task's project, assignees must be members).
- Tested in `tests/integration/isolation.test.ts` (another business gets the not-found page and none of the data; private photos are not served) and `tests/rules`.

## Data flows
- **Sign-in:** browser `signInWithEmailAndPassword` → `establishSession(idToken)` server action → `createSessionCookie` (14 days, httpOnly) → profile doc created on first sign-in.
- **Quote request:** public form → `submitQuoteRequest` (Zod, honeypot, IP rate limit, persistent per-contact limit) → one batch: quote request + lead + analytics events + owner notifications + activity + the customer's own history copy.
- **Counters** (likes, saves, comments, followers, posts, completed projects, task totals) are kept in step with their source documents in transactions.
- **Visibility:** each post carries `visible = post public && not hidden && business public && not suspended`; profile/admin changes re-sync it, so the feed is a single indexed query.
- **Refresh after writes:** actions return `{ ok, redirectTo? }`; `useFormAction` / `useServerAction` navigate or `router.refresh()`. We don't call `revalidatePath`/`redirect` for `/app` routes: in testing, revalidating the `/app` layout inside an action intermittently stranded the client router; client-driven refresh was reliable (and Next 16 fixed a separate stuck-navigation race we hit on 15.5).

## Mobile & native readiness
- Mobile-first layouts, bottom navigation, safe-area insets, PWA manifest.
- Firebase has first-class iOS/Android SDKs. A future Expo app can reuse the Firestore model and `plans.ts`, `search.ts`, `constants.ts`, `validation.ts`; its writes should go through the same server endpoints (security rules intentionally block client writes).

## Testing
- `npm test`: unit tests (pricing, search parsing).
- `npm run test:rules`: Firestore security rules against the emulator.
- `npm run test:integration`: HTTP tenant isolation against the running app + seeded emulators.
- The full 16-step definition-of-done loop (sign up → … → completed project showcased and discoverable) was run end-to-end in Chromium at 390px against the Firebase emulators.
