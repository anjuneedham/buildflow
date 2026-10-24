# BuildFlow Vercel Deployment V2

Status: **plan only. Nothing has been deployed, no Vercel project has been created or changed, and no environment variable has been set.** Deploying requires your explicit approval.

Items marked **[verify]** are from my knowledge of Vercel and Firebase, which I could not confirm in this session (the documentation search available to me did not return the relevant pages). Check them against the current Vercel and Firebase documentation before relying on them.

## 1. Decisions

| # | Question | Recommendation |
|---|---|---|
| 1 | One Vercel project or two (marketing site and web app)? | **One project.** See §2. |
| 2 | Project structure | Repository root is the project root. Framework Next.js. No monorepo tooling needed. |
| 3 | Build command | `next build` (the default; `npm run build`) |
| 4 | Output configuration | **Leave at the default** (`.next`). Do not set `outputDirectory`, and do not use static export: the app needs server rendering, Server Actions, the proxy and route handlers. |
| 5 | Install command | `npm ci` |
| 6 | Node version | 22.x (what the test suite runs on) |
| 7 | Production vs development | Production branch `main` → production Firebase project. Every other branch and pull request → preview deployments on the **staging** Firebase project. `vercel dev` / `npm run dev` → emulators. See §4. |
| 8 | Routing configuration | **None needed in `vercel.json`.** Next.js handles routes, and the legacy redirects are already in `next.config.ts`. See §6. |
| 9 | Function region | Pick it **after** the Firestore region (§3); set both to the same coast. |
| 10 | Plan | Production use needs a paid Vercel plan: the Hobby plan is for non-commercial use **[verify current terms]**. |

## 2. One project or two?

**One Vercel project containing the whole Next.js app.**

The marketing site, discovery pages and the web app are the same codebase, the same design system and the same origin. Splitting them would cost more than it gives:

| Concern | One project | Two projects |
|---|---|---|
| Session cookie | Same origin, nothing to configure | Cross-subdomain cookie domain, CSRF and redirect handling, "who is signed in" on the marketing header becomes a cross-site problem |
| SEO | Marketing, profiles and posts share one domain's authority; contractor pages are the best long-tail content and live under the same host | Profiles and marketing compete or split |
| Release | One pipeline, one rollback, one set of env vars | Two pipelines, version skew between the header on one and the app on the other |
| Shared components | Direct imports | Package or copy |
| Cost and ops | One | Two |
| Marketing pages performance | Already **static** (CDN) in this build; the public marketing routes are `○ Static` in the build output | Same |

**When to split (not now):** a marketing team that must publish copy without engineers (then put a headless CMS behind the *same* project first), a different framework for marketing, or a need for a separate WAF and access policy for the app. If that day comes, split by host: the app on `app.<domain>`, marketing on the apex, and keep the discovery pages with marketing.

**Keeping the separation clean inside one project:** distinct route groups and layouts (`(marketing)`, `(discover)`, `(auth)`, `(app)`), static rendering for marketing, an ESLint import boundary so marketing never imports from `/app` code, and a host-based rewrite if you later want `app.<domain>` to serve `/app` (a few lines in `next.config.ts`, no new project).

**Existing Vercel projects:** your account already has `buildflow-demo`, a static click-through demo with its own project (Root Directory `demo-site`, no build). It is unrelated to this app and unaffected. The real app has no Vercel project yet.

## 3. Firebase prerequisites (before the first deploy)

1. **Two Firebase projects.** `.firebaserc` now points `default` and `staging` at **`build-6fa95`** (a project id you set in the latest commit) and still names `buildflow-prod` for production. Treat `build-6fa95` as staging; do not put real customer data in it, and create the production project separately. Never share data, Auth users, buckets or keys between the two.
2. **Firestore region is permanent.** Choose before creating the production database. Recommendation: **`us-east4` (N. Virginia)** with Vercel functions in **`iad1`** (also N. Virginia), the closest major region to Jamaica **[verify latency from Kingston]**. Alternatives from `ARCHITECTURE_V2.md`: `us-east1` or the multi-region `nam5`. Put the Storage buckets in the same region.
3. **Billing plan:** Cloud Storage for new Firebase projects and Cloud Functions require the paid (Blaze) plan **[verify]**. Set a budget alert.
4. **Auth:** enable Email/Password. Set the **Action URL** (Authentication → Templates) to `https://<domain>/auth/action` so verification and reset links open the app's own page. Add **authorized domains**: the production domain, the staging domain and `localhost`.
5. **API key:** the web API key is not a secret, but restrict it in Google Cloud Console to your domains (HTTP referrers) and to the Identity Toolkit API.
6. **Rules and indexes** deploy from CI, not from Vercel:
   `firebase deploy --only firestore:rules,firestore:indexes,storage --project <id>`. Run this **before** the app deploy that needs them. `firestore.indexes.json` covers every query (audited in `QA_REPORT_V2.md` §5), but the emulator does not enforce indexes, so the first staging run is the real test.
