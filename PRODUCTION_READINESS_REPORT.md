# BuildFlow V2: Production Readiness Report (Google Play closed testing gate)

## Verdict: **NOT READY**

The software is in good shape. The release is not ready, because several things that must be true before testers install it have never been true yet, and I could not make them true from here:

1. **The app is not hosted anywhere.** Nothing has been deployed. The Android app is a shell that loads the hosted web app, so today there is nothing for a tester's phone to load.
2. **Nothing has ever run against real Firebase.** Every test ran against the emulators. The security rules, the database indexes, Storage, real email delivery, the service-account credential and the Firestore region are all unexercised on the real project (`build-6fa95`).
3. **The Android app has never run on a phone.** It builds (a debug APK and a signed release bundle), but no device or emulator was available, and several WebView behaviours that testers will hit are unverified (§5).
4. **The public Privacy Policy and Terms are not finished.** They contain placeholder text and a "has not been reviewed by a lawyer" banner. I added guards so production cannot start with them, but the real company details and legal review are yours to supply.
5. **Google Play Console prerequisites are outstanding** (upload key, Data safety form, content rating, reviewer account, tester recruitment).

Everything I could fix in the code, I fixed and tested (§3). Items 1 to 5 are a short, concrete list in §7. When they are done, the evidence in this report says the code is ready to be tested by real people; it does not say the product is ready for production traffic.

## 1. What I ran

| Check | Result |
|---|---|
| Production build (`next build`) | passes (28 pages) |
| Typecheck, lint | clean (lint: warnings only) |
| Unit tests | **32 / 32** |
| Firestore rules tests | **3 / 3** |
| Integration (tenant isolation over HTTP) | **9 / 9** |
| End-to-end: roles, journey, workflow, discovery | **14, 22, 15, 15 checks pass**, no browser errors |
| End-to-end audit (axe WCAG 2.1 A/AA, overflow, broken requests) over 33 public and app pages (axe on phone; overflow and broken requests on phone, tablet and desktop) | no violations, no overflow, no broken requests |
| Direct authorization attacks on server actions | **157 / 157** |
| HTTP probes (forged cookies, hostile ids, headers, caching, PII) | **137 / 137** |
| Hostile query strings | **455 / 455** |
| Concurrency (double taps, races) | 11 / 12 (one LOW item, open) |
| Browser auth, onboarding, sessions | **32 / 32** |
| CRUD, hostile text, deletes | **22 / 22** |
| Account deletion (new) | **6 / 6** |
| Uploads (about 30 hostile files, 4 phone photos) | **20 / 20** |
| Offline, aborted, slow network | **11 / 11** |
| Layouts: 7 phone and tablet sizes × 24 pages | **168 / 168** |
| Page weight on a slow connection | **7 / 10** (three misses are the photo-weight finding H4) |
| Browser bundle secret scan | pass |
| Dependency audit | 13 advisories, none reachable (§6) |
| Android: `assembleDebug` and `bundleRelease` | build; release bundle signs and verifies with a test key |

All of this is emulator and local-server evidence. The limits are in §8.

## 2. Findings by area

Status: **OK** = tested and fine; **Fixed** = found and fixed in this pass; **Open** = needs action; **Unverified** = cannot be tested from here.

