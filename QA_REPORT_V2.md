# QA Report V2

Adversarial QA, security and UX pass over BuildFlow (Next.js 16 + Firebase), run against the **production build** with the Firebase emulators. Feature work was stopped for this pass.

## 1. Verdict

| | |
|---|---|
| **CRITICAL** | **0 found.** No way to read or change another business's data, reach the admin area, or act as another user was found (details in §3). |
| **HIGH** | **3 found, 3 fixed.** All three were data-loss problems on the paths customers and contractors use most: forms that wiped what you typed, the public quote/review forms with no failure handling, and photo uploads that failed once they added up to more than 10 MB. |
| **MEDIUM** | 20 found and fixed, 5 open (§6). |
| **LOW / INFO** | 6 fixed, 12 open or by design (§6). |

The numbers come from the final run in §8. Everything marked **Fixed** has a regression check in `tests/qa/` or `tests/workflow-utils.test.ts` that failed or would fail without the fix (where I did not reproduce the failure before fixing it, the entry says so).

Not tested, and worth knowing: real Android hardware (Chromium with a Pixel 7 profile was used), Safari and Firefox, screen readers, real Firebase (indexes and security rules were checked against the emulator and by reading every query), real email delivery, and more than one server instance. See §7.

## 2. What was tested and how

I read every server action, route handler, the policy layer, storage code, the rules files and the 40-odd Firestore queries. Then I attacked the running app in nine ways. Each is a script in `tests/qa/` that can be re-run.

| Area you asked about | How it was tested | Script |
|---|---|---|
| Unauthorized access, permissions, invalid IDs, nonexistent records | Called **the server actions directly over HTTP** (the app has 57; 38 were attacked this way. The other 19 were reviewed by reading and, where they have UI, exercised by the browser scripts: sign-in/out, account update, onboarding steps, quote and review submission, public view/contact tracking, notifications, invite acceptance, reports, customer create, task edit and project file upload. Ids come from the build manifest) as: anonymous, customer, crew, a different business's owner, the owner (control) and admin. Checked the database afterwards, not just the response. Also 137 plain HTTP probes: protected pages, forged and garbage cookies, hostile ids, fake action ids, headers, caching, robots/sitemap, PII on public pages. | `action-fuzz.mjs` (157 checks), `http-probe.mjs` (137) |
| Malformed input, hostile text | 455 hostile query strings (repeated keys, huge, null bytes, `__proto__`, markup) on about two dozen pages. Seven XSS and layout-breaking payloads typed into every text field, then every page that shows them was visited. Impossible dates and ids sent by hand. | `param-fuzz.mjs`, `browser-crud.mjs` |
| Signup, login, logout, recovery, sessions, expiry | Empty and oversize signup, duplicate email, double-click, wrong password vs unknown email, open-redirect `next=` values, full password-reset round trip (reuse of the link and the old password), logout then Back, replaying a copied cookie after logout, cookie deleted mid-form, session revoked on the server, signup interrupted by the network. | `browser-auth.mjs` (32) |
| Onboarding, profile creation | Jumping ahead with `?step=`, double-submitting step 2, refresh and Back, emoji-only and HTML business names, duplicate names. | `browser-auth.mjs` |
| Image uploads, large and missing images | About 30 files: 12 MB, 4 × 12 MP phone photos, 16000×16000 and 20000×20000 decompression bombs, truncated, text renamed .jpg, SVG, GIF, JPEG with HTML appended, EXIF GPS and rotation, CMYK, 1×1, 10×20000, 12 files at once, hostile file names, fake PDF. Broken cover/logo/post URLs. | `browser-uploads.mjs` (18) |
| Posting, editing, deleting, leads, customers, projects, tasks | Validation messages, duplicate phone numbers in four formats, triple-click, delete then reload the URL, delete a customer with jobs, delete a job with 1,200 child records, impossible dates. | `browser-crud.mjs` (22) |
| Race conditions, concurrent actions, duplicate submissions | Same action fired 6–30 times at once: tasks, task toggles, status changes, completion, same-phone leads, Start job, review submit, review link, Save, delete-while-adding, quote burst. | `concurrency.mjs` (12) |
| Slow, failed network, refresh, restart | Offline, connection reset mid-send, 8-second responses with a double tap, refresh while in flight, offline logout, customer quote and review forms offline, first-load weight with and without a slow-3G profile. | `browser-network.mjs` (11), `page-weight.mjs` (10) |
| Android, tablet layouts, back navigation | 7 viewports (Pixel 7, 360×640, 320×568, phone landscape, 768×1024, 1024×768, 800×1280) × 19 pages: sideways scroll, content hidden behind the bottom bar, tap target sizes, tiny text. | `layouts.mjs` (133) |
| Firestore permissions | Rules deny every client read and write (3 rules tests over 30 paths, 4 client types). The browser bundle was scanned for the Admin SDK, the Firestore client, private keys and server secrets. | `tests/rules`, `bundle-scan.mjs` |
| Excessive reads | Read every query for bounds and index coverage (§5). | review |

