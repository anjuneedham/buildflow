# BuildFlow V2 UX Architecture

**Inputs:** `PRODUCT_STRATEGY_V2.md` (who, why, the 9-step chain, what is out of V2), `ARCHITECTURE_V2.md` and `FIRESTORE_SCHEMA_V2.md` (routes, roles, data), `COMPETITIVE_REVERSE_ENGINEERING.md`, and the V1 code.
**Scope:** information architecture and user flows. No visual styling, no implementation.
**Status:** proposal. Flows marked **[validate]** depend on assumptions to test with real contractors and customers (strategy §12).

### Design rules used for every decision
1. **Frequency decides placement.** Daily actions sit one tap away; weekly actions two taps; rare actions live in "More". Frequency estimates are assumptions about a 1–5 person crew, to confirm with usage data.
2. **One-handed, under a minute.** The common field actions (photo update, tick a task, reply to a lead) must be completable with a thumb, standing on a site.
3. **No dead ends.** Every screen, including every empty, error and offline state, offers the next useful action.
4. **The system does the bookkeeping.** Anything BuildFlow can infer (customer from a request, project from an accepted quote, "contacted" from a WhatsApp tap) is not a manual step.
5. **Customers never need an account** to find, request, accept, message or review.

### Where this document deliberately differs from the requested map
- **Schedule** is a section of **Today** (an agenda of what's due), not a calendar screen. The strategy keeps a full calendar out of V2 (§11.4). The agenda answers "what do I do today/this week" with no new data model.
- **Messages** live in an **Inbox** tab together with alerts. Customer messages arrive through the client link; WhatsApp and calls stay on the phone and are *logged* on the customer timeline, not re-created as a chat app.
- **Customer signup** is removed from every critical path. It appears only as an optional "Save" sign-in.
- **Customers** are not a bottom tab. They are reached through search and from every lead, quote and job (§1.2 explains why).

---

## 1. Navigation model

### 1.1 Contractor (owner and admin), mobile

```
┌──────────────────────────────────────────────┐
│  [Business name ▾]          🔍 Search   (•) │  ← top bar: search, More (avatar)
├──────────────────────────────────────────────┤
│                  screen content              │
├──────────────────────────────────────────────┤
│  Today    Leads    [ + ]    Jobs    Inbox•3  │  ← bottom bar
└──────────────────────────────────────────────┘
```

| Slot | Destination | Why it earns a tab (assumed frequency) |
|---|---|---|
| **Today** | Agenda (schedule), what needs attention, quick insights, setup checklist | Opened first thing every working day |
| **Leads** | Pipeline of enquiries and quotes in progress | Several times a day when work is coming in; the money pipeline |
| **[ + ] Create** | Action sheet: Site update (photo) · Quote · Lead · Task · Payment | The most frequent *actions* across all screens |
| **Jobs** | Projects (active, upcoming, completed) | Daily during delivery |
| **Inbox** | Customer messages + alerts (badge = unread) | Whenever something needs a reply |

**"More" (avatar in the top bar):** My public profile (view, edit, share) · Customers · Insights · Explore · Team · Billing · Settings · Help · Log out.

**Global search (top bar):** one field that searches customers by name prefix, then shows each match's open leads, quotes and jobs. This uses the indexed customer name query (schema Q-C2) plus per-customer queries; there is no separate full-text search of leads or jobs in V2.

**Naming:** "Jobs", not "Projects": the word small contractors use. Data and routes keep `projects`.

### 1.2 Why these five and not V1's
V1 bottom bar: Home · Leads · Projects · Customers · Profile (public page).
- **Customers moves to More and search.** Contractors look up a customer to act on a lead, quote or job, which are all reachable from the customer's card. Browsing the customer list is a weekly-or-less activity. **[validate]** with usage data.
- **Public profile moves to More,** with sharing promoted on Today's checklist and after milestones (first published job, first review). Contractors view their own public page rarely; sharing it is what matters.
- **Create (+) is added** because the highest-frequency field actions (photo update, payment) were 3–4 taps deep in V1 (open project → find section → upload).
- **Inbox is added** because client-link messages are new in V2 and replying fast drives conversion.

### 1.3 Field member, mobile
Field users have no CRM access (architecture §5.3), so their navigation is smaller:

```
│  Today        [ + ]        Jobs        Inbox │
```
- **Today:** my tasks due/overdue, my jobs today.
- **+:** Site update · Task (in an assigned job) · Payment received.
- **Jobs:** assigned jobs only.
- **Inbox:** alerts (task assigned, job updates). No customer message threads in V2.
- **More:** Account, Notifications, Help, Log out.

### 1.4 Customer (no account), mobile

```
│  BuildFlow                        Log in?   │  ← top bar ("Log in" only matters for contractors)
│  Find       Saved       My jobs             │  ← bottom bar
```
| Slot | What | Notes |
|---|---|---|
| **Find** | Service + area search with two views: **Contractors** and **Work** | Merges V1's separate Explore and Search tabs |
| **Saved** | Saved contractors and work | Requires sign-in (Google or email). Hidden until the person taps Save the first time |
| **My jobs** | Client links opened **on this device** (remembered locally) + "Find my job" (email me my link) | Lets a customer return without an account |

If no client link has been opened on the device, "My jobs" is hidden, leaving a 2-tab bar.

### 1.5 Tablet and desktop (≥ 768 px)
- Same destinations in a left sidebar; **Create** becomes a primary button at the top of the sidebar.
- **List–detail split** for Leads, Jobs, Inbox and Customers (list on the left, selected item on the right). This fixes V1's tablet Explore being a narrow column with wasted space, and the truncated lead names.
- **Explore (Work view)** uses a multi-column grid on tablet.

### 1.6 Deep links
Every notification, email and WhatsApp message opens the exact screen (lead, quote, job, thread), never the dashboard. Android app links route `buildflow.app/...` into the shell (architecture §2.6).

---

## 2. Screen hierarchy

Routes follow `ARCHITECTURE_V2.md` §2.1. `‹sheet›` = bottom sheet over the current screen (keeps context, one-handed).

### 2.1 Contractor app

```
/app                              Today
  ├─ Agenda: Today | This week    (tasks due, job start/end dates, follow-ups due)
  ├─ Needs attention              (new leads, unanswered messages, quotes viewed, overdue)
  ├─ Setup checklist              (until complete; then hidden)
  └─ This month                   (requests, quotes sent/accepted, profile views) → Insights

/app/leads                        Leads: segmented New · Contacted · Quoted · Won · Lost
  └─ /app/leads/[id]              Lead
       ├─ Customer card ─────────▶ /app/customers/[id]
       ├─ Request details
       ├─ Actions: WhatsApp · Call · Quote · Follow up ‹sheet› · Mark lost ‹sheet›
       └─ Timeline (activity)

/app/quotes/new?lead=…            Quote builder (3 steps, see §3.6)
/app/quotes/[id]                  Quote (status, preview, share again, revise)

/app/jobs                         Jobs: segmented Active · Upcoming · Completed
  └─ /app/jobs/[id]               Job hub
       ├─ Header: status, customer, next task, money summary
       ├─ Updates  (default section) ── Post update ‹sheet›
       ├─ Tasks    ── Add task ‹sheet›
       ├─ Money    ── quote, invoices, payments; Record payment ‹sheet›; Create invoice
       ├─ Files & photos
       ├─ Client link (share, preview as customer, revoke)
       └─ Complete job ▶ Publish to portfolio ▶ Request review

/app/inbox                        Inbox: segmented Messages · Alerts
  └─ /app/inbox/[threadId]        Thread (one per client link), reply box

/app/customers                    (from More / search) list A–Z + recent
  └─ /app/customers/[id]          Customer: contact actions, open leads, quotes, jobs, timeline

/app/profile                      My public profile: preview, edit sections, Share ‹sheet›
/app/portfolio                    Published work (hide/delete)
/app/insights                     Monthly stats
/explore                          Explore (shared with customers)
/app/team                         Members, invite ‹sheet›, roles
/app/billing                      Plan, trial status, seats
/app/settings                     Business details · Quotes & tax · Notifications ·
                                  Account (password, delete) · Export data · Legal
```

V1 `/app/projects/*` routes redirect to `/app/jobs/*`.

### 2.2 Customer (public)

```
/                                 Home = Find (service + area pickers, recent work)
/explore[/service[/area]]         Find → Work view (feed of verified jobs)
/search?service&area&q            Find → Contractors view (list)
/contractor/[slug]                Contractor profile
  ├─ Sticky actions: Request a quote · WhatsApp (if provided)
  ├─ Work (grid) ──▶ /post/[id]
  ├─ Reviews
  └─ About (services, area, years, contact)
/post/[id]                        Work detail: photos (before/after), job info, "Request similar"
‹sheet› Request a quote           One form (§3.13)
/c/[token]                        Client link: the customer's quote and job (§3.14)
/saved                            Saved (sign-in required)
/my-jobs                          Device-remembered client links + "Find my job"
```

---

## 3. User journeys

Each journey lists **V1 steps → V2 steps** and what was removed. Step counts are taps/screens on the main path, counted from V1's code where V1 has the flow.

### CONTRACTOR

#### 3.1 Signup
| | V1 | V2 |
|---|---|---|
| Entry | "Get started" → signup | "Start free" on `/for-contractors` and pricing → signup (contractor implied by entry point) |
| Fields | Name, email, password | **Continue with Google** (one tap, email already verified) **or** name, email, password |
| Then | Onboarding (6 more steps) | Business setup (1 screen) |

**Removed:** account-type choice (customers never sign up to request work, and the entry point says who you are). Email verification does not block setup; a banner and inline prompts appear only when verification is needed (§3.6).

#### 3.2 Business setup
| V1 (6 screens) | V2 (1 screen) |
|---|---|
| Business → Services → Service area → Branding → First record → Finish | **Business name · What do you do? (pick up to 3 trades) · Parish** → "Go to my dashboard" |

- Slug is generated from the name (editable later); currency defaults to JMD, tax is off until the first quote asks (§3.6).
- Logo, cover, description, contact details, phone verification: **deferred to the checklist** on Today, where each one explains its benefit.
- Lands on **Today** with the hero action **"Send your first quote"** (activation moment, strategy §6) and a secondary **"Share your profile"**.

#### 3.3 Profile (my public profile)
- **Completeness meter** with the four items that make the business *listed* in search (schema `is_listed`): name ✓, at least one trade ✓, parish ✓, **a logo or a photo of your work**. The last item says "Add one photo to appear in search".
- Further items raise conversion but are optional: description, WhatsApp number, years in business, service area text.
- **Share sheet:** WhatsApp, copy link, QR code (for van/flyer), "Add to WhatsApp status" text.
- **Preview as customer** opens the real public page in a sheet.
- Edits are inline section by section (no single long form).

#### 3.4 Today (dashboard and schedule)
Order follows urgency, not modules:
1. **Needs attention** (only when non-empty): new leads not yet contacted, unanswered customer messages, quotes viewed but not accepted after 3 days, overdue tasks. Each row has its action inline (WhatsApp, Reply, Nudge, Done).
2. **Agenda:** `Today | This week` toggle. Items: tasks due (tick inline), job start/target dates, follow-ups due (snooze inline), quote expiry. This is the V2 "Schedule".
3. **Setup checklist** (new businesses).
4. **This month:** four numbers with the comparison to last month; tap → Insights.

Nothing on Today requires a second screen to act on the most common item.

#### 3.5 Leads
**Main path:** push "New quote request from Marcia: kitchen tiling, St Andrew" → Lead screen → **WhatsApp** (opens WhatsApp with a prefilled greeting; BuildFlow logs the touch and moves the lead to *Contacted*) → later **Quote** → quote builder prefilled with the customer and request.
- **Follow up ‹sheet›:** chips Tomorrow · In 3 days · Next week · Pick date. Sets `next_follow_up_at`; the reminder comes back as a push and appears on Today.
- **Mark lost ‹sheet›:** optional reason chips (Too expensive, Went elsewhere, No reply, Not my type of job). One tap.
- **Manual lead** (phone call, walk-in): + → Lead → name, phone, what they need. Customer is created automatically.

**Removed vs V1:** converting a lead to a customer (the customer exists from the first moment); 7 stages reduced to 5; status changes that BuildFlow can infer (contacted on first WhatsApp/call, quoted on send, won on acceptance) are automatic, with manual override.

#### 3.6 Quote (the activation flow)
Three steps, each one screen, back always available:
1. **Who:** prefilled from the lead; otherwise search customers or "New customer" (name + phone; Android contact picker in the app).
2. **What:** title (prefilled from the request) and **one price field by default**. "Add line items" expands into a list. **First quote only:** an inline question "Do you charge GCT?" (Yes → rate; No) saves the business tax setting; never asked again. Deposit chip row: None · 25% · 50% · Fixed (default from settings).
3. **Send:** preview as the customer will see it, then **Send on WhatsApp** (primary, opens WhatsApp with the client link and a short message) · Send by email (if the customer has an email) · Copy link.

**Email verification at this point (amends `ARCHITECTURE_V2.md` §5.1):** sharing the link through the contractor's **own** WhatsApp works without a verified email, so the first quote is never blocked. **Emails sent by BuildFlow** to customers, and **appearing in public search**, still require verification. When an unverified contractor chooses email, the screen shows "Verify your email to send from BuildFlow" with resend/change options, and WhatsApp stays available.

After sending: confirmation with "We'll tell you when Marcia opens it", and the lead moves to *Quoted*.

#### 3.7 Customers
- Reached from search, from any lead/quote/job card, and from More → Customers.
- Customer screen: name, contact actions (WhatsApp · Call · Email · Copy number), **open items** (leads, quotes, jobs), then the **timeline** (notes, messages, calls, quotes, payments).
- **Add note** inline at the top of the timeline.
- **Block contact** (in the overflow menu): revokes their client links and stops their quote requests (schema `customers.blocked`).

#### 3.8 Jobs (projects)
**Creation:** automatic when a customer accepts a quote (push: "Marcia accepted your quote: job created"). Manual "New job" exists in the Jobs list overflow and from a customer, for work agreed offline.

**Job hub on mobile** opens on **Updates**, because posting progress is the most frequent action:
- Header: status chip, customer (tap → customer), next task, money line ("J$120,000 quoted · J$60,000 paid").
- Sections as a segmented control: **Updates · Tasks · Money · Files · Info**.
- Contextual primary action changes per section: Post update / Add task / Record payment / Upload file.
- **Client link card** in Info: "What your customer sees" preview, Share again, Turn off.

**Status changes:** Start job (planning → active) is offered on the first update or task completion; **Complete job** opens the completion flow (§3.11).

#### 3.9 Tasks
- **Add task ‹sheet›:** title, optional due date (chips Today · Tomorrow · Pick), optional assignee (team members on this job). Enter adds another (quick list entry).
- **Complete:** tick in any list (Today, Job, My tasks). Optional "Add photo" prompt after completion for proof (posts a site update).
- **Field member's main loop:** Today → tick tasks → + → Site update.

#### 3.10 Site update (the most frequent field action)
+ → **Site update** → camera opens directly (or gallery) → select up to 10 → optional note (voice-to-text via the keyboard) → job is preselected when started inside a job, otherwise "Which job?" shows active jobs, most recent first → toggle "Share with customer" (default from job setting) → **Post**.
- **Offline:** shows "Saved. Will upload when you're back online" and a queue indicator on the job (§6.4).
- Target: **≤ 5 taps** from the bottom bar to posted. **[validate]** with timed field tests.

#### 3.11 Complete job → portfolio → review (the marketplace loop)
**Complete job** is a guided sheet of three short steps, any of which can be skipped:
1. **Confirm complete** (final payment reminder if a balance is open).
2. **Publish to your portfolio:** BuildFlow preselects the best photos it can (first and last updates; photos labelled before/after). The contractor taps to adjust, adds a one-line caption → Publish. Requires email verification (architecture §5.1); if unverified, the post is saved as draft with a prompt.
3. **Ask for a review:** Send on WhatsApp (link opens the review step of the client link) · Email · Later.

This replaces V1's separate "New post" form as the main way content is created. "New post" remains in My profile → Portfolio for older work.

#### 3.12 Messages (Inbox)
- **Messages:** one thread per client link (customer + quote/job), newest first, unread first. Threads show the job name, last message and a status chip.
- **Reply:** typed reply goes to the client link; BuildFlow emails the customer if they have an email. Because many customers will only have a phone, the thread offers **"Nudge on WhatsApp"**, which opens WhatsApp with "You have a new message about your kitchen job: [link]". **[validate]** whether customers will reply in the link or simply reply on WhatsApp; if the latter, the thread becomes mostly a log and the design should lean into "Continue on WhatsApp".
- **Alerts:** quote viewed/accepted, payment recorded by a crew member, task assigned, review received, trial reminders. Each opens its item.

#### 3.13 Explore (contractor)
Same Find screen as customers. Contractors use it to see local work and how their posts appear. No contractor-only features in V2.

#### 3.14 Settings
One list, grouped: **Business** (details, trades, area, contact) · **Quotes & tax** (currency, GCT, deposit default, validity, terms) · **Team** · **Billing** · **Notifications** (one screen of toggles) · **Account** (email, password, **Delete account**) · **Export data** · **Help & legal**.
Destructive actions (delete account, delete business, revoke all links) require typing the business name and explain consequences first.

### CUSTOMER

#### 3.15 Signup
**Not required anywhere.** The only sign-in prompt appears when a customer taps **Save**: "Sign in to keep your saved contractors" → Continue with Google or email. After sign-in the save completes automatically and the person returns to the same screen.

#### 3.16 Discover
Home is **Find**:
1. "What do you need done?" → trade chips (most common first) or type.
2. "Where?" → parish (remembers last choice; offer "Use my location" only if a parish lookup is reliable **[validate]**).
3. Results open in the **Contractors** view by default (the customer's intent is to hire), with a toggle to **Work**.

Below the pickers on first visit: recent verified work in the customer's last-used parish, to show that the service is real.

#### 3.17 Search and explore
- **Contractors view:** cards with name, trades, parish, rating and count, "Usually replies within X hours", verified-job count, a 3-photo strip. Tap → profile. Inline **Request a quote** on each card.
- **Work view:** feed of portfolio posts filtered by the same trade + parish. Tap → work detail.
- **Filters** are only trade and parish in V2 (both indexed). Sorting is fixed (rank for contractors, newest for work). No filter screen.
- **Name search:** typing a business name in the trade field switches to name search (schema Q-S5/S6).

#### 3.18 Contractor profile
Top to bottom, ordered by what builds trust: name, trades, parish, **rating + review count**, **verified jobs count**, **response time** → **sticky actions: Request a quote (primary) · WhatsApp (secondary, if the contractor provided a number)** → Work grid → Reviews (latest 5, "See all") → About.
- **WhatsApp tap** is logged as a `contact_click` stat for the contractor. It does not create a lead (the conversation happens off-platform). **[validate]** whether contractors want those contacts captured; if yes, add a "Did someone contact you on WhatsApp? Add them as a lead" prompt to Today.

#### 3.19 View work
Work detail: photos (before/after pairs as a swipeable pair), job title, trade, parish, completion month, **"Verified job"** badge when linked to a BuildFlow project, the contractor's rating. Actions: **Request a similar job** (opens the request form with trade prefilled and a reference to this post) · Save · Share · Report.

#### 3.20 Contact / request service
V1 had two forms ("Request a quote" and "Contact"); V2 has **one**:
1. **What needs doing?** (required, free text; trade prefilled).
2. **Your name** and **phone** (required) with "This number has WhatsApp" (default on). **Email** optional ("to get updates by email").
3. **More details (optional, collapsed):** timeline chips, budget chips, address/area.
4. **Send request.**

Bot protection runs invisibly (App Check). On success: **"Sent to Marcia's Tiling. They usually reply within 3 hours, by WhatsApp or phone."** plus "What happens next: you'll get a quote link you can open on your phone." No account prompt.

Removed vs V1: separate Contact form; budget and timeline as visible fields (kept optional, collapsed).
**Not in V2:** customer photo upload on the request (would need anonymous uploads, which the architecture does not allow). **[validate]** how much contractors need it; candidate for P1.

#### 3.21 Project interaction (client link `/c/[token]`)
One page, no login, built around **the one thing the customer needs to do now**:
1. **Header:** contractor name, logo, contact (WhatsApp/Call).
2. **Progress stepper:** Quote → Accepted → In progress → Complete.
3. **Action card** (changes with status):
   - Quote sent: **Review quote** → line items, totals, deposit, validity → **Accept** → type your name → **Confirm** (3 taps + name). Decline is a secondary link with optional reason.
   - In progress: "Deposit of J$60,000 due" (information only in V2: how to pay is stated by the contractor in the quote terms).
   - Complete: **Rate your experience**.
4. **Updates feed:** shared site updates with photos, newest first.
5. **Messages:** thread with a reply box.
6. **Documents:** quote (PDF), invoices, payment history.

The link is remembered on the device (My jobs). If the link is opened on another device later, it still works because the token is the access.

#### 3.22 Messages (customer)
Inside the client link only. Sending a message notifies the contractor's team (push + Inbox). No separate inbox for customers in V2.

#### 3.23 Reviews
Triggered by the contractor's review request (WhatsApp or email) or the action card after completion: **stars (required) → "What went well?" (optional text) → display name prefilled as "Marcia T." (editable) → Submit.** One screen. Thank-you screen offers **Share this contractor** (WhatsApp).
One review per job (schema `reviews/{projectId}`), editable for 14 days. Contractors can reply once; replies show under the review.

---

## 4. Primary and secondary actions

One primary action per screen. Secondary actions are visible; tertiary actions are in the overflow (⋯).

| Screen | Primary | Secondary | Overflow (⋯) |
|---|---|---|---|
| Today | The top "Needs attention" row's action (e.g. WhatsApp back) | Tick task, snooze follow-up | Customise agenda (later) |
| Leads list | Open lead | Filter segment | Add lead (also in +) |
| Lead | **WhatsApp** (or **Quote** once contacted) | Call · Follow up · Mark lost | Edit · Assign · Delete |
| Quote builder | Next / **Send on WhatsApp** | Add line items · Email · Copy link | Save draft |
| Quote | Share again | Revise | Duplicate · Delete draft |
| Jobs list | Open job | Segment | New job |
| Job hub | **Post update** (Updates), **Add task** (Tasks), **Record payment** (Money) | Share client link · Call customer | Edit · Members · Complete · Cancel job |
| Site update | **Post** | Share with customer toggle | — |
| Inbox thread | **Reply** | Nudge on WhatsApp · Open job | Mute · Block contact |
| Customer | **WhatsApp** | Call · New quote · Add note | Edit · Block · Delete |
| My profile | **Share profile** | Edit section · Preview | — |
| Settings | — | — | — |
| Find (customer) | Search | Toggle Contractors / Work | — |
| Contractor profile | **Request a quote** | WhatsApp · Save · Share | Report |
| Work detail | **Request a similar job** | Save · Share | Report |
| Client link | Status action (**Accept quote** / **Rate**) | Message · Call · WhatsApp | Report |

---

## 5. Empty states

Every empty state answers: what is this, why is it empty, and what one action fills it.

| Screen | Message (intent) | Action |
|---|---|---|
| Today (new business) | "You're set up. Send your first quote or share your profile to get requests." | **Send a quote** · Share profile |
| Today (nothing due) | "Nothing due today." | Post an update · View jobs |
| Leads (none ever) | "Quote requests from your profile appear here." | **Share your profile** · Add a lead you got by phone |
| Leads (segment empty) | "No leads in Contacted." | — (other segments still visible) |
| Jobs (none) | "Jobs are created when a customer accepts your quote." | **Send a quote** · Add a job manually |
| Job: Updates (none) | "Post photos as you work. Your customer sees them, and they become your portfolio." | **Post update** |
| Job: Tasks (none) | "Break the job into steps your crew can tick off." | Add task |
| Job: Money (none) | "Record deposits and payments so you always know the balance." | Record payment |
| Inbox: Messages | "When customers reply to a quote or job link, it shows here." | — |
| Customers | "Customers are added automatically from requests and quotes." | Add customer |
| Portfolio | "Complete a job to publish its photos here, or add older work." | Add older work |
| Reviews (profile, owner view) | "Reviews come from customers of completed jobs." | Request a review (if a completed job exists) |
| Find: no results | "No [electricians] listed in [St Mary] yet." | Try nearby parishes · Show all parishes |
| Contractor profile: no work yet (customer view) | "New on BuildFlow." | Request a quote (still primary) |
| Saved | "Save contractors to compare them later." | Find contractors |
| My jobs (customer) | "Open the link your contractor sent you, or we can email it." | Find my job |
| Field member, no jobs | "You'll see jobs here when you're added to one." | — |

---

## 6. Loading states

| Situation | Pattern |
|---|---|
| Route navigation in the app | Per-section `loading` skeletons that match the layout (list rows, hub header). V1 has a single app-level loader; V2 adds them per segment (audit E.2) |
| Public pages | Served from cache, so loading is mostly avoided; skeletons for the first uncached render |
| Lists (infinite scroll) | Skeleton rows on first load; a small spinner row at the end while the next page loads; "You've reached the end" |
| Button actions | Button shows progress and disables; **never blocks the whole screen**. After 10 s: "Still working… (slow connection)". After 30 s: fail with retry (§7) |
| Optimistic actions | Task tick, snooze, mark read: change instantly; revert with a toast if the server rejects |
| Photo upload | Per-photo thumbnail with progress ring; post becomes "Posting…" then "Posted"; processing images show a blurred placeholder until ready (`media.status`) |
| Offline queue | Job shows "2 updates waiting to upload"; a global indicator in the top bar; items upload automatically when online (architecture §2.5) |
| Client link | Lightweight page; skeleton for the action card only |

---

## 7. Error states

| Type | What the user sees | Recovery |
|---|---|---|
| **Validation** | Inline message under the field, in plain language ("Add a phone number so they can reach you") | Fix in place; form keeps all input |
| **Offline (field actions)** | No error: "Saved offline. Will upload when you're back online." | Automatic |
| **Offline (other actions)** | "You're offline. This needs a connection." with the action kept on screen | Retry when online; input kept |
| **Server / unexpected** | "Something went wrong. Your work is saved [if true]." + reference code (Sentry id) | **Try again** · Contact support (prefills the code) |
| **Permission / not found** | "This isn't available" (no hint whether it exists, architecture §5.3) | Go to Today |
| **Read-only plan (trial ended)** | Banner on every screen: "Your trial ended. You can view and export everything. Choose a plan to keep working." Create actions show the same message instead of the form | **Choose plan** · Export |
| **Seat limit** | On invite: "Your plan has 2 seats. Add a seat to invite Andre." | Add seat (owner) |
| **Rate limited (customer request)** | "You've sent several requests. Please try again in a few minutes." | Wait; WhatsApp alternative if the contractor has a number |
| **Upload failed** | Per photo: "Couldn't upload this photo" with reason ("HEIC photos aren't supported; try JPEG") | Retry · Remove |
| **Client link expired / revoked** | "This link is no longer active. Contact [contractor] for a new one." | WhatsApp/Call contractor |
| **Quote changed while viewing** | "This quote was updated. Review the latest version." | Reload to new revision (acceptance always records the revision) |
| **Email not verified** (send by email, publish, go public) | Inline: "Verify your email to [publish]. We sent a link to x@y." | Resend · Change email · (for quotes) Send on WhatsApp instead |
| **Account suspended** | Dedicated page with reason category and appeal contact | Contact support |

Errors never clear user input, and never lead to a blank page.

---

## 8. Onboarding

### 8.1 Contractor: fast path (target ≤ 2 minutes to Today, **[validate]**)
1. Signup (Google or email) → 2. Business setup (one screen) → 3. Today with **"Send your first quote"**.

### 8.2 Contractor: setup checklist (on Today until done)
Ordered by impact on the first inbound lead and on activation:
1. **Send your first quote** (activation).
2. **Add a photo of your work** (makes you listed in search).
3. **Share your profile on WhatsApp.**
4. **Add your WhatsApp number** (enables the WhatsApp button on your profile).
5. **Verify your email** (needed to publish and send email).
6. **Invite your crew** (optional; shows seat price).

Each item opens the exact screen and returns to Today when done. Completed items tick off; the card disappears when all required items (1–3) are done. Progress is computed from data, not a separate tutorial state (architecture traceability #1).

### 8.3 Contextual first-use hints
One line, dismissible, shown once: first time on the job hub ("Post photos here. Your customer sees them."), first quote sent ("You'll get an alert when they open it"), first completed job (publish + review prompt).
**No tours, no carousels.**

### 8.4 Invited team member
Invite link (WhatsApp/email) → sign up or sign in → "You've joined Marcia's Tiling as crew" → Today (field view). Two screens.

### 8.5 Customer
No onboarding. The first screen is useful (Find) and the request form explains what happens next.

---

## 9. Conversion points

The moments where users either progress or drop off, each with its measurement (product analytics events, architecture §11). Events in **bold** are already in the architecture; others are UX instrumentation to add to the analytics plan (no schema change).

### 9.1 Contractor funnel
| # | Conversion | Screen | Measure | Friction removed |
|---|---|---|---|---|
| C1 | Visit → signup | `/for-contractors`, pricing | `signup_started`, **`signup`** | Google one-tap; no account type |
| C2 | Signup → setup done | Business setup | `business_created` | 6 screens → 1 |
| C3 | Setup → **first quote sent** (activation) | Quote builder | **`first_quote_sent`**, time from signup | Single-price default; GCT asked once; WhatsApp send without email verification |
| C4 | Listed in search | Profile checklist | **`profile_completed`** (= `is_listed`) | Only 4 required items |
| C5 | Profile shared | Share sheet | `profile_shared` (channel) | Share prompts on Today and after milestones |
| C6 | First inbound request | Leads | `first_lead_received` | — |
| C7 | Lead → contacted | Lead | `lead_contacted` (time to first response) | One-tap WhatsApp logs automatically |
| C8 | Quote → accepted | Client link | **`quote_accepted`** | Customer accepts without account |
| C9 | Job → first update shared | Site update | `update_posted` | Camera-first, ≤ 5 taps, offline |
| C10 | Job completed → portfolio post | Complete-job sheet | **`project_completed`**, `portfolio_published` | Photos preselected |
| C11 | Completed → review | Review request | **`review_received`** | One-screen review, WhatsApp request |
| C12 | Trial → paid | Billing | `subscription_started` | Clear trial status; no card upfront |

### 9.2 Customer funnel
| # | Conversion | Screen | Measure | Friction removed |
|---|---|---|---|---|
| U1 | Landing → search | Find | `search_performed` | One screen, two pickers |
| U2 | Results → profile | Contractors view | `profile_view` (stats) | Trust signals on the card |
| U3 | Profile/work → request | Request sheet | `quote_request_started` → `quote_request_submitted` | One form; 3 required fields; no account |
| U4 | Alt: WhatsApp contact | Profile | `contact_click` (stats) | Direct to WhatsApp |
| U5 | Quote link → viewed | Client link | `quote_viewed` | No login |
| U6 | Viewed → accepted | Client link | **`quote_accepted`** | 3 taps + name |
| U7 | Job → review | Client link | **`review_received`** | One screen |
| U8 | Review → shares contractor | Thank-you | `contractor_shared` | WhatsApp share |

---

## 10. Unnecessary steps removed (summary)

| V1 | V2 | Saved |
|---|---|---|
| Choose account type at signup | Implied by entry point; customers never sign up to request | 1 decision |
| 6 onboarding screens (business, services, area, branding, first record, finish) | 1 screen + checklist | 5 screens |
| Separate Explore and Search tabs | One Find screen with two views | 1 tab, 1 mental model |
| "Request a quote" and "Contact" as separate forms | One request form | 1 choice |
| Budget and timeline shown as fields | Optional, collapsed | Fewer fields on the critical path |
| Lead → convert to customer | Customer exists from the request | 1 manual step |
| Lead → create project manually | Job created on quote acceptance | 1 form |
| Manual status changes for contacted/quoted/won | Inferred, overridable | 3 taps per lead |
| 7 lead stages | 5 | Simpler pipeline |
| Separate "New post" form as the main content path | Publish from a completed job, photos preselected | Re-uploading photos |
| Project photos 3–4 taps deep | + → Site update, camera first | 2–3 taps per update |
| Notifications as a separate page | Inbox (Messages + Alerts) | 1 destination |
| Customers and public profile as bottom tabs | Search/More; sharing promoted | 2 tabs freed for Create and Inbox |
| Analytics page | 4 numbers on Today + Insights in More | 1 screen for most needs |
| Likes, comments, follow | Removed (strategy) | Moderation and noise |

---

## 11. What needs validation before build

1. **Tab frequency:** are Leads and Jobs really daily destinations, and is Customers really weekly? Test with 5–8 contractors using a clickable prototype; adjust the bar if Customers is used daily.
2. **WhatsApp as the default send channel** for quotes, and whether customers return to the client link or reply on WhatsApp (decides how much to invest in Inbox).
3. **Five-tap site update** in real site conditions (gloves, sun glare, one hand).
4. **Single-price quote default** versus line items: how do contractors quote today?
5. **Customer request without photos:** do contractors need photos before quoting?
6. **Parish as the area unit** for discovery, and whether "Use my location" is worth building.
7. **Review prompts:** will customers leave a review from a WhatsApp link?

---

## 12. Consistency with the architecture

| UX decision | Architecture/schema support | Change needed |
|---|---|---|
| Quote send via WhatsApp without verified email | §5.1 enforced verification on "sending quotes" | **Amended** in `ARCHITECTURE_V2.md` §5.1 (verification for BuildFlow-sent email, publishing, listing, invites) |
| Global search = customers by name + their items | Q-C2, Q-L3, Q-Q2, Q-PR3 | None |
| Today agenda | Q-T1/Q-T3, Q-L4, project dates, Q-J2 data | None |
| Inbox message threads | `activity` with `link_id` (Q-AC3); one thread per client link | **Added** `client_links.last_message` + `unread_for_business`, index 38, query Q-IN1 (1 read per thread) in `FIRESTORE_SCHEMA_V2.md` |
| Field navigation | Policy matrix §5.3, Q-PR2, Q-T1 | None |
| Customer "My jobs" on device | Client link token is the access | Local storage only; no server change |
| "Find my job" by email | Customer `email_lower` + active `client_links` | **Added** query Q-FJ1 and a collection-group field override in the schema; public action is rate-limited and always shows "If we found a job, we emailed you" (no enumeration) |
| Saves require sign-in | `users/{uid}/saves` | None |
| One request form | `submitQuoteRequest` | Drop `kind: "contact"` |
| Jobs naming | Routes `/app/jobs/*`; data stays `projects` | Route rename + redirects |
| Block contact | `customers.blocked` | None |
