# BuildFlow Web App Architecture V2

Status: **proposal for approval.** Nothing in this document has been built or deployed by this pass. It builds on `ARCHITECTURE_V2.md`, `UX_ARCHITECTURE_V2.md`, `FIRESTORE_SCHEMA_V2.md` and `QA_REPORT_V2.md`; where it differs from `ARCHITECTURE_V2.md` it says so.

Brand note: the code, docs and UI say **BuildFlow**. Your brief says "BuilderFlow". This document uses BuildFlow; please confirm the name before domains are bought or the public site copy is finalised.

## 1. The first finding: the web app already exists

The brief asked me to check whether a web app exists before creating one. It does, and it is the product:

- **One Next.js 16 app** (App Router, React 19, Tailwind) in this repository, backed by Firebase Auth, Firestore and Storage through the Admin SDK. About 50 routes, 57 server actions, 30 unit tests, rules tests, integration tests, 5 end-to-end suites and the QA suite from `QA_REPORT_V2.md`.
- It is already split by purpose: a **public site** (`src/app/(site)`), **auth** (`(auth)`), the **contractor workspace** (`/app/**`), a **platform admin** area (`/admin/**`) and **customer pages** that need an account (`/saved`, `/account`).
- It is already **responsive** (bottom navigation on phones, sidebar from the tablet breakpoint), has loading, empty and error states, and passed axe, overflow and tap-target checks on seven phone and tablet viewports.
- There is **no separate mobile codebase in this repository.** `ARCHITECTURE_V2.md` §2.6 already decided that the Android app is a **Capacitor shell that loads this same web app**, so web and mobile share one backend by construction. If you have a different native app somewhere else, tell me: it changes §7.

**So the plan is to upgrade and complete this app, not to build a second one.** Creating a new web app, a separate marketing app or a separate backend would duplicate working code and split the authorization layer that the QA pass just verified.

## 2. What exists today

### 2.1 Route map

| Area | Routes | Rendering today | Who |
|---|---|---|---|
| Marketing | `/`, `/features`, `/for-contractors`, `/for-customers`, `/about`, `/contact`, `/privacy`, `/terms`, `/refund-policy` | Static | Anyone |
| Marketing (data-backed) | `/pricing`, `/search`, `/sitemap.xml` | Static, revalidated hourly | Anyone |
| Discovery | `/explore`, `/contractor/[slug]`, `/post/[id]` | **Dynamic** (reads the session cookie to show Save state) | Anyone |
| Capability links | `/review/[token]`, `/invite/[token]` | Dynamic, no-index | Whoever holds the link |
| Auth | `/login`, `/signup`, `/forgot-password`, `/auth/action` | Mostly dynamic | Anyone |
| Customer account | `/account`, `/saved` | Dynamic | Signed in |
| Contractor workspace | `/app` (Today), `/app/leads`, `/app/customers`, `/app/jobs`, `/app/inbox`, `/app/analytics`, `/app/profile`, `/app/posts/new`, `/app/team`, `/app/billing`, plus detail, new and edit pages | Dynamic | Business members, by role |
| Onboarding | `/onboarding` | Dynamic | Signed in, no business yet |
| Platform admin | `/admin/**` | Dynamic | Platform admin |
| Server | `/api/me`, `/media/[...path]` | Route handlers | Session |

### 2.2 How it is secured (verified by `QA_REPORT_V2.md`)

- **The server is the only authorization layer.** The browser never reads or writes Firestore or Storage. The Firebase client SDK is used for sign-in only. `firestore.rules` and `storage.rules` deny everything to clients as defence in depth (3 rules tests across 30 paths and 4 client types), and a bundle scan found no Admin SDK, Firestore client or private key in the browser JavaScript.
- Session cookie (`__session`, httpOnly, 14 days) from a Firebase ID token. Roles `owner`, `admin`, `field` are in custom claims and re-checked against Firestore. Revocation is checked on every action and at most every 5 minutes for page reads.
- Every action calls `requireBusiness()` / `requirePermission()`, the policy matrix in `src/server/policy.ts`, and scopes queries to the caller's own business. 157 direct action calls as anonymous, customer, crew, another business's owner and admin changed nothing they should not.

### 2.3 Gap analysis against the brief

Legend: ✅ built · ◐ partly · ✗ not built · 🅳 deliberately not built (a recorded product decision).

**Contractor web app**

