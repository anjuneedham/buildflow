# BuildFlow V2 Audit

**Scope:** whole repository at commit `4ce97c2` (branch `claude/buildflow-v1`), audited read-only. No application behaviour was changed.
**Method:** source reading, `grep` sweeps of every Firestore query against `firestore.indexes.json`, `npm audit` / `npm outdated`, production build with Firebase configured, Playwright + axe-core runs against 22 URLs at phone (390), tablet (820) and desktop (1280) widths, the existing unit / rules / integration suites, and the 16-step contractor→customer loop run end to end on the Firebase emulators.

**Evidence labels.** Each finding is one of:
- **[verified]** reproduced or counted directly in this repo or a run.
- **[inferred]** follows from the code but was not exercised (typically because it needs a real Firebase project or a real device).
- **[to verify]** depends on an external policy or platform limit that changes over time. Check it at the time of decision; do not rely on this document.

What the audit could not test: real Firestore (the emulator does not enforce composite indexes or quotas), a deployed Firebase project, real devices, screen readers, real network conditions, Google Play Console. Accessibility results are automated only; automated tools catch a minority of real issues.

---

## A. Current architecture

### A.1 Stack
| Layer | Choice |
|---|---|
| Framework | Next.js 16.4.2, App Router, React 19.2, TypeScript 6 |
| Styling | Tailwind 3.4 + `tailwind-merge` (`cn()`), lucide-react |
| Validation | zod 3 on every server action |
| Auth | Firebase Auth. Browser SDK is used **only to sign in**; the ID token goes to the `establishSession` server action, which mints an httpOnly `__session` cookie (`createSessionCookie`, 14 days) |
| Database | Firestore, accessed **server-side only** via the Admin SDK |
| Files | Cloud Storage via Admin SDK. Public images get tokenised URLs; private `project-files` are streamed through `/media/[...path]` after a membership check |
| Rules | `firestore.rules` and `storage.rules` deny all client reads/writes of private data and all writes (defence in depth), covered by `@firebase/rules-unit-testing` |
| Billing | Stub only (`src/lib/billing.ts`); Stripe is not wired |
| Hosting | Not deployed. The Vercel link shared with partners is the standalone `demo-site/` (localStorage), not this app |

### A.2 Layout (≈7,066 lines of TS/TSX in `src/`)
- `src/app/(site)` public pages (landing, explore, search, pricing, legal, contractor profile `/contractor/[username]`, post pages). `(auth)` login/signup/forgot. `app/` the contractor workspace. `admin/`, `onboarding/`, `media/`.
- `src/app/actions/*.ts`: 7 files, 49 exported server actions (`auth`, `onboarding`, `crm`, `projects`, `social`, `business`, `admin`).
- `src/components/{ui,cards,nav,crm,forms,social,brand}`: 42 files.
- `src/lib/{firebase,data,…}`: 21 files. Key ones: `session.ts`, `queries.ts`, `data/tenant.ts`, `storage.ts`, `rate-limit`, `billing.ts`, `legal.ts`, `utils.ts`.
- `scripts/seed.mts`, `scripts/make-admin.mts`; `tests/{plans,search}.test.ts`, `tests/rules/`, `tests/integration/`; `docs/*.md`.
- `demo-artifact/` (1,137 lines) and `demo-site/` (1,204 lines): a **second, separate UI and logic codebase** used for the Claude artifact and the Vercel demo.

