# BuildFlow V2: Cross-Platform Integration Test Report

Run on 25 October 2026 against the **live** system: `https://buildflow-app-beta.vercel.app` (Vercel, commit `c87dc33`) and the real Firebase project `build-6fa95`. Every test account was created on the live site and removed through the app's own account deletion; the database was checked back to its starting counts after every run.

## Verdict: **NOT READY**, with one owner-side blocker

The core product works across clients, the security model held under every attack tried, and two release blockers found during this cycle are fixed and verified on the live site. One P0 remains: **Firebase Storage is not set up**, so every photo and file upload fails, including posts, the portfolio and the "Verified job" showcase. Publishing work is half of the product loop, so testers cannot use it. Fixing it is an account step (add a card to Firebase, Blaze plan, Storage → Get started), not a code change. After it is done and uploads are re-tested, the status moves to **READY WITH WARNINGS**.

## How "Android" was tested

The Android app is a Capacitor shell that loads the same Vercel address (`mobile/`, confirmed in the signed bundle). There is no separate Android code path. "Android" in this report is a Pixel 7 browser profile with the Android WebView user agent; "Web" is desktop Chrome. Both ran against the same live backend, with the same accounts, in parallel sessions. A run of the real Android app on the owner's tablet happened earlier ("app works well"); a repeat on a real device with the current build is still recommended (section 9).

## 1. System alignment

| Check | Result |
|---|---|
| Vercel production and preview env | `NEXT_PUBLIC_FIREBASE_PROJECT_ID=build-6fa95`, `APP_ENV=staging`, site URL matches the public address, **no emulator variables** |
| Android release bundle | loads `https://buildflow-app-beta.vercel.app` (HTTPS only, debugging off) |
| `.firebaserc` | `default` and `staging` → `build-6fa95`; production `buildflow-prod` not created yet |
| Schema | One schema, one user model: both clients are the same web app; tenant data under `businesses/{id}/…`, user data under `users/{id}/…` |
| Rules and indexes | Deny-all client rules and 29 composite indexes deployed earlier; rule tests 3/3 |
| Reference data | Was **missing** (see P0-1); now seeded: 14 trades, Jamaica + 14 parishes, Basic plan |
| Storage | **Not provisioned** (P0-3) |
| Push notifications (FCM) | Not configured anywhere, so no conflicts; also no push (P1-1) |

## 2–5. Cross-platform flows

| # | Flow | Result |
|---|---|---|
| 2 | Android: sign up, business, services, profile | PASS |
| 2 | Android: logo upload, create a post | **BLOCKED** by Storage. User sees "Upload failed. Please try again."; the step can be skipped |
| 2 | Android: lead, customer, project, task, project update | PASS |
| 2 | Web, same account: business, profile, services, lead, customer, project, task, update all present | PASS |
| 2 | Web: add task, move lead to Contacted, add note → Android shows all three | PASS |
| 3 | Web customer: sign up, find contractor by "masons in st andrew", profile shows services | PASS |
| 3 | Portfolio and posts | **BLOCKED** (no posts can exist without Storage) |
| 3 | Web customer sends a quote request → Android customer sees it under "My quote requests" | PASS |
| 3 | Conversation, contractor reply visible to customer | **Not built** (P2-1) |
| 4 | Lead loop: request → lead (Android) → linked customer → project → task → update | PASS; Firestore shows lead `won`, linked to customer and project |
| 4 | In-app Inbox notice for the request; notification record stored (`users/{id}/notifications`) | PASS |
| 5 | Android: tick task, set On hold → Web shows "1 of 2 done", On hold | PASS |
| 5 | Web: complete job (dialog offers to close open tasks) → Android shows Completed, task done | PASS |
| 5 | Site photos and documents on a job | **BLOCKED** by Storage |

## 6. Messaging

Not implemented. There is no conversation or chat feature in the code. The customer contacts the contractor by quote request, phone or WhatsApp; the contractor's notes are private. Whether to add in-app chat is an open product decision (P2-1).

## 7. Media

Blocked by Storage. Verified so far: failures are reported, not silent; forms stay usable; and the private media route returns 404 to outsiders. Re-test ownership, loading, duplicates and deletion once Storage is on.

## 8. Security (all PASS)

| Attack | Result |
|---|---|
| Rival contractor opens contractor A's lead, customer and job URLs (incl. internal notes) | No data shown |
| Customer opens contractor workspace or lead URL | Redirected, no data |
| Unauthenticated Firestore REST: read business, list leads, set subscription `active` | 403 on all |
| Signed-in user with a real Firebase ID token: read another business's private config, set own subscription `active`/plan, make self `admin` | 403 on all |
| Signed-out access to `/app`, `/admin`, `/account`, `/onboarding` | 307 to login |
| Forged or unsigned session cookies | Rejected |
| Secrets in the 12 browser scripts (private key, service account) | None |
| Hostile query string, malformed path | Escaped; 400 with no internals |

## 9. Offline and network

- Submitting a form with the network off shows a clear message, keeps everything typed, and saves on retry: PASS.
- A failed upload is reported inline: PASS.
- The Android shell's offline page (`errorPath: offline.html`) exists in the bundle; launching with no network on a real device is not yet tested.