7. **Storage CORS:** required once uploads go directly from the browser to Storage (`WEB_APP_ARCHITECTURE_V2.md` §6). Allow `PUT` and `GET` from the production and staging origins only.
8. **App Check** (reCAPTCHA Enterprise) for the anonymous endpoints (quote request, review) **[verify pricing]**. Add after launch if abuse appears; the in-app rate limits are only per instance (§7).

## 4. Environments

| Vercel environment | Git trigger | Firebase project | `NEXT_PUBLIC_APP_ENV` | Domain |
|---|---|---|---|---|
| **Production** | `main` | `buildflow-prod` | `production` | `<domain>` |
| **Preview** | any other branch, any pull request | `build-6fa95` (staging) | `staging` | `*.vercel.app` per deployment |
| **Staging** (stable) | branch `staging` | `build-6fa95` | `staging` | `staging.<domain>` (a Vercel custom environment, paid plans **[verify]**) |
| **Development** | `vercel dev`, `npm run dev` | emulators, `demo-buildflow` | `local` | `localhost:3000` |

Rules that follow from how the app is built:

- `NEXT_PUBLIC_*` values are **inlined into the browser bundle at build time**. A build made for staging contains staging Firebase settings. **Never promote a preview or staging deployment to production**; production is always built from `main` with production variables.
- The app **refuses to start** in `staging` or `production` if emulator variables are set, a `demo-*` project id is used, `NEXT_PUBLIC_SITE_URL` is not https, or required Firebase variables are missing (`serverEnvProblems` in `src/lib/env.ts`). A bad configuration fails the first request loudly instead of corrupting data.
- **Preview deployments change URL on every push.** Password-reset emails carry a continue URL that Firebase only accepts for authorized domains (no wildcards). So test sign-in, verification and reset on the **stable staging domain**, not on random preview URLs. Turn on **Vercel Authentication** for previews: they point at staging data.
- The `main` branch currently contains only the initial commit; the V2 work is on `claude/buildflow-v1` (21 commits ahead). Production deploys follow the first merge to `main`, which is your call.

## 5. Environment variables

Set in Vercel → Project → Settings → Environment Variables. **No value is committed to the repository.** `.env.example` lists the names.

| Variable | Production | Preview / Staging | Development | Sensitive | Notes |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | `production` | `staging` | `local` | no | Drives the startup checks above |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | prod app | staging app | emulator value | no | Firebase console → Project settings → Your apps |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `<prod-project>.firebaseapp.com` or custom auth domain | staging | — | no | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `buildflow-prod` | `build-6fa95` | `demo-buildflow` | no | `demo-*` is refused outside local |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | prod bucket | staging bucket | — | no | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | prod app id | staging app id | — | no | |
| `NEXT_PUBLIC_SITE_URL` | `https://<domain>` | `https://staging.<domain>` | `http://localhost:3000` | no | Used for review links, canonical URLs, sitemap and robots. Must be https when deployed |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | real address | same | — | no | |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | prod service account | staging service account | empty | **yes** | See below. Base64 of the JSON is accepted |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | one key | a different key | — | **yes** | `openssl rand -base64 32`. Must be set at **build and runtime**, identical across instances and builds, or Server Actions fail with "Failed to find Server Action" after a deploy or across instances |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | later | test keys | — | secret ones yes | Not wired yet; blocked on the billing-provider decision |
| `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN` | when added | when added | — | token yes | Phase 0 item |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | when push is added | when added | — | no | Web push |

**Must never be set in Production or Preview:** `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST`, `NEXT_PUBLIC_USE_FIREBASE_EMULATORS`.

**The Admin SDK credential.** The server needs a credential to act as the backend, because the browser has none. Vercel does not provide Google Application Default Credentials. Two options:

1. **Now (simple):** a dedicated service account (roles: Cloud Datastore User, Storage Object Admin on the app bucket, Firebase Authentication Admin, and permission to sign URLs) with its JSON stored as a **sensitive** environment variable. One account per Firebase project. Rotate on a schedule and whenever a team member leaves.
2. **Better (later):** Vercel's OIDC token with **Google Workload Identity Federation**, so no long-lived key exists **[verify current Vercel/GCP setup]**. Worth doing before real customer data.

The service account has full backend power. It is **server-only** (`import "server-only"` in `src/lib/firebase/admin.ts`), and the bundle scan in `tests/qa/bundle-scan.mjs` fails the build gate if it ever reaches the browser.

## 6. Project settings and routing

**Project settings (dashboard):**

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Root directory | `.` (repository root) |
| Install command | `npm ci` |
| Build command | `next build` |
| Output directory | default |
| Node.js version | 22.x |
| Production branch | `main` |
| Function region | `iad1`, or the region matching Firestore |
| Skew Protection | **On** (people keep tabs open across deploys; Server Action ids change per build) **[verify availability on your plan]** |
| Preview deployment protection | Vercel Authentication |
| Git integration | `anjuneedham/buildflow`; ignore builds that only change `*.md` and `docs/` using the "Ignored Build Step" |