## 3. What held up

- **Authorization.** 157 direct action calls and the database checked afterwards: nothing changed for any actor who should not be able to change it. Every action re-checks the session, the role and that the record belongs to the caller's own business. A different business's owner can only ever touch their own tenant. Crew cannot reach CRM, billing, analytics, profile editing or unassigned jobs. Customers cannot reach `/app` or `/admin`. Suspended users are refused.
- **Mass assignment.** `is_verified`, `review_count`, `rating_sum` and `owner_id` sent to the profile action are ignored.
- **Sessions.** Forged, truncated, `alg:none` and oversize cookies are all treated as signed out. A server-side revocation stops the next action.
- **Uploads.** Real bytes are checked, not the file name. Images are re-encoded to WebP, so appended scripts, EXIF GPS and metadata do not survive, and EXIF rotation is applied. SVG and GIF are refused. A 16000×16000 PNG processes in 1.7 s with about +100 MB; a 20000×20000 one is refused. Private job photos return 404 to anyone outside the business.
- **XSS.** Seven payloads in every field, anonymous quote requests included: nothing executed anywhere. JSON-LD escapes `<`.
- **Firestore.** Client access is denied everywhere, and the browser bundle contains none of the Admin SDK, Firestore client or private keys (the emulator `.env.local` holds no real secret values, so that part of the scan only becomes meaningful with production env).
- **Review links.** Eight simultaneous submissions on one link give exactly one review and consistent rating totals.
- **Weight.** Public pages are about 200 KB on first load; 4.6–5.2 s on an emulated 400 kbps / 400 ms connection (images were blocked in this sandbox, so real pages with photos will be heavier, see O3).

## 4. Findings fixed

IDs: **H** = HIGH, **M** = MEDIUM, **L** = LOW. "Reproduced" means the failure was seen before the fix. "By inspection" means found by reading the code; the regression check was added and passes after the fix, but I did not run it against the old code.

### HIGH

**H1. A failed submit wiped the whole form.** *Reproduced.* React 19 resets a `<form action>` when the action finishes, whether it worked or not. Typing a name, phone and description and getting one field wrong (a bad amount, a missing name) cleared every field. The hook's own comment promised the opposite. This affected every form in the app: leads, customers, jobs, tasks, profile, posts, team, account, notes.
*Fix:* `useFormAction` remembers what was submitted and puts it back when the action fails (files cannot be restored by a web page, so people re-choose those). It also checks file sizes before sending (H3).
*Checked by:* `browser-crud.mjs` ("empty name … other fields keep their values"), `browser-network.mjs`.

**H2. The public quote request and review forms had no failure handling.** *By inspection; the reset behaviour is the same one reproduced in H1.* Both used a bare `useActionState`: a dropped connection or server error went to the error page and a validation error (for example, forgetting a phone number) cleared the customer's description. This is the customer's path to a lead, on mobile networks.
*Fix:* both forms (and the report form) use the same hook, so errors show inline, an offline message says nothing was lost, and what was typed stays.
*Checked by:* `browser-network.mjs`: offline quote keeps the whole message, a server rejection keeps it, a retry after reconnecting creates exactly one request, an offline review keeps the stars and text.

**H3. Photo uploads over 10 MB in total failed with "Something went wrong".** *Reproduced with a 12 MB file; server log: `Unexpected end of form`.* `proxy.ts` runs on every request and Next buffers the body for it up to 10 MB by default, cutting anything past that off. A 12-megapixel phone photo is 3–6 MB, so three or four photos in one update fail. Nothing explained why.
*Fix:* `experimental.proxyClientMaxBodySize: "50mb"` (matches the Server Action limit), plus a message before sending when one file is over its limit or the total is over 48 MB ("IMG_1.jpg is 12.4 MB. Files must be 10 MB or smaller…").
*Checked by:* `browser-uploads.mjs`: four 12 MP photos (about 20 MB) upload in one update; the 12 MB file is refused with a size message. The four-photo case was added after the fix and not run against the old config.