| Requested | Status | What exists / what is missing |
|---|---|---|
| Dashboard | ✅ | "Today": new leads, follow-ups, overdue and this-week tasks, jobs starting or finishing, activity, pipeline value, month stats |
| Leads / CRM | ✅ | Pipeline, statuses, follow-up dates, assignment, lost reasons, one-tap WhatsApp/call, history |
| Customers | ✅ | Find-or-create from any phone format, status that follows jobs, full timeline |
| Projects | ✅ | Jobs with customer, crew, responsible person, budget, dates |
| Tasks | ✅ | Deadlines, owners, next task on each job, overdue flags |
| Scheduling | ◐ | "Today / this week" lists. **No calendar grid** and no crew-by-day view |
| Project updates | ✅ | Notes and photos on a job, on the customer's timeline too |
| Photos / files | ✅ | Re-encoded WebP photos, PDFs, private serving. **Upload path must change for Vercel (§6)** |
| Messages | 🅳 ◐ | `UX_ARCHITECTURE_V2.md` decided no chat threads: WhatsApp and calls stay on the phone and are logged. Customer messages arrive through a **client link** (`/c/[token]`), which is **not built** |
| Notifications | ◐ | In-app inbox with unread badge. **No email, no push (FCM)**, no preferences |
| Business profile | ✅ | Edit profile, services, area, logo, cover, links |
| Portfolio / showcase | ✅ | Publish a finished job's photos to the portfolio as a "Verified job" |
| Posts / content | ✅ | Post types, before/after, delete. No edit-after-publish |
| Reviews | ✅ | Review links, replies, ratings on profile and cards, report/hide |
| Settings | ◐ | Profile, team, account and billing exist as separate pages. **No settings hub**, notification preferences, data export or delete-account |
| Subscription / account management | ◐ | Billing page shows plan, seats, trial and total. **No payment provider wired** (Stripe vs Play Billing is an open policy decision, `ARCHITECTURE_V2.md` §10) |

**Customer web experience**

| Requested | Status | Notes |
|---|---|---|
| Discover contractors | ✅ | Explore (work and contractors), service and parish filters, search |
| Profiles, services, portfolio, posts, reviews | ✅ | Trust strip, verified jobs, verified reviews, services and area |
| Contact / request a quote | ✅ | One short form, "Request a similar job" from any post, WhatsApp and call |
| Manage relevant conversations and requests | ◐ | `/account` lists requests sent while signed in. No status, no thread |
| Access project information where permission is granted | ✗ | This is the planned **client link**. Not built |
| Save contractors and work | ✅ | Private shortlist |

**Public website**: Home ✅ Features ✅ For Contractors ✅ For Customers ✅ Pricing ✅ Explore ✅ About ✅ Contact ✅ Privacy ✅ Terms ✅ (also Refund policy ✅). **FAQ ✗ and Support ✗** are the only missing pages. See `PUBLIC_WEBSITE_ARCHITECTURE_V2.md`.

## 3. Target architecture

### 3.1 One app, four surfaces, clearly different purposes

```
                     one Next.js app, one Vercel project, one origin
  ┌──────────────┬──────────────────┬─────────────────────┬──────────────────────┐
  │ (marketing)  │ (discover)       │ (auth)              │ (app)  /admin        │
  │ sell BuildFlow│ find and trust   │ get in              │ run the business     │
  │ static       │ contractors      │ static shell        │ dynamic, role-gated  │
  │ no session   │ cached, ISR      │ Firebase Auth (web) │ session cookie       │
  └──────────────┴──────────────────┴─────────────────────┴──────────────────────┘
                              shared: design system, server/, shared/
```

- **Distinct layouts per group.** Marketing gets the full header and footer and no app chrome. Discovery gets the light header with search. The app gets the workspace shell (bottom bar, sidebar). They share tokens, components and the logo, so it feels like one product.
- **Customer vs contractor is a role, not a separate app.** A customer account has no business and sees `/saved` and `/account`. A contractor has a business and sees `/app`. One person can be both (a contractor who also hires). The header and `/api/me` already switch on this.
- This is the structure `ARCHITECTURE_V2.md` §2.1 specified. Today the route groups are named `(site)` and `(auth)`; the move to `(marketing)` and `(discover)` is a rename plus layout split, done route by route.

### 3.2 Rendering strategy (the main performance work)

| Surface | Target | Why |
|---|---|---|
| Marketing | Static (already) | CDN, no function invocation |
| `/contractor/[slug]`, `/post/[id]`, `/explore`, `/explore/[service]/[area]` | **ISR with tag revalidation**; viewer-specific bits (Save state, "this is you") fetched client-side from `/api/me` and a small `/api/v1/viewer-state` | Today each profile view runs a function and reads Firestore because the page reads the session cookie. On Vercel that is cost and latency on the most-shared pages |
| App | Dynamic server components, session cookie, `no-store` | Per-user data |
| Capability links | Dynamic, `no-store`, `noindex` | Secrets in the URL |