| Area | Status | Evidence and issues |
|---|---|---|
| **Code** | OK | Typecheck, lint, 32 unit tests, build. Business logic lives only on the server; the Android shell has none |
| **Database** | Partly unverified | All 40 queries read for limits and indexes; one missing composite index and one collection-group override were added. Indexes are **unverified on real Firestore** (the emulator does not enforce them). Region chosen but not recorded in the repo |
| **Security** | OK, with open hardening | No critical issues in two audits (157 action attacks, 137 probes). Open: no Content-Security-Policy, in-memory rate limits (§6) |
| **Authentication** | OK | Signup, login, logout, reset, expiry, revocation, interrupted signup all tested (32 checks). Email delivery is **unverified** (emulator codes only) |
| **Authorization** | OK | Roles (owner, admin, crew, customer, platform admin) tested by direct action calls; tenant isolation by 9 integration tests |
| **Firebase / Firestore** | Unverified | Rules deny every client; rules tests pass. Nothing deployed to a real project |
| **Storage** | OK in emulator, unverified for real | Real-byte validation, re-encoding, EXIF removal, private files, signed behaviour untested against the real bucket |
| **Performance** | Open (H4) | Pages without photos are about 200 KB. With photos, Explore is 1.2 MB and takes 25.6 s on an emulated slow connection |
| **UX** | Fixed and open | First-run forms no longer wipe input (H1). An empty directory now explains itself (§3). Open: no push or email notifications (H2) |
| **UI / responsiveness** | OK | 168 layout checks (320 px to tablet landscape), no sideways scroll, nothing hidden under the bottom bar |
| **Accessibility** | OK | axe WCAG 2.1 A/AA clean on 33 pages; errors announced; tap targets raised. Not tested with a screen reader |
| **Error handling** | OK | Offline, aborted, slow, expired session, oversize files all tested; inline errors keep what was typed |
| **Analytics** | OK (by omission) | No third-party analytics. First-party counters only. Nothing to disclose beyond the Data safety table (§5) |
| **Notifications** | **Open (H2)** | In-app inbox only. No email, no push |
| **Website** | OK | Marketing pages static; FAQ and Support added; sitemap and robots fixed |
| **Legal pages** | **Open (C4)** | Placeholders and a draft banner; production now refuses to start with them |
| **App configuration** | Fixed | Production now refuses to start without a real support email and legal details; `.env.example` updated |
| **Android build** | Built, **unverified on device (C1)** | Shell added in `mobile/` |
| **Google Play requirements** | Partly met (§5) | Account deletion built; the rest are Console tasks |

## 3. Critical and high findings

### CRITICAL