**`vercel.json`:** not required today. Add one only for:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["iad1"]
}
```

(once the Firestore region is chosen), and `crons` later for scheduled jobs. Redirects, headers (nosniff, referrer policy, HSTS, frame options, permissions policy), `poweredByHeader: false` and the request-body setting live in `next.config.ts`, which is portable and tested. Do not duplicate them in `vercel.json`.

**Routing facts:**

- `src/proxy.ts` (Next 16's replacement for middleware) redirects signed-out visitors from `/app`, `/onboarding`, `/admin`, `/saved`, `/account` to `/login?next=…`. It runs on every non-static request; keep it light (it only checks that the cookie exists).
- Static marketing pages, the sitemap and robots are served from the CDN. Dynamic routes become Vercel Functions.
- **Domains:** apex plus `www` redirecting to the apex (Vercel domain settings). Put the web app on the **same origin** (`/app`). If you later want `app.<domain>`, use a host-based rewrite and set the cookie domain; no new project.
- `public/` assets and `app/manifest.ts` need no configuration.

## 7. Things that behave differently on Vercel than in this sandbox

| Topic | What changes | Action |
|---|---|---|
| **Request body limit** | Functions accept about **4.5 MB** per request **[verify]**. Photo uploads go through a Server Action today (allowed up to 50 MB locally). One 12 MP phone photo often exceeds 4.5 MB | **Blocker.** Move to direct-to-Storage uploads (`WEB_APP_ARCHITECTURE_V2.md` §6) before launch |
| **In-memory state** | The rate limiter and the 5-minute revocation cache live in each function instance's memory. Instances are many and short-lived | Acceptable at launch for the revocation window (documented). Move rate limits to Upstash Redis (Vercel Marketplace) or Firestore counters before any public campaign (`QA_REPORT_V2.md` O5) |
| **Client IP** | Behind Vercel the first `X-Forwarded-For` entry is the client **[verify]**. Rate limiting reads it | Keep reading the platform's header; do not trust arbitrary client-supplied headers elsewhere |
| **Function duration and memory** | Defaults apply; `sharp` image processing and bulk deletes are the heaviest paths | `maxDuration` on the upload-finalize route and `deleteProject` if needed |
| **Cold starts** | Admin SDK initialisation on first request | Fluid compute / keep pages static where possible (ISR plan) |
| **Caching of dynamic pages** | Profile, post and Explore are dynamic today and run a function plus Firestore reads per view | ISR with tag revalidation (`WEB_APP_ARCHITECTURE_V2.md` §3.2). This is the main cost lever |
| **`sharp`** | Prebuilt for Vercel's Linux runtime and already listed in `serverExternalPackages` | None |
| **Scheduled work** | Vercel Cron can call a route; Firestore-event work (notifications, fan-out) belongs in Cloud Functions | Use each for what it is good at |

## 8. CI/CD with GitHub

1. **GitHub Actions** (every pull request): `npm ci` → lint → typecheck → unit → start emulators → rules tests → build → start app → integration, e2e and QA suites (`npm run test:e2e`, `npm run test:qa`) → axe. Required checks on `main`.
2. **Vercel** builds and deploys previews on every push and production from `main`. Vercel's build does not run the test suite; GitHub Actions is the gate.
3. **Firebase deploy job** on merge to `main` (and to `staging`): deploys rules and indexes with a CI-only service account (or Workload Identity Federation from GitHub), **before** the production app goes live. Never deploy rules from a laptop.
4. **Rollback:** Vercel Instant Rollback for the app. Schema and rules changes follow expand-then-contract so the previous app version still works against the new database.

## 9. First-deploy checklist (for when you approve)

- [ ] Name and domain confirmed
- [ ] Production Firebase project created (staging is `build-6fa95`), Blaze plan, Firestore region chosen, budget alerts set
- [ ] Auth providers, Action URL and authorized domains configured; API key restricted
- [ ] Service accounts created (app, CI)
- [ ] Direct-to-Storage upload shipped and tested against the real bucket; Storage CORS set
- [ ] Rules and indexes deployed to staging; the app run against staging; indexes confirmed by real queries
- [ ] Vercel project created from the GitHub repository; variables set per §5; Skew Protection and preview protection on
- [ ] Staging deploy: run `npm run test:e2e` and `npm run test:qa` against the staging URL
- [ ] `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` set at build and runtime
- [ ] Sentry connected; uptime check on `/api/health`
- [ ] Merge to `main`; production deploy; smoke test the 9-step journey
- [ ] Demo seed script refuses to run against production (already enforced)

## 10. Cost and limits to watch

Vercel: function invocations and active CPU on dynamic pages (the reason for ISR), bandwidth on photos (the reason for smaller variants). Firebase: Firestore reads per page view (`QA_REPORT_V2.md` §5), Storage egress. Set budget alerts on both before launch.