### 3.3 Authentication and roles

- Keep the current model: Firebase Auth in the browser for sign-in only, `establishSession` exchanges the ID token for an httpOnly session cookie, custom claims mirror the business role, the policy module decides.
- Add, from `ARCHITECTURE_V2.md` §5.1: **App Check** on anonymous write endpoints (quote requests, reviews), MFA for platform admins, and email verification before anything public is published (already enforced for posts).
- **Protected routes:** `proxy.ts` is the cheap gate (cookie present); every page and action re-verifies. Do not weaken this to "proxy only".
- Customer access to project information is by **capability token** (`/c/[token]`), not by giving customers accounts (UX principle 5). Permission = the token, scoped to one job, revocable, expiring.

### 3.4 Data access rule (do not change)

No browser Firestore or Storage access. Reasons: tenant isolation is enforced in one place, there is nothing to leak through a mis-written rule, and the same server serves the Capacitor shell. Add live listeners only for a feature that needs them (for example, a client-link chat), with a scoped rule, rules tests and a schema update, as the rules file already says.

### 3.5 Sharing logic between web and mobile

- **One backend:** the mobile shell loads this app, so there is no second implementation of any rule. This is the strongest answer to "avoid duplicate business logic".
- **Shared code** lives in `src/shared` (types, zod schemas, constants, money, dates) per `ARCHITECTURE_V2.md` §2.2, moved incrementally as files are touched.
- **If a non-React client ever appears** (a native app, an offline outbox replaying later, a partner integration), it cannot call server actions, whose ids change on every build. Build the versioned `/api/v1/*` route handlers then, as the services behind actions already exist. Not needed for the Capacitor shell.

### 3.6 Responsive layout targets

| Width | Layout | Status |
|---|---|---|
| Phone < 768 | Bottom nav, single column, sticky primary action, 44 px targets | Built and tested at 320, 360, 412 and landscape |
| Tablet 768–1023 | Sidebar, two-column cards, forms centred | Built and tested at 768×1024, 800×1280 |
| Desktop ≥ 1024 | Sidebar plus **two-pane lists** (lead list with the selected lead beside it; jobs list with job detail), wider dashboard grid | **Not built.** Lists and details are separate pages at every width. This is the main "desktop-optimized" gap and the best next UI investment |

### 3.7 States

Loading skeletons (`loading.tsx` on all data routes), empty states with one next action, inline success and error with preserved input, and an in-app 404 are all in place and tested offline, on slow responses and after session expiry (`QA_REPORT_V2.md` H1, H2, M4, M11). New screens must reuse `useFormAction`, `EmptyState`, `ErrorState` and `ConfirmationDialog`; do not write bespoke handling.

### 3.8 Notifications

| Channel | Status | Plan |
|---|---|---|
| In-app inbox | ✅ | Keep. Add types for client messages and quote accepted |
| Email | ✗ | Transactional provider (Resend/Postmark or Firebase Extension **[verify]**), sent from a Cloud Function on Firestore events, with a preferences page. First, because it works on every phone and desktop |
| Web push (FCM) | ✗ | Service worker plus VAPID key, tokens in `users/{uid}/devices`, sent by a Cloud Function. Works in Chrome and Android browsers; **on iPhone only for an installed home-screen app** (**[verify]**). The Capacitor shell uses the native FCM plugin and the same token store |

### 3.9 Messages

Keep the product decision: no general chat. Build the **client link** (`/c/[token]`: quote, status, updates, accept, message) because it is the customer-facing half of "messages", "project information where permission is granted" and "manage requests". Contractor replies appear in the Inbox. WhatsApp stays tap-to-open and is logged on the customer timeline.

### 3.10 Uploads

The current upload path does not work on Vercel for typical phone photos; §6 is the fix and is the first thing to build.

### 3.11 Analytics and monitoring: two corrections to the brief