| ID | Finding | Status |
|---|---|---|
| **C1** | **There was no Android app at all** (no project, no build). | **Built, not device-tested.** `mobile/` is a Capacitor 8 shell loading the hosted web app: package `com.buildflow.app`, target SDK 36, min SDK 24, `INTERNET` the only permission, backups and cleartext traffic off, launcher icon and splash from the BuildFlow mark, offline page, signing from an untracked `keystore.properties`. `assembleDebug` and `bundleRelease` succeed; the bundle signs and verifies with a throwaway key. Still needed: a real address (`CAP_SERVER_URL`), the real upload key, and a run on a phone. **Open until a device test passes.** |
| **C2** | **No account deletion**, which Google Play requires both in the app and at a public URL, and the privacy policy promised it. | **Fixed and tested** (6/6). Account → Delete my account (type DELETE, recent sign-in required). A customer's data, a crew member's membership, or an owner's whole business, files, posts and subscription record are erased; reviews a customer wrote are kept anonymised; platform admins are blocked; other businesses are untouched. Public page `/delete-account`. Other team members are released, not deleted. |
| **C3** | **Not hosted, and never run against real Firebase.** No deployment, no real rules, indexes, Storage, email or credentials exercised. | **Open.** Cannot be done without your approval and credentials. Blocks READY. |
| **C4** | **The public Privacy Policy and Terms showed "[Registered business address, to be confirmed]", "[Jurisdiction, to be confirmed]" and a "not reviewed by a lawyer" banner; the support email defaulted to an `.example` address.** | **Guarded, content open.** Legal details are now environment variables. Production **refuses to start** without a real support email, company name, address, governing law and `NEXT_PUBLIC_LEGAL_REVIEWED=true` (unit-tested). The banner disappears only when that flag is set. I cannot invent the entity or the legal review. **Blocks READY.** |
| **C5** | **Photo uploads would fail on Vercel**: a phone photo is 3 to 6 MB and Vercel Functions accept about 4.5 MB per request (**[verify against Vercel's current limit]**). | **Fixed and tested.** Photos are shrunk in the browser before sending (also strips location, and is much faster on weak networks): four 12 MP photos, about 20 MB, send as one 3.1 MB request. A 12 MB photo is accepted; a 26 MB photo and PDFs over 4 MB are refused with a clear message. PDFs over 4 MB are therefore **not supported for now**. |

### HIGH

| ID | Finding | Status |
|---|---|---|
| **H1** | **Contractor onboarding forms (their first experience) wiped what they typed on any error and had no failure handling.** The earlier fix had missed them. | **Fixed.** All onboarding forms use the shared hook; no bare form handling remains in the app. |
| **H2** | **No push or email notifications.** A contractor who is not looking at the app never learns of a new lead; this is the most likely reason a contractor stops using it. | **Deferred.** Needs an email provider and Firebase Cloud Messaging configured on your Firebase project and in the Android app. Not practical to do safely without credentials. **Do before testers, or tell testers to check the Inbox.** |
| **H3** | **A customer tester opening an empty marketplace sees nothing.** | **Partly fixed.** A new directory now says "Contractors are just joining BuildFlow" and invites contractors, instead of "broaden your search". The real fix is content: get 5 to 10 real contractors with real work posted before customer testers arrive. |
| **H4** | **Photos are served at full size.** Explore is 1.2 MB and 25.6 s on an emulated 400 kbps connection; a profile 18.6 s. | **Deferred** (needs thumbnail variants or an image optimizer). Uploads are now smaller, but display size is unchanged. |
| **H5** | **No way to pay and no trial end.** The 14-day trial never expires; Google Play Billing is not integrated (your decision: Play Billing for now). | **Deferred, by decision.** Fine for closed testing. Copy says payments are coming. Before production: Play Billing, trial enforcement. |
| **H6** | **"Verified customer" and "Verified job" labels prove less than they claim** (a contractor can finish a job and review it themselves). | **Deferred, needs your decision** (`QA_REPORT_V2.md` O1). FAQ wording was kept accurate. A deceptive trust claim is a Play and reputational risk once real customers rely on it. |
| **H7** | **Android WebView behaviours are unverified:** opening a PDF or private file (WebViews often cannot display or download them), the camera and gallery picker, edge-to-edge layout on Android 15+, the back button, WhatsApp and phone links. | **Open.** Cannot be tested without a device. |
| **H8** | **Web-wrapper policy risk.** Google can reject apps that are only a website in a frame. | **Open risk.** This app has accounts, workflows and uploads, which helps; adding push notifications and share would strengthen it. |
| **H9** | **No crash or error reporting** beyond server logs. | **Deferred** (Sentry planned). Play Console's Android vitals will show native crashes. |
| **H10** | **Production dependencies have 13 advisories (5 high).** | **Deferred with evidence, none reachable (§6).** |

## 4. Why testers, contractors and customers might walk away

**Testers will hit problems if:**
- The app opens to a blank or error screen (not hosted, wrong `CAP_SERVER_URL`, or Firebase not configured). C1, C3.
- They cannot get in: verification and reset emails land in spam or the Action URL is unset. Unverified (C3).
- The marketplace is empty (H3).
- A PDF will not open, or the photo picker misbehaves in the WebView (H7).
- Google's reviewers have no login. You must supply a working test account with sample data (§5).

**Contractors will abandon it if:**
- New leads do not notify them (H2). *Highest risk.*
- Their first photo upload fails (fixed, C5) or is slow.
- They hit a dead end in setup (fixed, H1).
- They expect to pay or be reminded about a trial and find nothing (H5).
- Their profile shows no reviews and they cannot ask for one without a completed job. By design; coach testers.

**Customers will not trust it if:**
- They read "Product draft" or a bracketed placeholder in the Privacy Policy (C4).
- Verified labels turn out to mean less than they say (H6).
- Pages are slow on mobile data (H4).
- The directory looks empty (H3).

## 5. Google Play requirements

| Requirement | Status |
|---|---|
| Signed Android App Bundle | Built. **You must create the upload key**; I verified signing only with a throwaway key |
| Target API level | 36 (Capacitor 8) |
| 64-bit | Yes (default) |
| Permissions | `INTERNET` only. Camera and gallery go through the system picker |
| Privacy policy URL | `/privacy` exists; **must be final and reviewed (C4)** |
| **Account deletion** in app and at a URL | Done (`/account`, `/delete-account`) |
| User-generated content: report and moderation | Report button on posts, reviews, businesses; admin queue exists. No user blocking (no messaging between users) |
| Data safety form | Not filled in (Console task). Inventory below |
| Content rating questionnaire | Console task (user content: yes) |
| Target audience | 18+ (Terms minimum age is 18) |
| Reviewer test account | **You must create one** with sample data and put the credentials in the Console. Demo seed data runs only in emulators |
| Closed-test requirements | A new personal developer account must run a closed test with about 12 testers for 14 days before production access **[verify current Play policy]** |
| Store listing | Icon, feature graphic, screenshots, short and full description: not created |
| Application id | `com.buildflow.app` is permanent once published. **Confirm it** |

**Data safety inventory (draft, for you to check):** collected: name, email, phone number, photos, user-generated content (posts, reviews), customer details a contractor enters, app interactions (first-party counters), approximate location as typed text (not device location). Not collected: device location, contacts, advertising id, financial data (payments not live). Shared with service providers acting for us: Google Firebase, Vercel. Encrypted in transit: yes. Deletion: yes, in the app and at `/delete-account`. No data sold; no advertising.

## 6. Deferred on purpose (with reasons)

| Item | Reason |
|---|---|
| Push and email notifications (H2) | Needs provider accounts and Firebase credentials |
| Play Billing, trial enforcement (H5) | Decision made: later; closed testing needs no payments |
| Image variants for slow networks (H4) | Meaningful change to storage and every image consumer; best done with the Vercel work |
| "Verified" wording (H6) | Product decision; touches tests and copy |
| Sentry (H9) | Needs an account and DSN |
| Content-Security-Policy | Defence in depth; no XSS found. Needs a nonce setup |
| Shared rate limiting, per-instance in memory | Acceptable for a small closed test; add Redis before a public campaign |
| Direct-to-Storage uploads | Browser shrinking removes the blocker; PDFs over 4 MB remain unsupported |
| Dependency upgrades (H10) | `zod` advisory is about oversized arrays and sets; the app's schemas contain none. `firebase-admin` and gRPC advisories are in server-side client code with no exposed server or buffer-passing path. `firebase` (client) is used only for sign-in; the vulnerable Firestore client is not in the browser bundle. Upgrading `zod` to v4 is a breaking change; `firebase-admin` 14 needs a test pass. Do both before production |
| Soft 404s | Missing profiles return HTTP 200 with a "not found" page marked `noindex`, because the page streams. Search engines are told not to index them |
| Build needs a live Firestore | Static pages (pricing, search, FAQ) read reference data at build time; Vercel's build needs the Firebase credential and seeded reference data (`npm run seed -- --reference`) |

## 7. What stands between this and READY

In order:

1. **Choose and enter the real legal details** (company name, address, governing law); get counsel to review the Privacy Policy, Terms and Refund policy; set `NEXT_PUBLIC_LEGAL_REVIEWED=true` and a real `NEXT_PUBLIC_SUPPORT_EMAIL`. *(you)*
2. **Deploy to staging** on the Firebase project you named plus Vercel: deploy rules and indexes, set the environment (`VERCEL_DEPLOYMENT_V2.md`), seed reference data, and run `npm run test:e2e` and `npm run test:qa` against the staging address. This is the step that turns "unverified" into evidence. *(needs your approval and credentials)*
3. **Test the Android app on at least two real phones** against staging: sign-in, photo from camera and gallery, opening a PDF, WhatsApp and phone links, back button, offline page, Android 15 layout. Fix what breaks.
4. **Decide notifications:** at minimum email for new leads, ideally push in the Android app. Or accept the risk and tell testers.
5. **Seed real content:** 5 to 10 real contractors with real posts before customer testers join.
6. **Play Console:** upload key, Data safety, content rating, store listing, reviewer account, tester list, confirm the application id.
7. Re-run this audit against staging and update this report.

## 8. Limits of this audit

- **Emulators and a local server only.** No real Firebase, no real email, no real Storage, no Vercel, no network between a real phone and a real server.
- **No Android device or emulator.** The Android shell was built, not run.
- Chromium device profiles stand in for phones and tablets. No Safari, Firefox, screen reader, or real keyboard.
- Vercel's request limit, Google Play's current tester policy and Firebase's current plan requirements are from my knowledge, not checked live. They are marked **[verify]**.
- One server instance; no load test. Behaviour with thousands of records and many simultaneous users is unmeasured.
- Legal text was read for placeholders and accuracy against the app's behaviour. It was not legally reviewed, and I am not a substitute for counsel.

## 9. Changes made in this pass

Account deletion (action, screen, public page, tests); `/faq` and `/support`; environment-driven legal details with production guards; browser-side photo shrinking; onboarding forms on the shared form handling; empty-directory state; footer, sitemap and robots updates; the Android shell in `mobile/` with icons, signing and a README; new QA suite `tests/qa/account-deletion.mjs`; unit tests for the production guards and sign-in recency. Earlier QA fixes are in `QA_REPORT_V2.md`.

**Verdict: NOT READY.** Reasons 1 to 5 at the top. The code is ready for the staging step.
