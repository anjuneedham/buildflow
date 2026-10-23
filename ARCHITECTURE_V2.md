# BuildFlow V2 Production Architecture

**Inputs:** the V1 repository (commit on `claude/buildflow-v1`), `V2_AUDIT.md`, `PRODUCT_STRATEGY_V2.md`.
**Companion:** `FIRESTORE_SCHEMA_V2.md` holds the collection-by-collection schema, indexes, rules and read/write patterns. This document holds the system design and the decisions behind it.
**Status:** design only. Nothing is implemented. Section 14 lists the consistency checks that must pass before implementation starts.

### Ground rules
1. **Evolve V1, do not rewrite it.** V1's core choices are sound and stay: Next.js App Router, server-only Firestore via the Admin SDK, an httpOnly session cookie, and the `businesses/{id}/…` tenant boundary. V2 changes what is broken or does not scale, and adds what the strategy needs.
2. **The server is the only authorization layer.** Browsers and the Android shell never read or write Firestore or Storage directly. Rules deny everything to clients, as defence in depth.
3. **Every read is paginated and bounded.** No query without `limit`; no in-memory filtering of unbounded sets; no "load 500 and filter".
4. **Duplicate data only with a named owner.** Each denormalised field lists the one code path that keeps it correct (schema doc §4).
5. **Design for the closed test, with clear upgrade triggers** for the points where thousands of contractors would need a different component (§13).

### Facts vs decisions vs items to verify
- **Fact:** V1 has never run against a production Firebase project; all data so far is emulator or demo data. **So V2 schema changes need code changes and a new seed, not a data migration.**
- **Decision:** a recommendation made here, with reasons.
- **[verify]:** depends on a vendor feature, price or policy that changes. Check it before building on it. These are collected in §15.

---

## 1. System overview

```
                ┌──────────────────────────── Clients ────────────────────────────┐
                │  Web (mobile browser)   Android (Capacitor shell → same web app) │
                │  Service worker + IndexedDB outbox (offline capture)             │
                └───────────────┬──────────────────────────────┬───────────────────┘
                                │ HTTPS (session cookie)        │ PUT to signed URL
                                ▼                               ▼
     ┌──────────────── Next.js app (one deployable) ─────────┐  ┌──── Cloud Storage ────┐
     │ Public pages: static / ISR, CDN cached                │  │ uploads-incoming (priv)│
     │ App pages: dynamic, server components                 │  │ media-private          │
     │ Server actions (UI mutations)                         │  │ media-public (CDN)     │
     │ Route handlers: /api/v1/* (sync, feed, uploads),      │  │ exports (priv, 7d TTL) │
     │   /api/webhooks/*, /c/[token] client link             │  └──────────┬────────────┘
     │ server/: auth · policy · repositories · services      │             │ finalize event
     └───────────┬───────────────────────────────────────────┘             ▼
                 │ Admin SDK                               ┌──── Cloud Functions (2nd gen) ────┐
                 ▼                                         │ media pipeline (sharp)            │
     ┌──────────── Firestore ────────────┐  ◄──────────────│ notification delivery (FCM/email) │
     │ deny-all rules for clients        │   triggers      │ profile → posts fan-out           │
     │ tenant data under businesses/{id} │                 │ scheduled: reminders, trials,     │
     │ public data: posts, reviews, ...  │                 │   quote expiry, purges            │
     └───────────────────────────────────┘                 │ billing webhooks / Play RTDN      │
                                                           └───────────────────────────────────┘
     Firebase Auth (+ custom claims) · App Check · FCM · Sentry · product analytics · email provider
```

**One Next.js app, one Firebase project per environment, one Functions codebase.** No microservices; the scale target (thousands of contractors) does not need them.

---

## 2. Frontend architecture

### 2.1 Route groups and rendering

| Group | Routes | Rendering | Auth | Why |
|---|---|---|---|---|
| `(public)` | `/`, `/pricing`, `/about`, legal pages, `/for-*` | **Static** | None read on server | Fixes audit C.1.2: today every page is dynamic because the site layout reads cookies |
| `(public)` | `/contractor/[slug]`, `/post/[id]` | **ISR**, revalidated by tag on change | None | Fast, CDN-cached, SEO |
| `(public)` | `/explore`, `/explore/[service]`, `/explore/[service]/[area]` | ISR for page 1 (60 s); further pages from `/api/v1/feed` with `s-maxage` | None | Path-based filters are cacheable and become SEO landing pages ("electricians in Kingston") |
| `(public)` | `/search` | Dynamic, short CDN cache keyed by query | None | Query-dependent |
| `(auth)` | `/login`, `/signup`, `/forgot-password`, `/verify-email` | Static shell + client Auth SDK | Firebase Auth (browser) | Only place the Auth SDK loads |
| `client` | `/c/[token]` | Dynamic, `no-store`, `noindex` | Capability token | Customer client link (no account) |
| `(app)` | `/app/**` | Dynamic server components | Session cookie | Contractor workspace |
| `admin` | `/admin/**` | Dynamic | Session + platform admin claim + MFA | Moderation |
| `api` | `/api/v1/*`, `/api/webhooks/*`, `/api/session` | Route handlers | Varies | Stable endpoints (see 2.4) |