- **Crashlytics does not have a web SDK.** It is for iOS and Android only (**[verify]**). Use **Sentry** (already specified in `ARCHITECTURE_V2.md` §12) for the web app, server and Cloud Functions, and Crashlytics only inside a future native shell.
- **Firebase Analytics on web is Google Analytics 4.** It needs a consent banner (Jamaica's Data Protection Act 2020 and the privacy page, **[verify with counsel]**) and should load only on public pages after consent. Contractor-facing counters (profile views, requests, saves, reviews) already exist as first-party stats in Firestore and need no third party. Add Vercel Speed Insights or Web Vitals reporting for real-user performance.

### 3.12 Accessibility, SEO, performance

- Accessibility: axe passes on key pages; focus handling, `role="alert"` on errors, tap targets and contrast were audited. Keep an axe step in CI.
- SEO is a public-site concern (`PUBLIC_WEBSITE_ARCHITECTURE_V2.md`).
- Budgets: public pages currently load about 200 KB (scripts about 170 KB); keep first-load JavaScript under 250 KB on public routes and LCP under 2.5 s on a throttled mid-range Android profile. Photos are the real cost (served up to 2048 px); add a roughly 800 px variant.

## 4. Environments and delivery (summary; detail in `VERCEL_DEPLOYMENT_V2.md`)

`local` (emulators) → `staging` (`build-6fa95`, every pull request preview) → `production` (`buildflow-prod`, `main` only). Rules and indexes deploy from GitHub Actions before the app. Secrets live in the host's encrypted environment, never in the repository.

## 5. Implementation plan

Nothing starts until you approve. Each phase is independently shippable and keeps every existing feature working.

### Phase 0: make it deployable on Vercel (do first; small)

1. **Direct-to-Storage uploads** (§6). Without this, photos over about 4.5 MB fail on Vercel.
2. Create the **staging Firebase project** and decide the **Firestore region** (permanent). Deploy rules and indexes to it.
3. Env and secret handling per `VERCEL_DEPLOYMENT_V2.md`; add a `/api/health` route; GitHub Actions for lint, typecheck, unit, rules and the emulator suites.
4. Sentry for web and server.
5. Fix the open QA items that matter at launch: shared rate limiting (Upstash), CSP, and the "Verified" wording decision (QA O1).

### Phase 1: public site and discovery performance

6. FAQ and Support pages; robots and sitemap fixes; programmatic `/explore/[service]/[area]` landing pages.
7. ISR for profile, post and Explore; viewer state moved client-side.
8. Photo variants (about 800 px) and `srcset`.

### Phase 2: complete the contractor and customer web experience

9. Client link `/c/[token]` with quotes (acceptance, status, updates, messages).
10. Email notifications and preferences, then web push (FCM).
11. Settings hub (notifications, export, delete account) and billing provider once the Play Billing question is answered.
12. Desktop two-pane layouts and a calendar view for scheduling.

### Phase 3: mobile

13. Capacitor shell (push, camera, share, app links) loading the hosted app. `/api/v1` only if a non-React client is introduced.

## 6. Vercel-specific blocker: photo uploads

Today a photo is posted to a **Server Action** (configured up to 50 MB) and re-encoded by `sharp` in the same request. Vercel Functions limit the request body to about **4.5 MB** (**[verify against the current Vercel limits page]**). That limit applies on top of the Next.js setting I raised during QA (`proxyClientMaxBodySize`), which fixed the problem for a self-hosted Node server but cannot change a platform limit. On Vercel, a single 12-megapixel phone photo (3–6 MB) would often fail.

The fix is already in `ARCHITECTURE_V2.md` §6.2 and keeps the same safety properties:

1. Browser asks the server for an upload slot (`POST /api/v1/uploads`): the server checks session, role, quota and file type, and returns a short-lived signed URL for `staging/{businessId}/{uuid}` in Storage.
2. Browser uploads the original **directly to Storage** (bytes never pass through a Vercel function).
3. Browser calls the action as today, with the upload id. The server reads the object, **sniffs the real bytes, re-encodes with sharp, strips EXIF, writes the final WebP**, deletes the original, and records it. All QA upload protections (bomb limits, file types, GPS removal) stay in the server step.
4. A Storage lifecycle rule deletes unfinalised `staging/` objects after a day.

Storage CORS must allow the production and staging origins. Estimated size: about two days including tests, then the existing upload test suite runs unchanged against it.

## 7. Open decisions for you

1. **Name:** BuildFlow or BuilderFlow?
2. **Is there a separate native mobile app** outside this repository? If yes, it needs `/api/v1` early; if the Android app is the Capacitor shell, it does not.
3. **Firestore region** (permanent): recommendation in `VERCEL_DEPLOYMENT_V2.md` §3.
4. **Play Billing vs web checkout** for subscriptions (blocks real payments).
5. **Messages:** confirm "client link, no chat threads" for V2.
6. **Domain** for production and staging.
