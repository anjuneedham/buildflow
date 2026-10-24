# BuildFlow — Firebase Final Audit (V2)

Date: 2026-10-24 · Branch `claude/buildflow-v1` · Commit audited: `753272e` (no app code has changed since then)

## 0. Scope and an important limit

The brief said to use the connected official Firebase MCP. **That MCP is not available in this session.** A tool search for `firebase` and `firestore` finds nothing. Following the instructions, I did not reinstall or reconnect it.

The other ways in were checked and failed:
- the local Firebase CLI says "Failed to authenticate";
- `gcloud` has no credentialed accounts.

**So nothing in the live project `build-6fa95` could be inspected.** Every result below comes from the repository plus the Firebase emulators (project `demo-buildflow`). Any item marked *unverified (live)* must be checked once access to the live project exists. Nothing was deployed, and no production data was touched.

## 1. Project identity

| Item | Repo value | Status |
|---|---|---|
| Default / staging project | `build-6fa95` (`.firebaserc`) | Partial: name, region and plan unverified (live) |
| Production project alias | `buildflow-prod` | Partial: may not exist. Decide whether production is `build-6fa95` or a separate project |
| Emulator project | `demo-buildflow` | Complete |
| Firestore region | not recorded anywhere in the repo | Missing: the user says it is chosen; it needs recording |

## 2. Area-by-area

| Area | Status | Evidence / notes |
|---|---|---|
| Web app config | Complete (code) / unverified (live) | `NEXT_PUBLIC_FIREBASE_{API_KEY,AUTH_DOMAIN,PROJECT_ID,STORAGE_BUCKET,APP_ID}`. `.env.local` points at the emulator; the Vercel values must be the `build-6fa95` web app's values |
| Android app config | Not required (currently) | The Capacitor shell (`com.buildflow.app`) loads the hosted web app, so it needs no `google-services.json`. Auth runs in the WebView through the web SDK |
| Auth | Complete (emulator) | email/password: signup, login, logout, reset, verification, persistence (session cookie `__session`, revocation on logout), deletion. QA: auth 32/32, account deletion 6/6. Unverified (live): Email/Password provider enabled, authorised domains include the Vercel domain, email templates |
| Firestore data model | Complete | 11 top-level collections, 11 business subcollections, 4 user subcollections. Each one has a server reader and writer (§3) |
| Firestore rules | Complete, secure | deny-all to clients. All access goes through the Admin SDK after `src/server/policy.ts` checks. Rules tests 3/3 |
| Firestore indexes | Complete (repo) / unverified (live) | `firestore.indexes.json` covers every composite query, including the `reviews.reviewer_uid` collection-group override and the `stats` group. They must be deployed before production traffic |
| Storage | Complete (emulator) | deny-all rules. Server-side uploads are validated by magic bytes and re-encoded; private `project-files/` are served only after a membership check; deletion goes by prefix. Upload QA 20/20 |
| Cloud Functions | Not required | none in the repo; all logic runs in Next.js server actions |
| App Check | Not required (now) | clients cannot reach Firestore or Storage at all, so App Check would protect only Auth endpoints. Optional later |
| FCM | Not present → not added | there are no push features; per the brief, nothing was added |
| Analytics | Missing | no SDK. Event plan in `FIREBASE_ANALYTICS_EVENTS_V2.md`. Needs a product decision (see §6) |
| Crashlytics | Not applicable | the Android app has no native Firebase SDK, so web errors surface in Vercel runtime logs. Adding Crashlytics would need `google-services.json` and native code with little to report |

## 3. Collections (implemented = needed)

- **Top-level:** `users`, `businesses`, `posts`, `slugs`, `subscriptions`, `plans`, `services`, `locations`, `reports`, `invitations`, `review_requests`.
- **Under `businesses/{id}`:** `customers`, `leads`, `projects`, `tasks`, `activity`, `media`, `reviews`, `quote_requests`, `stats`, `members`, `private`.
- **Under `users/{uid}`:** `saves`, `following`, `notifications`, `quote_requests`.
- **Not built:** messages or conversations. This waits on a product decision: whether to use a client link per job or in-app chat.

Reads, writes, queries and indexes run against the emulator in these suites: integration 9/9, CRUD 22/22, e2e (5 suites), action fuzz 157, HTTP 137, params 455.

## 4. Security testing (emulator)

| Attack | Result |
|---|---|
| Unauthenticated client reads/writes (Firestore & Storage SDK) | Denied (rules tests) |
| Unauthenticated server actions / app pages | Redirect / `ok:false` (HTTP + fuzz QA) |
| Cross-user (user A reads B's saves/notifications) | Denied: ids come from the session, never from input |
| Cross-business (member of X reads/edits Y's lead, job, file) | Denied: `policy.ts` business scoping; params QA 455 |
| Role escalation (member → owner, self-set admin) | Denied: roles are only in custom claims and server docs; claims are synced server-side |
| Client manipulation (forged hidden fields, ids, prices, plan) | Denied: action fuzz 157, server recomputes |
| Private file URL guessing | Denied: no public URLs for `project-files/`; served via membership check |

**No critical or high issues were found, so no rules were changed.** The rules were not weakened.

## 5. Web / Vercel, Android, secrets

- **Web:**
  - The client SDK is used for Auth only.
  - `firebase-admin` is imported only from `src/lib/firebase/admin.ts`, which is marked `server-only`.
  - The bundle scan finds no Admin credentials or private keys in the client chunks.
  - The production build passes locally (it needs the emulator, or real credentials, at build time).
- **Android:**
  - `assembleDebug` and a signed `bundleRelease` both build.
  - Package ID: `com.buildflow.app`.
- **Secrets:**
  - `.env.local` is gitignored, and only `.env.example` is tracked.
  - No service-account JSON, keystore or `google-services.json` is in git.
  - `FIREBASE_SERVICE_ACCOUNT_KEY` is server-only.

## 6. Decisions needed (not guessed)

1. **Analytics**: should Firebase or GA4 Analytics be added? Before that:
   - a measurement ID from the live project is needed;
   - a consent banner is needed for EU/UK users;
   - the privacy policy needs updating.

   The recommendation is server-side event logging first; see the events doc.
2. **Production project**: decide whether production stays on `build-6fa95` or uses a separate `buildflow-prod`.
3. **Firestore region**: record it.
4. **Messages**: confirm that jobs use a client link instead of in-app chat.