### MEDIUM (fixed)

| ID | Problem | Fix |
|---|---|---|
| M1 | **Repeated query keys crashed pages** (`/explore?q=a&q=b`, also Leads, Customers, Admin Users): Next passes an array and `.trim()` threw. *Reproduced.* | `firstParams()` on every page that reads `searchParams`. 455 hostile query strings now pass. |
| M2 | **Ids shaped like `__x__` returned 500** (`/contractor/x?post=__proto__`, `/app/jobs/new?leadId=__proto__`, and through actions). Firestore rejects them but our id check allowed them. *Reproduced.* | One shared id rule (`src/lib/ids.ts`) that rejects them; `revokeInvite` and `resolveReport` now validate ids too. |
| M3 | **Signup could leave a half-made account.** A 300-character name created the Firebase account, then failed with "Invalid sign-in request" with no way forward; a network drop would do the same, and a later log in made the person a customer even if they chose contractor. *Long name reproduced; the network-drop path by inspection.* | Name limit enforced in the form; the account is reused on retry ("Your account was created, but we couldn't finish signing you in… tap the button to try again"); the chosen account type is remembered for a later log in. |
| M4 | **Session expired while a form was open:** "Something went wrong, check whether it saved", no hint why. *Reproduced.* | The hook asks `/api/me`; if signed out it says so and that what was typed is still there. |
| M5 | **Double-tapping "Complete job" counted the completion up to 6 times** in analytics and wrote 6 history entries. *Reproduced.* | Done in a transaction. |
| M6 | **Double-tapping a lead status counted the reply twice**, inflating the "usually replies within…" trust figure. *Reproduced (+2).* | Done in a transaction. |
| M7 | **Simultaneous requests from one person created several customers** (8 at once gave 4). *Reproduced.* | Customers made from a phone or email get an id derived from it and are created atomically; the loser reads the winner. |
| M8 | **Two "Start job" taps could create two jobs for one lead.** *By inspection.* | Job id derived from the lead and created atomically. |
| M9 | **Deleting a customer also deleted the notes written on their jobs** (job notes carry the customer id). *By inspection.* | Only notes filed on the customer itself are removed. |
| M10 | **Deleting a big job** tried up to 1,200 deletes in one 500-operation batch. *By inspection.* | Children are deleted in pages, the job last, so a failure part-way can be retried. A job with 600 tasks and 600 history entries deletes cleanly. |
| M11 | **A deleted or foreign record inside `/app` showed the public 404** ("the contractor profile is no longer public") with no navigation: a dead end. *Reproduced.* | `app/app/not-found.tsx` inside the app layout with links to Today, Leads, Jobs. |
| M12 | **"Verified job" was given to any linked job**, including one still being planned. | Only for jobs marked completed. |
| M13 | **Open redirect after login:** `next=/%09/evil.com` passed the same-site check; browsers drop the tab and go to `//evil.com`. *By inspection, unit-tested.* | Control characters and spaces are refused. |
| M14 | **Long unbroken text pushed lists sideways** (a 150-character name, a pasted link). *Reproduced.* | Grid items may shrink and long words wrap. |
| M15 | **Logging out offline looked like success** (*by inspection*); a copied cookie kept working for page reads for up to 5 minutes after logout (*reproduced*). | An error toast when the server can't be reached; logout, suspension and removal from a team now clear the server's cached "checked" time at once. (Other server instances keep the 5-minute window, see O5.) |
| M16 | **Invited crew lost the invite:** "Create an account" sent them to business onboarding. The invite page echoed any `?error=` text, so a crafted link could show a message in our voice. *By inspection.* | Signup carries the invite link through; only known messages are shown. |
| M17 | **30 logins per 15 minutes per IP address** would lock out a whole mobile carrier or office. Passwords are protected by Firebase, so this only guarded token replay. *By inspection.* | 300 per address, 30 per account. |
| M18 | **Form errors on uploads and ratings were not announced** to screen readers (`<p>` without `role="alert"`). *Reproduced (my own test could not see the error).* | Added. |
| M19 | **An admin hiding a reported review acted on a path supplied by the reporter**, which need not match the review named in the report. *By inspection.* | The path must end in the reported review's id. |
| M20 | **In-memory counters were not shared across the app.** The first logout fix did not work, and the test showed why: Next bundles server actions and page renders separately, so a module-level `Map` is a different object in each. A logout (an action) could not evict what the next page read (a render) consulted, and the rate limiter's counters were split the same way, so limits were looser than written. *Reproduced.* | Both stores live on `globalThis`, shared by every route in a server process. |