**Header login state on public pages** comes from a small client component. It reads a non-sensitive, non-httpOnly hint cookie `bf_auth=1` (set with the session, cleared on logout) to choose between "Log in" and "Dashboard". It never reads the session on the server, so the page can stay static. The hint cookie grants nothing; it only picks a button.

### 2.2 Code organisation (incremental moves, not a rewrite)

```
src/
  app/                    routes only: pages, layouts, route handlers, thin server actions
  features/<domain>/      UI components + client hooks per domain
                          (leads, customers, quotes, projects, tasks, updates, media,
                           portfolio, reviews, profile, explore, team, billing, onboarding)
  server/
    auth/                 session.ts, claims.ts, app-check.ts
    policy/               can(actor, action, resource): the single authorization module
    repos/                one repository per collection; zod-parse on read; Timestamp↔ISO
    services/             multi-collection operations (acceptQuote, publishToPortfolio, ...)
    infra/                firebase admin, storage, email, push, rate-limit, logger, sentry
  shared/                 types, zod schemas, constants, money, dates (no server imports)
functions/                Cloud Functions codebase (imports src/shared and src/server/repos)
```

- Existing `src/lib/*` and `src/app/actions/*` move into this shape **as each feature is touched**. No big-bang move.
- Server actions stay thin: parse input → `requireActor()` → `policy.can()` → call a service → return `{ ok, data | error }`.
- A shared `action()` wrapper (fixes audit F.5) does input parsing, auth, App Check where needed, error mapping to user-safe messages, Sentry capture and structured logging. Every one of V1's 49 actions is moved onto it.

### 2.3 State, data fetching and mutations
- **Server components fetch;** client components receive props. No client data library is needed for most screens.
- **Infinite lists** (leads, feed, timeline, notifications) use a small client hook that calls a route handler with an opaque cursor (schema doc §6).
- **Mutations** use server actions with `revalidatePath`/`revalidateTag` plus `router.refresh()`. V1 avoided `revalidatePath` and `redirect` because of a router stall on Next 15.5 (audit F.4). **[verify]** that the stall is gone on Next 16.4.x with an E2E test before removing the workaround; keep `useFormAction` until then.
- **Optimistic UI** only for cheap, reversible actions (task done, follow-up snoozed).
- **Idempotent creates:** the client generates the id (ULID) for quotes, leads, updates and payments. The server creates with that id and treats "already exists with the same author" as success, so double taps and retries do not duplicate.

### 2.4 Why some endpoints are route handlers, not server actions
Server action ids are tied to a build. Work captured offline and replayed after a deploy, or a Capacitor shell running against a newer server, would call an action id that no longer exists. Anything that can be **replayed later** or **called by a non-React client** uses a versioned route handler:
- `POST /api/v1/sync`: offline outbox replay (updates, task status, payment records).
- `POST /api/v1/uploads`: request upload slots.
- `GET /api/v1/feed`, `GET /api/v1/lists/:kind`: paginated reads.
- `POST /api/webhooks/billing`, Play RTDN via Pub/Sub → Function.

Same auth, same policy module, same services as the actions.

### 2.5 Offline (strategy feature #18)
- **Scope (deliberately small):** create site updates (note + photos), change task status, record a payment, and read recently opened projects. **Not in V2:** offline quotes, offline lead editing, conflict resolution UI.
- **Service worker** (Workbox-based, e.g. Serwist) caches the app shell, static assets and the last N viewed project pages (read-only, marked "offline copy").
- **Outbox** in IndexedDB: each item has `{id (ULID), kind, payload, blobs[], created_at_client, attempts}`.
- **Replay:** on `online` events and app resume, for each item: request upload slots → PUT blobs → `POST /api/v1/sync`. The server applies with create-if-absent semantics using the client id.
- **Conflicts:** site updates and payments are append-only, so they cannot conflict. Task status is last-write-wins on `client_updated_at`, and the activity log records both changes.
- **[verify]** Background Sync API support inside the Android WebView used by Capacitor; do not rely on it. Replay on app resume and on `online` is the baseline.

### 2.6 Android (strategy feature #19)
- Capacitor shell loading the hosted origin (`server.url`), with plugins for push (FCM), camera, share and app links. One codebase.
- **Deploy skew:** the shell always loads the current server, so skew is limited to the offline outbox (handled by the versioned API in 2.4) and to cached service-worker assets (versioned and purged on activate).
- `assetlinks.json`, PNG and maskable icons, manifest `id`/`scope`, and a `start_url` that sends logged-out users to login (audit H.2).

### 2.7 Images on the client
- Resize before upload to a long edge of 2048 px, JPEG quality ~0.8, in a Web Worker (canvas / `createImageBitmap`). This cuts mobile data use, which matters on weak signal.
- HEIC: try in-browser decode; if the browser cannot decode it, upload as-is and let the server pipeline decide (§6.3).
- Display: our own pre-generated variants with `srcset` (320/640/1280 WebP plus JPEG fallback) through a custom `next/image` loader. **No runtime image optimizer**, so we pay for the image work once per upload, not per view.