### A.3 Request flow
1. `src/proxy.ts` (Next 16's replacement for middleware) checks only that a `__session` cookie **exists** for `/app`, `/onboarding`, `/admin`, `/saved`, `/account`, else redirects to `/login?next=`. It does not verify the cookie.
2. `getSession()` (React `cache`, so once per request) does the real work: `verifySessionCookie(cookie, true)` (revocation check = a network call to Firebase Auth), then reads `users/{uid}`, the business, and `members/{uid}`. That is **~3 Firestore reads + 1 Auth call per authenticated request**.
3. `requireUser` (also redirects suspended users), `requireBusiness`, `requireAdmin` wrap it.
4. Server actions validate with zod, call `tenant(businessId)`, and return `{ ok, redirectTo?, error? }`. Clients use `useFormAction` / `useServerAction` (`src/components/ui/use-form-action.ts`) and navigate client-side. This pattern deliberately avoids `redirect()` and `revalidatePath()` for `/app` routes; it was a workaround for a router stall on Next 15.5 and is still in place after the Next 16 upgrade (see F.4).

### A.4 Multi-tenancy
- All private data lives under `businesses/{id}/…` subcollections and is reached only via `tenant(businessId)` with the id coming from `requireBusiness()`, never from client input.
- Public data (posts, businesses) uses a denormalised business snapshot and a `visible` flag on each post. Counters use transactions; side effects (events, activity, notifications, quote→lead) are written in the same batch.
- Roles: owner / admin / member per business, plus a platform admin flag. One business per user.

### A.5 Demo artefacts
The Claude artifact (React 18 UMD + htm, `window.claude` capabilities) and the Vercel site (localStorage shim) re-implement the UI, search parsing, seed data and scenes independently. They share a visual language ("block course" bricks, hazard stripe, spec plate) but no code with `src/`.

---

## B. What is working

**[verified]** unless noted.

- **The 16-step definition-of-done loop** (contractor signup → business → services → post → public profile → customer quote → lead → customer → project → tasks → showcase) runs end to end on the emulators.
- **Tenant isolation**: integration and rules tests pass. Server-only Admin SDK access plus deny-all client rules is a strong baseline.
- **Auth model**: httpOnly session cookie, revocation check per request, suspended users redirected, admin actions re-check the admin flag server-side.
- **Input validation**: zod on every action; honeypot field on public quote form; persistent per-contact throttle on quote requests.
- **Build hygiene**: `typecheck`, `lint` (`eslint .` with React Compiler rules) and `build` are clean.
- **Responsive layout**: no horizontal overflow at 390 / 820 / 1280 on 22 URLs; no failed network requests; sidebar appears at `md`.
- **Document hygiene**: `<html lang="en">`, exactly one `<h1>` and one `<main>` per page, 10 files use `EmptyState`.
- **Tests that exist**: 8 unit, 5 rules, 7 integration tests, all green.
- **Docs and seed**: `docs/*.md`, README, demo seed accounts (emulator only).
- **Security headers** present: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`.
- **Cleanup on project delete**: `deleteProject` removes stored photos.

---

## C. What is broken

### C.1 Will fail on real Firestore, invisible on the emulator
1. **Missing composite indexes [verified by query-vs-index sweep; behaviour on real Firestore is inferred].** 19 composite indexes are declared, but two query shapes have none:
   - `reports`: `where status == … orderBy created_at desc` (admin reports page).
   - Explore feed `getFeed` when **both** a service and a region filter are active: `visible == true, service_id ==, business.region_id ==, orderBy created_at desc`.
   Firestore returns `FAILED_PRECONDITION` for these. The emulator does not enforce indexes, so every test passes. Expect the Explore filter combination and the admin reports page to 500 in production.
2. **Everything is dynamic once Firebase is configured [verified].** With Firebase configured the build marks **all** routes dynamic (ƒ), including `/`, `/privacy`, `/terms`, `/about`, `/pricing`, because `(site)/layout` calls `getSession()` → `cookies()`. Only `/_not-found`, `/forgot-password`, `manifest`, `robots` and `sitemap` stay static. The earlier "static" build output was an artefact of building without Firebase credentials. Consequence: every marketing and legal page costs a function invocation + 3 Firestore reads + an Auth call for logged-in users, with no CDN caching, which hurts TTFB, SEO crawl budget and cost.

### C.2 Wrong results
3. **Timezone bug [verified in code].** `dateInDays` in `src/lib/utils.ts` uses `toISOString().slice(0, 10)`, which is the **UTC** date. For Jamaica (UTC−5) after 7 pm local, "today" is already tomorrow, so tasks are marked overdue/due-today incorrectly. Dates rendered on the server also use the server's timezone, not the user's.
4. **Currency is hardcoded `$` [verified].** `formatAmount` / `compactAmount` have no currency concept. Pricing is in USD while the launch market (Jamaica) typically quotes in JMD; a contractor quoting JMD sees `$` with no unit.
5. **Trial/subscription state is displayed but never enforced [verified].** Trial expiry is shown on the billing page only; nothing gates features after expiry. Plan limits (users, etc.) depend on this.
6. **Deleted posts leave live public image URLs [verified in code].** `deletePost` removes the document but not the storage objects; the tokenised URLs keep working for anyone who has them.
7. **Role scope does not match the spec [verified].** The spec said team members see assigned work only. There is no assigned-only filtering anywhere: every member sees every lead, customer, project and task.

### C.3 UI breakage found during the run
8. Task form overflowed phone width after the redesign (fixed in-session, flagged because it was found by hand, not by a test).
9. Seed cover images are hot-linked from Unsplash, so they fail in offline or restricted environments and in any production without outbound access.
10. Lead names truncate at tablet width.

---

## D. Critical risks

Ordered by blast radius.

| # | Risk | Evidence | Impact |
|---|---|---|---|
| D1 | **No abuse protection on anonymous endpoints** (quote request, contact, view tracking, comment, report, session). The only limiter is **in-memory per instance** (`rateLimit()`), which resets on cold start and is not shared across serverless instances. No CAPTCHA, no App Check. | [verified] | Spam into contractors' lead lists; Firestore write/cost amplification. |
| D2 | **Unbounded writes and reads from `trackView`/analytics.** One Firestore document per page view in `events`; the analytics page reads up to **50,000** docs per load (`.limit(50000)`). | [verified] | Cost and latency grow linearly with traffic; a single busy contractor can exhaust read quota. |
| D3 | **Image pipeline is unsafe and heavy.** `checkImage` trusts the client-supplied `file.type`; allows `image/heic` (not renderable in most non-Safari browsers); 10 MB cap per file; **no resize, no compression, no EXIF/GPS stripping** on *public* photos; raw `<img>` (11 uses, 11 eslint-disable) serves the original. | [verified] | Privacy leak (site GPS coordinates in photos from job sites), slow pages on mobile data, broken HEIC images, content-type spoofing. |
| D4 | **Upload path may not work on serverless hosting.** Photos are uploaded through Server Actions; `serverActions.bodySizeLimit` is `50mb` while a platform's request body limit (Vercel documents ~4.5 MB for functions) would reject large photos before the action runs. | [inferred; **to verify** for the chosen host] | Uploads of normal phone photos fail in production while working locally. |
| D5 | **`/media/[...path]` buffers whole files in memory** before responding. | [verified] | Memory spikes and slow first byte for large private files. |
| D6 | **Email verification is never enforced.** `emailVerified` is read and shown as a dashboard banner only; posting, quotes and invite acceptance do not require it. | [verified] | Fake accounts, impersonation of businesses, invite hijack by anyone who can sign up with the invited address. |
| D7 | **No account deletion, data export, block-user, or consent record.** | [verified] | Hard blocker for Google Play (account deletion and UGC policies; **to verify** current wording) and for privacy-law compliance. |
| D8 | **Legal placeholders remain.** `src/lib/legal.ts` still contains `[Registered business address — to be confirmed]`, `[Jurisdiction — to be confirmed by counsel]`, and a TODO company name. Policies are drafts flagged for counsel. | [verified] | Cannot submit to Play or take payment with these. |
| D9 | **Security headers incomplete.** No CSP, no HSTS; `X-Frame-Options` only. Session cookie is not `__Host-` prefixed. No MFA for admin, no admin audit log. | [verified] | XSS blast radius larger than needed; admin account takeover = full tenant access. |
| D10 | **Dependency vulnerabilities.** `npm audit --omit=dev`: **12 vulns (8 moderate, 4 high)**, all transitive via `firebase` / `firebase-admin` (`@grpc/grpc-js`, `@firebase/firestore`, `uuid`, `google-gax`…). | [verified] | Needs triage; upstream upgrade is the fix. Many may not be reachable, but that has not been assessed. |
| D11 | **No observability.** No Sentry/Crashlytics, no analytics, only `console.error`. | [verified] | Production failures (including D1's index errors) would be invisible until a user complains. |
| D12 | **Session read amplification.** ~3 reads + 1 Auth call on every authenticated request; Explore reads ~530 docs per view (500 business docs loaded then filtered in memory by `searchBusinesses`). | [verified] | Cost and latency at modest scale; breaks entirely past 500 businesses (search silently stops finding businesses). |

---

## E. UX problems

### E.1 Accessibility (axe-core, WCAG 2.1 A/AA, phone viewport; automated only)
- **`color-contrast` (serious), ~25 page-instances.** White text on the brand orange `#f26b1d` is **3.04:1**, below the 4.5:1 required for 14 px text. Affects primary buttons, the nav "Get started" button, the search button and the orange "Flow" wordmark. Active tab colour `#d65611` on white is **4.03:1** at 11 px.
- **`label-content-name-mismatch`:** `aria-label="Like"` / `"Open post"` do not contain the visible text.
- No skip-to-content link.
- 68 `aria-*` attributes and 12 `alt` attributes in the whole app; no manual screen-reader pass was done.

### E.2 Mobile
- Loading state exists only at `src/app/app/loading.tsx`. Public pages (Explore, profile, post) show nothing while loading, which on weak mobile connections reads as a frozen page.
- One global `error.tsx`. Any Firestore failure in any segment replaces the whole page; there is no inline retry or per-section error.
- Forms rely on the custom `useFormAction` pattern; "Saving…" can be stuck only if the action never resolves. There is no timeout or retry UI.
- No offline behaviour, no service worker. In a patchy-connectivity market this is a UX gap, not just a PWA nicety.
- Photo upload has no client-side progress for multi-photo (up to 10 × 10 MB) uploads.

### E.3 Tablet
- Layout works (sidebar at `md`), but Explore is a **narrow centred column with wasted space** and no multi-column feed. Lead names truncate.

### E.4 Flow gaps
- Customers who send quote requests have no account, no status tracking, and no way to message the contractor back; the loop ends at "lead created".
- No notification delivery outside the app (no email, no push). Notifications exist only as in-app rows.
- No pagination or infinite scroll for leads, customers, projects (hard-limited to 500, searched in memory).
- A user can own only one business; there is no business switcher.
- Missing or weak empty/error states on non-list screens (analytics, billing, admin) were not individually audited.

---

## F. Technical debt

1. **Two UI codebases.** `demo-artifact/` + `demo-site/` (~2,300 lines) duplicate and diverge from the Next app. Every product change must be made twice or the demos become misleading.
2. **Unchecked data typing.** `fromDoc<T>` casts Firestore data to `T` with no runtime validation; 3 `as unknown as` casts. Schema drift in production data will surface as runtime `undefined` errors.
3. **Dead code: 22 unused exports** [verified]: `Skeleton`, `Column`, `LogoMark`, `isActive`, `SessionUser`, `Membership`, `signUpSchema`, `signInSchema`, `formToObject`, `ReportReason`, `createCheckoutSession`, `TenantCollection`, `EventType`, `NotificationType`, `commitQuietly`, `ID_RE`, `sortMedia`, `getBusinessBySlug`, `PlanId`, `PostMedia`, … (`viewport` is a Next convention, not dead).
4. **Router-stall workaround is permanent.** The no-`redirect`/no-`revalidatePath` pattern for `/app` was introduced for a Next 15.5 bug. After upgrading to 16.4.2 it was kept. It means server-rendered pages can be stale after mutations unless the client navigates; it should be re-evaluated and ideally replaced with standard `revalidatePath` + `redirect` (or `router.refresh`), then covered by an E2E test.
5. **Thin error handling.** 49 server actions with roughly one `try/catch` per file; `social.ts` and `admin.ts` have none. Failures become the global error page.
6. **Raw `<img>` in 11 places** with 11 `eslint-disable` comments, bypassing `next/image` optimisation.
7. **Reference data uncached.** `getServices` / `getRegions` are cached per request only and re-read on every page.
8. **In-memory rate limiter** (see D1) is a design-level debt, not just a tuning issue.
9. **Dependencies behind** (verified via `npm outdated`): `firebase` 11→13, `firebase-admin` 13→14, `zod` 3→4, `tailwind` 3→4, `typescript` 6→7, `eslint` 9→10, `next` 16.4.2→16.4.3. The client `firebase` package ships Firestore even though only Auth is used in the browser.
10. **Testing gaps.** No tests of server actions; Playwright E2E and axe scripts live only in a scratchpad (not committed); no CI (`.github/` absent); rules tests and integration tests need the emulator and are not wired into any pipeline.
11. **Committed/local clutter risk.** `firebase-debug.log` and `firestore-debug.log` exist in the root (gitignored, but easy to commit by mistake).
12. **Billing stub** (`createCheckoutSession`, unused) and no webhook handling.

---

## G. Missing features

For a serious production candidate, grouped by priority.

**Needed to launch**
- Account deletion (in-app and a web URL), data export, consent capture (terms + privacy version and timestamp).
- Block user, report workflow with moderator tooling, moderation SLA and takedown audit trail.
- Transactional email (verification, invites, quote received, password reset branding) and push notifications (FCM).
- Subscription billing with enforcement of trial expiry, user limits and grace periods.
- Error/crash monitoring and product analytics.
- Real legal text.

**Needed for the target market and product**
- Offline-tolerant behaviour (service worker, queued writes for tasks and notes).
- Currency and locale model (JMD/USD), timezone-aware dates.
- Assigned-only visibility for team members; business switcher.
- Customer-side accounts or magic-link status page for quote requests; messaging.
- Pagination, server-side search (text index or external search) for businesses, leads, customers.
- File handling: resize/compress, EXIF strip, signed direct-to-Storage uploads, malware scanning for private files (**to decide**).

**Needed for Google Play** (see H.2)
- Packaged Android app, icons, digital asset links, store listing assets, Data safety inputs, reviewer credentials.

---

## H. Production blockers

### H.1 Must fix before any real users
1. Add the two missing composite indexes (C.1.1) and run the full flow against a **real staging Firebase project** (indexes, rules, Storage CORS, App Check).
2. Remove `cookies()` from the public layout and make public pages cacheable (C.1.2).
3. Abuse protection that survives serverless: App Check + CAPTCHA on anonymous forms, durable rate limiting (Firestore counter, Redis/Upstash, or platform WAF).
4. Image pipeline: validate magic bytes, re-encode to JPEG/WebP, resize, strip EXIF, delete storage on post removal; decide on direct-to-Storage uploads (D3, D4).
5. Enforce email verification for posting, quotes and invite acceptance.
6. Replace legal placeholders and get counsel review; record consent.
7. Add error monitoring and a minimal logging convention before any user traffic.
8. Bound analytics (aggregate counters, daily rollups) and remove the 50k read.
9. Timezone fix and currency decision.
10. CI that runs lint, typecheck, build, unit tests, and emulator-backed rules/integration tests.
11. Triage the 12 audit findings; upgrade `firebase` / `firebase-admin`.
12. Add CSP and HSTS; harden admin (MFA, audit log).

### H.2 Google Play readiness

**Observed gaps [verified]:**
- No Android packaging (no TWA/Bubblewrap or Capacitor project).
- Web manifest has `start_url: "/app"` (requires login) and only an SVG icon: **no PNG 192/512 and no maskable icon**, no `id`, `scope`, or screenshots.
- No service worker; no offline page.
- No `public/.well-known/assetlinks.json`, so a TWA cannot verify the domain.
- No in-app account deletion; no block-user; privacy policy contains placeholders.
- No push notifications, no crash reporting.
- Seed accounts are emulator-only, so there are no reviewer credentials for Play review.

**External requirements to confirm at submission time [to verify, as these change]:**
- Account deletion and UGC policy wording and the required Data safety declarations.
- Target API level for new apps/updates.
- Closed-testing requirements (number of testers and duration for new personal developer accounts).
- **Billing policy:** whether a SaaS subscription for business use sold inside the app must use Google Play Billing, or whether web checkout is permitted for this kind of product. This decides the whole billing architecture and must be settled before building Stripe.
- Whether a TWA or Capacitor shell is more appropriate (push, camera, offline file access favour Capacitor).

---

## I. Recommended architecture

Keep what works: **Next.js + server-only Firestore + session cookie + tenant boundary**. Change the following.

### I.1 Structure
```
src/
  app/
    (public)/…        statically rendered / ISR; NO cookies() in layout
    (account)/…       dynamic, authenticated shell
    api/…             only for webhooks, signed upload URLs, cron
  server/
    auth/             session, requireUser/Business/Admin, claims
    data/             tenant(), typed repositories with zod parse on read
    jobs/             rollups, image post-processing, cleanup
  features/<domain>/  actions, queries, components, tests together
```
- Public layout renders a **client-side auth island** (small component fetching `/api/me`, or reading a non-sensitive hint cookie) so the shell stays static.
- Put `businessId` and role into **Firebase custom claims** (or a signed short-lived cookie) so a request needs one cookie verification and no `users` + `business` + `members` reads. Revocation by bumping a `session_version`.

### I.2 Data
- Repositories parse with zod on read (`fromDoc` becomes validated).
- Denormalised search fields: lowercase name prefix tokens, region, services, so search is index-backed; if search outgrows that, add Algolia/Typesense.
- Analytics: per-day counter documents (`business/{id}/stats/{yyyy-mm-dd}`) incremented in a transaction or via Cloud Function aggregation, not raw per-view events.
- Cursor pagination everywhere (`startAfter`), with `limit` ≤ 25.
- Commit `firestore.indexes.json` generated from the actual query set and add a test that fails when a query lacks an index (e.g. run against the emulator with index enforcement, or a static check).

### I.3 Media
- Client: resize (≤ 2048 px long edge), convert HEIC → JPEG, then **direct upload to Storage with a server-issued signed URL** or via a Storage-rules-restricted path, so bytes never traverse the app server.
- Server/Function (`onFinalize`): verify magic bytes, strip EXIF, generate thumbnails + WebP, set `Cache-Control`, record dimensions (fixes layout shift), delete on post/project removal.
- Serve through `next/image` with the Firebase Storage or a CDN domain.

### I.4 Security
- Firebase **App Check** (reCAPTCHA Enterprise / Play Integrity) enforced on Auth and on server actions via a verified token.
- Durable rate limiter keyed by IP + contact + route.
- CSP (nonce-based), HSTS, `__Host-` session cookie, admin MFA, append-only `admin_audit` collection.
- Verified-email gates on posting, quote submission, invite acceptance.

### I.5 Platform
- **Hosting decision:** keep Vercel only if body limits and cost are acceptable; otherwise Cloud Run / Firebase App Hosting, which sits next to Firestore and Storage and removes the 4.5 MB question. Decide before investing in uploads.
- Environments: `dev` (emulators), `staging` (real Firebase project), `prod`. Secrets via host env, never committed.
- Observability: Sentry (web + server), structured logging, uptime check, Firestore usage alerts.
- Billing: choose Stripe vs Play Billing **after** the policy check in H.2; isolate behind `billing.ts` with a webhook route and a `subscription` state machine that actually gates features.

### I.6 One UI codebase
Delete `demo-artifact/` and `demo-site/` as hand-maintained forks. If demos are still needed, generate them from the real app (a `?demo=1` mode backed by the emulator seed or a static export of seeded pages) so there is a single source of truth.

### I.7 Delivery
- GitHub Actions: lint → typecheck → unit → emulator (rules + integration) → build → Playwright smoke (the 16-step loop) → axe on key pages.
- Commit the E2E and axe scripts currently in scratchpad.

---

## J. Recommended V2 roadmap

Estimates are relative effort (S ≤ 3 days, M ≈ 1–2 weeks, L ≈ 3+ weeks) for one engineer; treat as rough.

### Phase 0: Safety net (S–M)
- CI pipeline; commit E2E + axe scripts; add the 2 missing indexes; staging Firebase project; run the full loop against it.
- Triage `npm audit`; upgrade `firebase` / `firebase-admin`; remove 22 dead exports.
- Sentry + structured logging.
- **Exit:** CI green on every PR; the 16-step loop passes on real Firestore.

### Phase 1: Correctness and cost (M)
- Make public pages static/ISR; claims-based session; cache reference data.
- Timezone fix (store ISO timestamps, compute "today" in the business's timezone); currency field on business.
- Pagination and index-backed search; replace 500-doc scan.
- Analytics rollups; drop the 50k read.
- Per-segment `error.tsx`/`loading.tsx`; wrap actions in a shared `safeAction` that returns typed errors and logs.
- **Exit:** public page TTFB served from cache; Explore reads ≤ 30 docs/view; no unbounded query remains.

### Phase 2: Trust and safety (M–L)
- App Check + CAPTCHA + durable rate limiting.
- Email verification enforced; consent records; account deletion + data export; block user; moderation queue.
- CSP/HSTS, admin MFA + audit log.
- Image pipeline (I.3), including storage cleanup on delete.
- Real legal text from counsel.
- **Exit:** abuse test (scripted spam) is throttled; deletion flow verified end to end; privacy docs final.

### Phase 3: Product depth (L)
- Billing: policy decision, then Stripe or Play Billing, trial enforcement, plan limits.
- Role-scoped visibility (assigned-only), business switcher.
- Notifications: email + FCM push.
- Customer quote status page (magic link) and basic messaging.
- Offline-tolerant tasks/notes (service worker + queued writes).
- **Exit:** a paying team of 3 can use it daily; customers can follow their quote.

### Phase 4: Accessibility and design pass (M, can overlap Phase 2–3)
- Fix contrast (darken the orange for text/buttons to ≥ 4.5:1 or use dark text on orange); fix `aria-label` mismatches; skip link; manual screen-reader and keyboard pass; tablet multi-column Explore.
- **Exit:** axe clean on all key pages plus a manual checklist.

### Phase 5: Google Play (M)
- Decide TWA vs Capacitor; icons (PNG 192/512 + maskable); manifest (`id`, `scope`, `start_url` public or login-aware); `assetlinks.json`; store listing assets; Data safety answers; reviewer account on staging; closed-testing setup per the then-current rules.
- **Exit:** signed AAB accepted in closed testing; reviewer can log in and exercise the core loop.

### Phase 6: Launch readiness (S–M)
- Load and cost test with realistic data; Firestore quotas/alerts; backup/export schedule; runbook; incident contact; rollback procedure.
- Remove duplicated demo codebases (or regenerate from the real app).

---

## Appendix: reproducible facts

- Routes with Firebase configured: all dynamic except `/_not-found`, `/forgot-password`, `manifest`, `robots`, `sitemap`.
- JS on a simple public page: ≈500 KB decoded, 20–31 requests; Firebase Auth chunk (115 KB) loads on `/login` only. Local TTFB 340–420 ms.
- Per authenticated request: ~3 Firestore reads + 1 Auth revocation check + unread-notification count. Dashboard ≈ 12 queries. Explore ≈ 530 reads per view.
- Tests: 8 unit, 5 rules, 7 integration; **0** server-action tests; **0** E2E in repo.
- `npm audit --omit=dev`: 12 vulnerabilities (8 moderate, 4 high), all transitive via firebase / firebase-admin.