## 10. Authentication (all PASS)

New account, existing account, wrong password, logout and login, session kept in a new tab, password-reset request, separate sessions per device (logging out on web does not log out Android), the same Firebase account recognised on both clients, in-app account deletion, and a deleted account's live Android session rejected on its next request.

## 11. Notifications

In-app Inbox and stored notification records work. **No push notifications** (P1-1).

## 12. Analytics and error monitoring

- First-party counters work (`businesses/{id}/stats`, shown in Insights). There is no third-party analytics, and none was faked.
- No error monitoring beyond Vercel's function logs (P2-2), so no controlled error was triggered.

## 13. Builds (current commit)

| Check | Result |
|---|---|
| Web production build | Built on Vercel (READY) |
| Android signed release bundle | Built, 3.0 MB, points at the live address |
| Typecheck | Clean |
| Lint | 0 errors, 54 warnings |
| Unit tests | 32 / 32 |
| Firestore rule tests | 3 / 3 |
| Dev-only configuration in builds | None found (no emulator vars, no localhost, no debug flags) |

## 14. Performance

Public pages: 0.19–0.47 s, 4–11 KB compressed. No duplicate listeners: the browser holds no Firestore connection; all reads are server-side and limited. Two items, neither high-impact today: photos are served full size (P2-3, matters once Storage is on), and directory search reads up to 500 businesses per query (P3-1).

## 15. Findings

### P0: blocks the closed test

**P0-1. New contractors stuck at onboarding step 3. FIXED.**
- Where: `/onboarding?step=3`, web and Android.
- Reproduce: sign up as a contractor, enter business details, continue: the services list is empty and the step cannot be completed. Reported by the owner.
- Root cause: the live Firestore had no reference data (`services`, `locations`, `plans`); the deploy steps never included seeding it.
- Fix: ran `npm run seed -- --reference` on `build-6fa95` (additive, re-runnable). Added the step to `FIREBASE_PRODUCTION_CHECKLIST_V2.md` for the production project.
- Verified: live onboarding shows 28 options and saves (3 full live runs); the pricing page shows the plan; the owner's two stuck accounts can continue.

**P0-2. Half-built businesses were public. FIXED.**
- Where: Explore directory and `/contractor/{slug}`.
- Reproduce: sign up, stop after step 2: the business appears in the directory with an empty profile (a test business "Fjfnrmr" was listed live).
- Root cause: businesses were created with `is_public: true`.
- Fix (`c87dc33`): create hidden; publish the first time setup is finished, without overriding a later "private" choice. Hid the two existing unfinished businesses. Updated the QA check that assumed the old behaviour.
- Verified live: unfinished profile hidden and absent from the directory; public after finishing; search then finds it.

**P0-3. Firebase Storage not set up: all uploads fail. OPEN (owner action).**
- Where: onboarding logo and cover, posts, portfolio, job photos and files.
- Reproduce: upload any photo: "Upload failed. Please try again."
- Root cause: Storage needs the Blaze plan, which has not been enabled.
- Fix: add a card (Blaze), set a budget alert, Storage → Get started (accept the default location), then deploy `storage.rules`. Reminder set for 31 October.
- Verification: pending; re-run the upload, post, portfolio and media checks.

### P1: should fix before the closed test

**P1-1. No push notifications. OPEN.**
- Where: Android.
- Problem: a contractor who is not looking at the app never hears about a new lead. This is the main reason a tester would stop using it, and it also strengthens the app against Google's minimum-functionality review.
- Root cause: FCM not built.
- Fix: register the Android app in Firebase, add `google-services.json` and `@capacitor/push-notifications`, save device tokens, send on new lead.
- Not fixed in this pass: it needs a Firebase console step from the owner first. Until then, tell testers to check the Inbox.

### P2: can follow the closed test

- **P2-1** No messaging: no conversations, and no way for a contractor's reply to reach the customer in-app. Product decision pending (private client link vs in-app chat).
- **P2-2** No error monitoring (e.g. Sentry); only Vercel logs.
- **P2-3** Photos are served at full size (about 1.2 MB Explore page on slow networks in earlier tests). Add thumbnails once Storage is on.
- **P2-4** No Content-Security-Policy header (other security headers present).
- **P2-5** Vercel Hobby plan is for non-commercial use; move to Pro before charging.
- **P2-6** Real-device run of the current build (photo picker, PDFs, back button, offline launch, Android 15 layout).

### P3: later

- **P3-1** Directory search reads up to 500 businesses per query; add server-side filtering when the directory grows.
- **P3-2** 54 lint warnings.
- **P3-3** Missing pages return HTTP 200 with a "not found" page (marked `noindex`).

## Test-process notes

The first run reported 4 failures that turned out to be mistakes in the test, each confirmed by a targeted re-run:
- the lead had been converted to Won, so it left the default Leads tab
- the data was looked up at the wrong Firestore path
- a screenshot was captured before the page streamed in
- the job-completion dialog's button is labelled differently when tasks are open

None was an app bug.