### LOW (fixed)

- Impossible dates (`2026-13-45`, `2026-02-31`) were accepted when sent by hand.
- Tap targets: the task checkbox was 28 px (hit area now 48 px), header and footer links were 17–20 px tall.
- `X-Powered-By` removed; `Strict-Transport-Security` added.
- Post page had no `<h1>`.
- Firestore: added the collection-group index the admin dashboard's `sum()` needs (could not be verified without real Firestore).
- Error-text announcements (see M18) and `revokeInvite`/`resolveReport` id validation (see M2).

## 5. Reads and indexes

- Every query was checked for a limit and for index coverage: 40 queries, all covered except the admin `sum()` above. The emulator does not enforce indexes, so this was done by reading, and only real Firestore can confirm it.
- Per page view, at the extremes: the owner dashboard reads up to about 1,100 documents (pipeline value alone `select()`s up to 1,000 leads), Customers up to 2,500, Analytics up to 5,000, Leads and Jobs up to 500 each. A typical small contractor is far below these, so I did not change them; they are listed in O4.

## 6. Open items (not fixed)

**MEDIUM**

- **O1. "Verified" is weaker than it sounds.** A contractor can create a job, mark it complete, ask for a review, open the link themselves and post a 5-star "Verified customer" review, or publish a "Verified job". The link model proves the reviewer holds a link the contractor sent, nothing more. Needs a product decision. Options: send the link from the platform to the phone on the original lead, rename the labels ("Completed job", "Customer review"), flag reviews opened from the contractor's own device or IP, and add a short delay before a review is public.
- **O2. Public pages are uncached.** Explore reads up to 500 business documents per view, and the feed 1.5× its page size, for every visitor. Fine today; it is the first thing to cost money or be abused at scale. Cache for about a minute with tag invalidation on publish and profile changes.
- **O3. Photos are served at up to 2048 px to everyone**, with no smaller version. Cards on a phone download 150–400 KB per photo. Generate a roughly 800 px variant at upload and use `srcset`.
- **O4. Read amplification at scale** (see §5), and Leads, Customers and Jobs silently stop at 500 rows with no paging.
- **O5. Rate limits are in memory per server instance and use the first `X-Forwarded-For` entry.** On a platform that appends rather than replaces that header the limit can be dodged; with several instances the effective limit multiplies, and the 5-minute revocation window applies per instance. Move to Redis/Upstash and read the client address from the platform's trusted header.

**LOW**

- No Content-Security-Policy. React escapes everything and no XSS was found, so this is defence in depth; add a nonce-based CSP.
- The "5 requests per hour from one contact" guard can be exceeded by simultaneous requests (6 stored in the test).
- Saving and un-saving repeatedly raises a contractor's "saves" count each time.
- Invitations never expire.
- Any member of a business, crew included, can fetch any of that business's job files if they know the file's path (an unguessable UUID that crew only see on jobs they are on).
- Offline: there is no service worker, so navigating while offline shows the browser's offline page.

**By design, noted**

- Crew can see teammates' names on the Team page (no emails, no controls).
- Logging out ends the session on every device.
- A suspended business is hidden publicly but its members can still sign in.
- Action ids work on any page; every action still checks the caller.
- **Deployment:** with more than one server instance, or tabs left open across a deploy, set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (added to `.env.example`); otherwise actions fail with "Failed to find Server Action".

## 7. Limits of this pass

- Chromium with Android device profiles, not real devices or other browsers; no soft-keyboard, camera, battery or low-memory behaviour.
- Emulators, not production Firebase: indexes, quotas and real Storage behaviour are unconfirmed. Images from Unsplash were blocked by the sandbox, so page weight excludes photos.
- One server instance, so cross-instance behaviour was reasoned about, not run.
- Email (verification, reset) was exercised through the emulator's codes, not delivered.
- No screen-reader testing; automated axe checks from earlier phases still pass.
- The tests use the demo seed; the app's performance with thousands of records was not measured.

## 8. Final run

RESULTS_PLACEHOLDER

## 9. Re-running

```bash
npm run emulators          # separate terminal
npm run seed
npm run build && npm start # separate terminal
npm run test:qa            # everything in tests/qa except param-fuzz
SERVER_LOG=/path/to/app.log node tests/qa/param-fuzz.mjs   # needs the app's stdout log
```

`tests/qa/lib.mjs` has the shared helpers. The browser scripts need `CHROMIUM_PATH` if Playwright's own browser isn't installed.