### 2.8 Accessibility and design tokens
Brand orange as a background for white text fails contrast (3.04:1, audit E.1). The token set gets an `action` colour that passes 4.5:1 for text-on-colour, with the existing orange kept for large display and decoration. This is a token change, not a redesign.

---

## 3. Backend architecture

### 3.1 Layers inside the Next.js app

| Layer | Responsibility | Rules |
|---|---|---|
| Route/action | Parse input (zod), get actor, call policy, call service, map errors | No Firestore calls here |
| `policy` | `can(actor, action, resource)` → allow/deny | Pure functions, fully unit-tested (permission matrix in §5.3) |
| `services` | Multi-step business operations in transactions/batches | One service per user-visible operation; owns its side effects |
| `repos` | Collection access, zod parse on read, cursor pagination, Timestamp↔ISO | Only place that knows paths. Tenant repos require a `businessId` from the actor |
| `infra` | Admin SDK, Storage signing, email, push, logger, rate limiting | Swappable providers |

### 3.2 Cloud Functions (2nd gen), same region as Firestore

| Function | Trigger | Job | Idempotency |
|---|---|---|---|
| `mediaProcess` | Storage finalize on `uploads-incoming` | Verify magic bytes, strip EXIF/GPS, auto-rotate, make variants, write to `media-private`, set media doc `ready`/`failed`, delete incoming | Media doc status check; deterministic output paths |
| `notifyDeliver` | Firestore create `users/{uid}/notifications/{id}` | Push (FCM) + email per preferences | `delivered_at` set in a transaction before sending |
| `businessFanout` | Firestore update `businesses/{id}` (public profile fields changed) | Update the business snapshot on that business's posts; revalidate profile cache tag | Writes are set-to-value, so naturally idempotent |
| `listingSync` | Firestore update `businesses/{id}` (`is_listed` changed) | Set `business_listed` and `visible` on the business's posts; revalidate profile and Explore cache tags | Same |
| `remindersTick` | Schedule, every 30 min | Lead follow-ups due, tasks due today (morning digest), quote expiry | `reminded_at` fields |
| `billingTick` | Schedule, daily | Trial ending reminders, expire trials to read-only, dunning | Status machine transitions only move forward |
| `purgeTick` | Schedule, daily | Hard-delete businesses/users after the grace period, orphaned media, expired exports | Re-runnable |
| `exportBuild` | Firestore create `businesses/{id}/exports/{jobId}` | Build CSV + media ZIP, write to `exports` bucket, email signed link | Job status |
| `billingEvents` | HTTPS webhook / Pub/Sub (Play RTDN) | Update `subscriptions/{businessId}` | Provider event id stored |

All functions use the same repos and `shared` schemas as the app, so there is one definition of each document.

### 3.3 Side effects: transactions vs triggers
- **In the same transaction/batch as the user's action:** anything the user must see immediately or that must never drift: counters (quote number, project money totals, review aggregate), the activity entry, the in-app notification doc, stats increments.
- **Triggered asynchronously:** anything slow, external or retryable: push, email, image processing, fan-out to posts, exports.
- Rule: triggers never compute something the action could have written correctly itself. They deliver or derive.

### 3.4 Errors, retries and rate limits
- `action()` and route wrappers map known errors (validation, forbidden, not found, conflict, rate limited, plan limit) to typed results; unknown errors become "Something went wrong" with a Sentry event id.
- Firestore contention (`ABORTED`) is retried by the Admin SDK transaction runner; services keep transactions to ≤ 5 documents.
- **Rate limiting (replaces V1's in-memory limiter, audit D1):** fixed-window counters in Firestore `rate_limits/{hash}` with a TTL, used only on low-volume, abuse-prone endpoints: quote request, client-link message/accept/review, signup, invite. Keyed by IP hash + target and by contact. App Check (or Turnstile) runs *before* the limiter so bots are rejected without a write. **Upgrade trigger:** if limiter writes exceed ~5% of total writes, move to a managed Redis.

---

## 4. Firebase architecture

| Product | Use | Notes |
|---|---|---|
| **Auth** | Email/password + Google sign-in; email verification; password reset | Phone/SMS sign-in is attractive for the market but has per-SMS cost. **P1, [verify] pricing.** Enable email enumeration protection. |
| **Custom claims** | `bid` (business id), `brole` (owner/admin/field), `adm` (platform admin), `sv` (session version) | Removes 3 Firestore reads per request (§5.1) |
| **Firestore (Native)** | All application data | One database per environment. **Location is permanent once chosen:** pick the region closest to users and the app server before creating prod. Candidates: `us-east1` or `nam5`. **[verify] latency from Jamaica and the hosting region.** |
| **Cloud Storage** | 4 buckets per env (§6) | Uniform bucket-level access; lifecycle rules |
| **Cloud Functions 2nd gen** | §3.2 | Same region as Firestore |
| **App Check** | reCAPTCHA Enterprise on web, Play Integrity on Android; verified server-side for anonymous endpoints | **[verify]** free-tier quota and pricing; Cloudflare Turnstile is the fallback |
| **FCM** | Push to Android shell and web push | Tokens per device (schema §3.1) |
| **Hosting the Next.js app** | **Decision needed.** Default recommendation: **Firebase App Hosting** (Cloud Run-backed, same project and region as Firestore, no request-body issue because uploads go direct to Storage). Alternative: **Vercel** in the region nearest Firestore. | **[verify]** App Hosting support for Next 16.4 features in use (proxy.ts, server actions, ISR tags). The app stays host-agnostic: no platform-specific APIs in `src/` |

**Why uploads no longer pass through the app server:** files go straight from the device to Storage with a short-lived signed URL (§6.2). That removes the 50 MB Server Action body setting, the host body-size limit question (audit D4) and the memory spikes of buffering files on the server (audit D5).

---

## 5. Authentication, authorization, roles and ownership

### 5.1 Authentication and session

```
Browser (Auth SDK)            Next.js server                         Firebase Auth
 sign in ──── ID token ─────▶ establishSession (App Check checked)
                               verifyIdToken; require email_verified
                               for contractor actions (see below)
                               ensure claims {bid, brole, adm, sv} ─▶ setCustomUserClaims (if changed)
                               ◀── client refreshes ID token if claims changed
                               createSessionCookie (14 days)
 ◀── Set-Cookie: __Host-session (HttpOnly, Secure, SameSite=Lax, Path=/), bf_auth=1
```

Per request:
1. `proxy.ts` (unchanged role): presence check on `__Host-session` for `/app`, `/admin`, `/onboarding`, `/account`; redirect to `/login` otherwise.
2. `getActor()`: `verifySessionCookie(cookie)` gives `{uid, email_verified, bid, brole, adm, sv}` with **zero Firestore reads.**
3. **Revocation check** (`checkRevoked`, an Auth API call) runs on **every mutation and every admin request**. For page reads it runs at most once per 5 minutes per uid per server instance. Revocation therefore takes effect immediately for anything that changes data, and within 5 minutes for reads.

**When claims change** (invite accepted, role changed, member removed, business deleted, platform suspension):
- The server writes the members doc (source of truth), sets claims, **revokes refresh tokens**, and bumps `sv`.
- The affected user signs in again on their next request. For the invite-acceptance case the user is already in a sign-in flow, so it is seamless.
- Suspension also disables the Auth user.

**Email verification is enforced** (audit D6) on: publishing to portfolio, **emails sent by BuildFlow** to customers (quotes, updates, review requests), accepting invites, and being listed in search. Unverified contractors can set up, draft, and **share a quote link through their own WhatsApp**, so the activation moment (first quote sent) is never blocked (`UX_ARCHITECTURE_V2.md` §3.6). Sharing via the contractor's own phone carries their identity, which is why it is exempt.

**Platform admins:** must have MFA enrolled (Identity Platform). **[verify]** that this needs the Identity Platform upgrade and its pricing.

### 5.2 Roles

| Role | Who | Scope |
|---|---|---|
| `owner` | The business creator; exactly one per business | Everything, including billing, team, export, delete business, transfer ownership |
| `admin` | Office staff / partner | Everything except billing, delete business and ownership transfer |
| `field` | Crew | **Only projects where they are in `member_ids`**, and tasks assigned to them or within those projects; no CRM, quotes, invoices or business settings |
| **Customer (capability)** | Holder of a client-link token | Only the quote/project the link was issued for; can accept, message, review |
| **Public** | Anyone | Listed profiles, visible posts, published reviews, submit quote request |
| `platform admin` | BuildFlow staff | Moderation queue, suspend users/businesses, reports. **No routine access to tenant CRM data**; break-glass access is logged to `admin_audit` |

V1 roles map as follows: `owner` stays `owner`. V1 `member` (which sees everything) becomes `admin` for existing demo data; new invites choose `admin` or `field`. This implements the spec's assigned-only visibility (audit C.2.7).

### 5.3 Permission matrix (implemented in `server/policy`, unit-tested exhaustively)

| Action | owner | admin | field | client link | public |
|---|---|---|---|---|---|
| View/edit business profile, publish/hide posts | ✓ | ✓ | – | – | view listed |
| Leads, customers, timeline | ✓ | ✓ | – | – | – |
| Quotes: create, send, revise | ✓ | ✓ | – | view + accept/decline (own) | – |
| Invoices, payments | ✓ | ✓ | record payment on assigned project | view (own) | – |
| Projects: create, edit, assign members | ✓ | ✓ | view assigned | view (own, client-safe fields) | – |
| Tasks | ✓ all | ✓ all | create/update in assigned projects | – | – |
| Site updates | ✓ | ✓ | create in assigned projects | view shared ones | – |
| Project media | ✓ | ✓ | upload/view in assigned projects | view shared ones | – |
| Messages on client link | ✓ | ✓ | – | send/view (own) | – |
| Reviews: reply, report | ✓ | ✓ | – | create one per project | view published |
| Team: invite/remove/role | ✓ | ✓ (cannot change owner) | – | – | – |
| Billing, export, delete business, transfer ownership | ✓ | – | – | – | – |
| Quote request | – | – | – | – | ✓ (App Check + rate limit) |

**Resource checks go beyond role checks.** A field user's request for `projects/{id}` loads the project and checks `member_ids` contains the uid; a task update checks the task's project. The policy module receives the loaded resource, so a forbidden id returns "not found" (no existence leak).

### 5.4 Business ownership
- `businesses/{id}.owner_id` and `members/{owner_uid}.role == "owner"` must agree; the `transferOwnership` service changes both in one transaction.
- **One business per user in V2** (strategy: multi-business is out). Enforced by the `bid` claim and checked when creating a business or accepting an invite.
- **Deleting a business:** soft delete (`status: "deleted"`, delisted, members' claims removed, sessions revoked), then `purgeTick` hard-deletes after 30 days: recursive delete of `businesses/{id}`, all storage prefixes, the slug and posts.
- **Deleting a user account** (Play requirement): an owner with other members must transfer ownership or delete the business first. Otherwise: remove membership, delete `users/{uid}` and the Auth user. Activity entries keep a snapshot `actor_name`, replaced with "Former member".
- **Seats:** every member (owner, admin, field) counts as a seat against the subscription (§10).

---

## 6. Media storage

### 6.1 Buckets (per environment)

| Bucket | Access | Content | Lifecycle |
|---|---|---|---|
| `bf-{env}-uploads-incoming` | Private; write only via signed URL | Raw uploads awaiting processing | Delete after 1 day (safety net) |
| `bf-{env}-media-private` | Private; read only via short-lived signed URLs | Processed project photos and files | None (deleted with the media doc) |
| `bf-{env}-media-public` | Public read, served through CDN | Portfolio images, logos, covers (processed variants only) | None; content-addressed names |
| `bf-{env}-exports` | Private; signed URL emailed to owner | Data export ZIPs | Delete after 7 days |

Separate buckets make it impossible for a path mistake to publish private files, and allow different CDN and lifecycle settings.

### 6.2 Upload flow
1. Client: `POST /api/v1/uploads` with `{purpose: "project_photo"|"project_file"|"logo"|"cover", project_id?, items: [{client_id, content_type, bytes}]}` (max 10 items).
2. Server checks auth, policy (e.g. field user on an assigned project), plan limits, and allowed type and size: images ≤ 15 MB, PDF ≤ 20 MB. It creates `media/{mediaId}` docs (`status: "uploading"`) and returns **V4 signed PUT URLs** (15 min) with signed `Content-Type` and `x-goog-content-length-range` headers, for paths `uploads-incoming/{bid}/{mediaId}`.
3. Client PUTs directly to Storage, with retry; resumable for large files.
4. `mediaProcess` Function: sniff the real type from magic bytes, reject mismatches. For images: decode, auto-rotate, **strip all metadata (EXIF/GPS)**, and produce `w320`, `w640`, `w1280`, `w2048` WebP plus a `w1280` JPEG fallback in `media-private/{bid}/{mediaId}/`. Record width, height, bytes and a blurhash. PDFs are stored as-is after type check. Sets `status: "ready"` (or `"failed"` with a reason). Deletes the incoming object. **The original is not kept**; `w2048` is the master.
5. The UI shows the item as processing until `ready`.

The server's service account needs `iam.serviceAccounts.signBlob` to sign URLs under Application Default Credentials. That is a deployment checklist item.

### 6.3 HEIC
**[verify]** whether the server image library build can decode HEIC (HEVC). Common prebuilt `sharp`/libvips builds cannot. Plan: the client converts where the browser can (many iOS uploads already arrive as JPEG). If the server cannot decode, the upload fails with a clear "Please use JPEG or PNG" message rather than storing an image most browsers cannot display (audit D3).

### 6.4 Serving
- **Private media:** the server generates signed GET URLs (10 min) for the variants a page needs, while rendering. This replaces V1's `/media/[...path]` route, which buffered whole files in memory (audit D5). It costs no Firestore reads beyond the media docs already loaded.
- **Public media:** "publish to portfolio" **server-side copies** the chosen processed variants into `media-public/p/{postId}/{n}-{w}.webp` with `Cache-Control: public, max-age=31536000, immutable`. No download/re-upload. Logos and covers go to `media-public/b/{bid}/{hash}-{w}.webp`.
- **Deletion:** deleting a post deletes its public objects in the same service call (fixes audit C.2.6). CDN copies expire per the CDN TTL; content-addressed names mean a new upload never serves a stale image.

---

## 7. Notifications

| Channel | Who | Events (V2) | Mechanism |
|---|---|---|---|
| In-app | Members | All below | `users/{uid}/notifications` (TTL 90 days), unread badge via `count()` |
| Push (FCM) | Members with the app or web push | New quote request, quote viewed/accepted, client message, task assigned, follow-up due | `notifyDeliver` Function on notification create; tokens in `users/{uid}/devices` |
| Email | Members | Same, per preference; daily digest option | Transactional email provider (Postmark, Resend or SendGrid; **decision**, all viable) |
| Email | Customers (if they gave an email) | Quote sent, quote accepted confirmation, project update shared, review request | Sent by the service that caused it, with the client link |
| WhatsApp | Customers | Quote/link sharing | **Tap-to-send** from the contractor's own WhatsApp with a prefilled message and the client link; logged on the timeline. The WhatsApp Business API is out of V2 (strategy §11.4) |

- **Recipients** are computed in the service: e.g. a new quote request notifies owner + admins; a task assignment notifies the assignee; a client message notifies owner + admins + project members. That is ≤ ~5 notification docs per event.
- **Preferences:** `users/{uid}.notification_prefs` with per-event push/email toggles and sensible defaults. The page is a single screen, not a matrix (simplicity rule).
- **Delivery** is at-least-once; `delivered_at` prevents double sends on retries. Invalid FCM tokens are deleted on the error response.

---

## 8. Search, discovery and the feed

### 8.1 What discovery has to do in V2
Strategy: customers browse by **service + area**, see real local work, and request a quote. The follower feed, likes and comments are out. That makes the feed a **filtered, chronological, public query**, not a personalised timeline. **No per-user fan-out is needed**, which is the main thing that makes social feeds expensive.

### 8.2 Explore feed
- Source: top-level `posts` with `visible == true` (= published, not hidden, business listed).
- Filters: `service_id`, `region_id` (flattened; V1 used the nested `business.region_id`), both or neither. **Every combination has a composite index** (schema §5); V1 is missing one of them (audit C.1.1).
- Order: `published_at desc`, cursor-paginated, 20 per page.
- **Diversity:** fetch 30, show at most 2 posts per business per page, carry the remainder forward in the cursor, so one prolific contractor cannot fill the page.
- **Caching:** page 1 per path (`/explore/[service]/[area]`) is ISR with a 60 s revalidate. That costs about 20 reads per path per minute at most, no matter how many viewers. Later pages: `/api/v1/feed` with `Cache-Control: s-maxage=60`.
- **Upgrade trigger (ranking):** when chronological stops serving customers well, add a `score` field computed by a scheduled job (recency decay + verified + review average + photo quality) and order by it; this adds three indexes. Not V2.

### 8.3 Contractor search
- **Structured browse (primary, P0):** `businesses where is_listed == true [and region_id == R] [and service_ids array-contains S] order by rank desc`, cursor-paginated. Index-backed. Replaces V1's "load 500 and filter in memory" (audit D12).
- **Name search:** `search_tokens array-contains <normalised term>` + `is_listed == true`, limit 20. `search_tokens` holds lowercase word prefixes (≥ 2 chars) of the business name and service names, capped at 60 tokens, written by the profile service. One `array-contains` per query is allowed, so name search does **not** combine with the service filter; the UI applies the area filter only. That is an acceptable limit at this scale.
- **Upgrade trigger:** typo tolerance, relevance or > ~10,000 listed businesses → move search to Typesense or Algolia (Firebase extension or a sync Function). The `businesses` doc shape already contains everything an index needs.

### 8.4 Profile page
`businesses/{id}` (1 read) + latest 12 visible posts (12 reads) + latest 5 published reviews (5 reads), ISR with tag `biz:{id}`. The tag is revalidated by the services that change any of them, so repeat views cost no reads.

---

## 9. Project, CRM and money data

The schema doc defines the documents; the shape of the design is:

- **Customer = the contact.** Every quote request, lead, quote, project and message hangs off a `customers` doc. A quote request **finds or creates** the customer by normalised phone (E.164) or email, then creates a lead. This is the "one contact timeline" (strategy #4) without a new contacts system.
- **Lead = an enquiry in the pipeline**, with `next_follow_up_at` for reminders.
- **Quote** has embedded line items (≤ 200), integer minor-unit money, currency, tax, deposit, status, revision, and an immutable acceptance record.
- **Project** is created by `acceptQuote` (or manually). It carries money totals (quoted, invoiced, paid) maintained in the same transactions as invoices and payments.
- **Tasks** live at business level (not nested in projects) so "my tasks across projects" is one indexed query.
- **Site updates** are append-only and hold media references.
- **Activity is the single timeline:** notes, calls, WhatsApp handoffs, messages in and out, status changes, quote events and payments are all `activity` entries keyed by `customer_id` and `project_id`. V1's separate `notes` collection folds into it, so one query renders the timeline.
- **Dates:** instants are Firestore `Timestamp`s (needed for TTL and correct ordering); calendar dates (`due_date`, `start_date`) are `YYYY-MM-DD` strings interpreted in the business timezone (`America/Jamaica` by default). This fixes audit C.2.3.
- **Money:** integer minor units plus an ISO currency on every money document; the business sets a default currency (JMD or USD) and tax (GCT) settings. This fixes audit C.2.4. No currency conversion in V2.

---

## 10. Subscriptions and entitlements

- `subscriptions/{businessId}` (server-only): `plan_id`, `status` (`trialing|active|past_due|read_only|canceled`), `seats_paid`, `trial_ends_at`, `current_period_end`, `provider` (`stripe|play|manual`), provider ids, `updated_from_event_id`.
- **One plan at launch** (strategy §10), data-driven via `plans/{id}` as in V1.
- **Entitlements** are computed by a pure function `entitlements(subscription, now)`:
  - `canWrite`: false in `read_only` and `canceled`. View, export and delete always remain allowed; data is never held hostage.
  - `maxSeats`: `seats_paid`.
  - Checked inside services that create billable value (create quote, invite member, publish post) with **one read** of the subscription doc per mutation.
- **Trial:** 14 days, no card; `billingTick` moves expired trials to `read_only` and emails warnings at T-3 and T-0. This fixes audit C.2.5.
- **Provider: blocked on one decision (audit H.2).** Whether an Android-distributed SaaS subscription must use Google Play Billing, or whether it may use web checkout, is **[verify] against current Google Play policy**. The architecture isolates this: `infra/billing/{stripe,play}.ts` implement the same interface, and both write the same `subscriptions` doc via webhooks. Build the provider only after the decision.
- Public profiles of businesses in `read_only` stay listed for a grace period of 30 days, then are delisted. Customers are never shown billing state.

---

## 11. Analytics

Three different needs, three mechanisms. V1's raw `events` collection (one Firestore doc per view, analytics page reads up to 50,000) is removed (audit D2).

| Need | Mechanism | Cost |
|---|---|---|
| **Contractor insights** (profile views, quote requests, quotes sent/accepted, leads won) | `businesses/{id}/stats/{yyyy-mm}`, one doc per month, with `totals.*` and `days.{dd}.*` counters incremented by the services that cause them | A 30-day dashboard chart = **2 reads** |
| **Product analytics** (activation funnel, retention) | A product analytics tool (PostHog or GA4/Firebase Analytics; **decision**). Server-side events for the funnel: `signup`, `profile_completed`, `first_quote_sent`, `quote_accepted`, `project_completed`, `review_received`. Client events only with consent | No Firestore cost |
| **Business reporting** (internal) | Optional Firestore → BigQuery export later | Not V2 |

**Profile and post views:** the client sends a beacon at most once per business per browser per day (local dedupe), and the server increments `stats` after App Check. **Upgrade trigger:** if a single business doc sustains > 1 write/s, shard the month doc (`stats/{yyyy-mm}_{0..4}`) and sum on read.

---

## 12. Error monitoring, logging and operations

- **Sentry** (or equivalent) for Next.js (client, server, edge), Cloud Functions and the Capacitor shell, with release tagging and source maps. PII scrubbing: no emails, phones or message bodies in events.
- **Structured JSON logs** (pino) with `request_id`, `uid`, `bid`, `action`, `duration_ms`, to Cloud Logging (or the host's log drain).
- **Alerts:** error rate spike, Function failure rate, `mediaProcess` failure rate, Firestore read/write per hour above budget (catches a regression reintroducing unbounded reads), billing webhook failures, uptime check on `/`, `/api/health`, `/c/health`.
- **Budgets:** GCP budget alerts per project at 50/90/100%.
- **Backups:** Firestore scheduled exports (or PITR, **[verify]** pricing) daily to a separate bucket, retention 30 days. Restore is rehearsed once on staging before the closed test.
- **Runbook:** incident contacts, how to suspend a business, how to roll back a deploy, how to rotate keys.

---

## 13. Environment separation and delivery

| Env | Firebase project | Data | Purpose |
|---|---|---|---|
| `local` | Emulators (Auth, Firestore, Storage, Functions) | Seed script | Development, unit/rules/integration tests |
| `staging` | `buildflow-staging` | Seed + test accounts, including the **Play reviewer account** | Real indexes, real Storage, App Check in debug-token mode for E2E, pre-release testing |
| `prod` | `buildflow-prod` | Real users | Closed test, then launch |

- Separate Auth tenants, buckets, App Check keys, FCM senders, email domains (`staging.` subdomain) and Sentry environments. No cross-env credentials.
- Secrets in Secret Manager (or host env), never in the repo. `.env.example` lists names only.
- **Deploying indexes and rules** happens from the repo in CI (`firebase deploy --only firestore:indexes,firestore:rules,storage`) before app deploy. Builds fail if `firestore.indexes.json` misses an index for a declared query (§14).
- **CI** (GitHub Actions): lint → typecheck → unit (policy matrix included) → emulator suite (rules + repos + services) → build → Playwright smoke of the 9-step journey against the emulators → axe on key pages. Deploy to staging on merge to main; manual promotion to prod.
- **Seeds** are emulator/staging only; prod refuses to run the seed script.

### Scale triggers (when the "simple" choice must change)

| Component | Fine until | Then |
|---|---|---|
| Firestore name search (`search_tokens`) | ~10k listed businesses, or users need typo tolerance | Typesense/Algolia |
| Chronological Explore | Customers stop finding good matches in the first pages | `score` field + scheduled ranking |
| Monthly stats doc per business | > 1 sustained write/s on one doc | Sharded counters |
| Firestore rate-limit counters | > ~5% of writes | Managed Redis |
| Single region | Need multi-country low latency or regional data rules | Revisit hosting/DB location (Firestore location cannot move; would need a new database) |
| ISR on profiles | Profile updates so frequent that cache hit rate drops | Fine-grained tags (posts vs profile) |

---

## 14. Internal consistency checks (gate before implementation)

Each check has an owner document and must pass on paper, then in CI.

1. **Every query has an index.** Each query in schema §6 maps to an index in schema §5 or is a single-field query. CI adds a test that runs every repo query against the emulator **and** a static check that each composite query's fields are present in `firestore.indexes.json`.
2. **Every write has a policy decision.** Each service in schema §6 names its `policy` action, and each policy action appears in the matrix in §5.3.
3. **Every denormalised field has exactly one owner.** Schema §4 lists each copy, its source and the service or Function that updates it.
4. **Every collection has a rules entry** (deny), and rules tests prove clients cannot read or write any path (schema §7).
5. **Every client-link capability is scoped.** Each `/c/[token]` action re-checks that the target belongs to the token's `business_id` and to its `scope`.
6. **Every list is paginated.** No repo function exposes a query without `limit` ≤ 50.
7. **Every strategy feature maps to data and routes** (traceability table below).
8. **Every external dependency marked [verify] is resolved** or has a fallback (§15).

### Traceability: strategy features → architecture

| # | Strategy feature | Collections (schema doc) | Entry points |
|---|---|---|---|
| 1 | Onboarding + checklist | `users`, `businesses`, `businesses/*/private/config` | `/onboarding`, checklist derived from counters (no extra collection) |
| 2 | Public profile v2 | `businesses`, `slugs`, `posts`, `reviews` | `/contractor/[slug]` (ISR) |
| 3 | Quote request (hardened) | `customers`, `leads` (`request` field), `activity`, `stats`, `rate_limits` | public action + App Check |
| 4 | Lead inbox + follow-up | `leads`, `activity`, `notifications` | `/app/leads`, `remindersTick` |
| 5 | Quotes | `quotes`, `private/config` (numbering, tax) | `/app/quotes`, `/c/[token]` |
| 6 | Client link | `client_links`, `quotes`, `projects`, `updates`, `activity` | `/c/[token]` |
| 7 | Project hub ("Job" in the UI) | `projects`, `tasks`, `updates`, `media`, `invoices`, `payments`, `activity` | `/app/jobs/[id]` (V1 `/app/projects/*` redirects) |
| 8 | Site updates | `updates`, `media` | project hub, `/api/v1/sync` |
| 9 | Tasks with assignment | `tasks` | `/app/tasks`, project hub |
| 10 | Payments + invoice | `invoices`, `payments`, project money totals | project hub, `/c/[token]` |
| 11 | Publish to portfolio | `posts`, `media`, `media-public` bucket | project hub |
| 12 | Verified reviews | `reviews`, business aggregate | `/c/[token]`, profile |
| 13 | Notifications | `users/*/notifications`, `users/*/devices` | `notifyDeliver` |
| 14 | Team access | `members`, `invitations`, claims | `/app/team` |
| 15 | Billing enforced | `subscriptions`, `plans` | `/app/billing`, webhooks, `billingTick` |
| 16 | Data export | `exports`, exports bucket | `/app/settings/export`, `exportBuild` |
| 17 | Search/Explore | `businesses`, `posts` | `/explore/**`, `/search`, `/api/v1/feed` |
| 18 | Offline capture | `updates`, `tasks`, `payments`, `media` | service worker, `/api/v1/sync` |
| 19 | Android | `users/*/devices` | Capacitor shell |

Foundations from the audit map to: §5 (verification, claims, revocation), §6 (media), §3.4 (abuse), §12 (monitoring), §13 (CI, envs), and schema §7 (rules).

---

## 15. Open decisions and items to verify

| Item | Why it matters | Default if unresolved |
|---|---|---|
| Google Play billing policy for B2B SaaS subscriptions | Decides billing provider and margin | Do not ship in-app purchase; run the closed test on trial/manual plans |
| Hosting: Firebase App Hosting vs Vercel (Next 16.4 feature support, region) | Latency to Firestore, ops surface | Vercel in the region nearest Firestore (current knowledge), switch later; the app is host-agnostic |
| Firestore and Functions region | Permanent for Firestore | Choose before creating prod; measure latency from Jamaica |
| HEIC decode support in the image pipeline | Some iPhone uploads | Reject with a clear message |
| App Check web provider quota/pricing | Abuse protection cost | Turnstile verified server-side |
| Admin MFA (Identity Platform) | Admin account security | Restrict admin by allowlisted Google accounts with 2-step verification enforced on the Google side |
| Background Sync in the Capacitor WebView | Offline replay timing | Replay on app resume/online |
| Next 16 router stall fixed (audit F.4) | Whether to drop `useFormAction` workaround | Keep the workaround |
| Email provider, product analytics tool | Vendor choice | Any of the listed; behind `infra/` interfaces |
| Firestore PITR vs scheduled export pricing | Backup cost | Daily scheduled export |
