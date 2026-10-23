# BuildFlow V2 Product Strategy

**Inputs:** `V2_AUDIT.md` (what V1 is and what blocks production) and `COMPETITIVE_REVERSE_ENGINEERING.md` (what the market does and where it fails).
**Status:** strategy only. Nothing here is implemented.

> **Simple enough for a small contractor.**
> **Powerful enough to run the business.**
> **Public enough to get the contractor discovered.**

These three lines are the test for every decision below. A feature that does not serve at least one of them, and that does not strengthen the core loop in section 8, stays out of V2.

### What is a fact and what is a bet
- **Facts** come from the V1 repository and from public competitor reviews (marked in the two source documents).
- **Bets** are my recommendations about the target contractor, pricing, and what drives activation. They have **not been validated with real contractors**. Section 12 lists what to test first. Where a number is a target rather than a measurement, it is labelled **target**.

---

## 1. Target contractor

**Who:** the owner-operator or small crew (1–5 people) in residential repair, renovation and finish trades: builders, electricians, plumbers, painters, tilers, roofers, carpenters, landscapers. Launch market: **Jamaica**, with the Caribbean next. (Market choice is from the project's context; I have not independently sized it.)

**What they look like today:**
- They get most work from referrals and WhatsApp, and keep customers, quotes and job photos in the phone gallery, WhatsApp chats and notebooks.
- They do the work and the admin themselves, often from the truck or the site.
- They are not "software people". They will not configure templates or attend training.
- Signal is unreliable on some sites.
- They distrust paid-lead platforms and long contracts (the consistent complaint pattern in the competitor research).

**Who V2 is *not* for:** commercial general contractors, firms with a back office, or design-led firms that need selections and 3D visuals. Those buyers are served by Procore, Buildertrend and Houzz Pro, and chasing them is the fastest route to bloat.

**Why this contractor:** the PM tools are priced and built for larger firms; Jobber serves service trades but not project showcasing or discovery. A one-to-five person crew is the segment where "too complicated" and "too expensive" are the main reasons for not using software at all.

---

## 2. Target customer

**Who:** a homeowner, landlord or small-business owner who needs a repair, renovation or build done, and wants someone *trustworthy and nearby*.

**What they do today:** ask friends and family, scroll WhatsApp and Facebook groups, and hope. Their fear is not price; it is **being let down** (no-shows, bad work, vanished deposits).

**What they need from BuildFlow:**
- See real finished work from real local contractors.
- Ask for a quote in under a minute without making an account.
- Know what is happening on their job without chasing.
- Confirm a price in writing.

The customer is **never a paying user** and must never be forced to register.

---

## 3. Core problem

> A small contractor does good work but runs the business out of a phone: leads get lost in WhatsApp, quotes are typed ad hoc, customers keep asking for updates, and the great photos of finished jobs never become new customers.

Three problems, one chain:
1. **Getting found:** good contractors are invisible outside their referral circle.
2. **Winning and delivering:** leads, quotes and job updates are scattered and slow.
3. **Proving it:** finished work is not turned into trust (portfolio and reviews).

Competitors each solve one link: marketplaces solve 1 (badly, with paid shared leads), service software solves 2 for service trades, PM tools solve 2 for builders, nobody connects 3 back to 1.

---

## 4. Core promise

> **"Get found, win the job, and show the work: from one phone."**

In plain terms for a contractor: *Your leads are yours. Your quotes look professional. Your finished jobs bring you the next customer.*

Promise rules (what we commit to, and so what we cannot compromise):
- **Leads are never sold, shared or auctioned.**
- **Works on a phone, with weak signal.**
- **No setup consultant needed.** First useful action within minutes (see 6).
- **Month-to-month, cancel in the app, take your data with you.**

---

## 5. Primary user journey

The V2 journey is one chain. Each step is the same thing seen from both sides; this is also the **definition of "minimum complete V2"** in section 11.

| # | Step | Contractor | Customer |
|---|---|---|---|
| 1 | **Get found** | Profile with portfolio, services, area; shareable link and QR | Finds contractor via search/Explore or a link shared on WhatsApp |
| 2 | **Enquire** | Notified immediately (push, email) | Sends a quote request in under a minute, no account |
| 3 | **Respond** | One-tap call/WhatsApp from the lead; reminder if untouched | Gets a fast reply |
| 4 | **Quote** | Builds a simple quote (line items, tax, deposit) in minutes; sends a link | Opens link: sees quote, accepts, can message |
| 5 | **Win** | Accepted quote becomes a project automatically | Receives confirmation of what, when, how much |
| 6 | **Deliver** | Posts site updates (photo + note), ticks tasks; works offline | Sees progress on the same link, no login |
| 7 | **Get paid** | Records deposit/payments, sends invoice | Sees what is paid and what remains |
| 8 | **Show** | Marks complete; chooses photos to publish as before/after | Receives a request to confirm completion and leave a review |
| 9 | **Be found again** | Portfolio and verified review appear on the public profile | Reads real, verified work when choosing the next contractor |

Everything in V2 is judged by whether it makes one of these nine steps faster, clearer or more trusted.

---

## 6. Contractor activation moment

**Definition (a hypothesis to test): the contractor has activated when they have *sent their first quote to a real customer* through BuildFlow.**

Why this moment rather than "created a profile" or "posted a photo":
- A profile is a destination, not a habit; contractors can sign up and never return.
- Sending a quote is the point where BuildFlow starts handling real money and a real client. It proves the product replaced a WhatsApp/notebook workflow.
- It is also the step competitors gate behind long setup.

**Fast path to it** (target: first quote sent within **one session**, on a phone):
1. Phone/email sign-up, business name, trade, area. (Skip everything else.)
2. Add or import one customer or lead (paste a phone number, or pick from the contacts shared by the person).
3. "Send a quote": choose a service, type a price and a one-line description, optionally add line items. Send via WhatsApp link.
4. Profile and portfolio are completed *after*, prompted by a checklist, because a published profile is what produces the first inbound lead.

**Supporting activation signals to measure:** profile completed, share link sent, first inbound lead, first project created, first site update. Activation is "quote sent"; the others tell us why people fail to reach it.

**Honest caveat:** if contractors in interviews say their first need is being *found*, not quoting, the activation moment should be "first inbound lead" instead. Validate before building the onboarding around it (section 12).

---

## 7. Customer activation moment

**Definition (hypothesis): the customer has activated when they have *sent a quote request* or *accepted a quote* without creating an account.**

- A **quote request** takes under a minute: what do you need, where, how to reach you (phone or WhatsApp). That is already built in V1; it needs spam protection and a confirmation that tells them what happens next.
- The customer's second activation, and the one that matters for trust, is **opening the client link and seeing their quote or job**. That is where BuildFlow replaces "what's the status?" calls.
- Account creation is optional and only offered after value (e.g. "Save this contractor"). V2 does not require customer accounts.

---

## 8. Core retention loop

Retention comes from **money and records flowing through the product**, not from feeds or notifications for their own sake. The competitor research shows retention in this market is driven by payments, client portals, and accumulated job data, while lock-in contracts only create resentment.

```
Quote request / referral
   → Quote sent (link)
      → Customer accepts
         → Project created (auto)
            → Site updates & tasks (daily use, photos)
               → Payment recorded / invoice
                  → Project completed
                     → Photos published + customer review
                        → Stronger profile → more quote requests
```

**Why a contractor stays:**
1. **Daily use:** tasks and site updates are used every working day, even when no new leads arrive.
2. **Records they cannot easily recreate:** every customer, quote, photo and payment is in one place, which is also useful in a dispute.
3. **Customers expect the link:** once customers are used to seeing updates, the contractor does not want to go back to answering "what's the status?".
4. **Reputation compounds:** each completed job adds a portfolio item and a verified review that only exist on BuildFlow.

**Why a contractor can leave, by design:** data export is always available. We retain through value, not lock-in. This is also a differentiator (section 11).

---

## 9. Marketplace / social loop

The social side exists to **create trust and inbound enquiries**, not engagement. V1's likes, comments and general feed are not the goal.

```
Real finished job (project photos)
   → "Publish to portfolio" (before/after, one tap)
      → Public profile + Explore + search (by service and area)
         → Customer browses real local work
            → Quote request (free, exclusive to that contractor)
               → Contractor wins job → back to the retention loop
```

**Principles:**
- **Content is a by-product of work.** Publishing starts from a completed project's photos, not from a blank "create post" form. Contractors will not do the work twice.
- **Trust signals beat popularity signals.** Show "Verified job" (linked to a real project), reviews, response time, area and services. Hide or demote vanity metrics.
- **Never sell the lead.** A quote request goes to the contractor whose work the customer viewed, and only to them. This is the commitment that differentiates us from Houzz, Angi and Thumbtack.
- **Local first.** Browsing and search by service + parish/area. A thin local marketplace with real work beats a broad one with stock images.
- **Cold-start honesty:** a marketplace has no value without both sides. The plan is **contractor-led**: each contractor shares their profile link/QR with their own customers (so their profile is useful on day one), and the marketplace grows as a side effect of contractors using the tool. We do not need Explore to be busy for the product to be useful; this is a deliberate design choice because we cannot afford to buy demand.

---

## 10. Revenue model

**Principle:** charge contractors a simple, predictable subscription. Never charge per lead, never take a cut of quotes, never charge customers.

**V1 state (fact):** one plan, **Basic: $50/month including 1 user, +$20/user/month**, data-driven plan table. Not enforced, no billing integration, USD only.

**V2 recommendation (bets):**
- **Keep one simple plan at launch**, with the same shape: **base price that includes the owner + per-extra-user price.** Simplicity is a selling point; do not add tiers until usage shows a clear need for them.
- **Free client access, always.** Customers and, later, subcontractors view links for free. This is an industry norm (JobTread, Procore) and is key to the customer experience.
- **Free trial, no card required** to start, with a clear end date. Trial expiry must actually be enforced in V2 (it is not today).
- **Month-to-month, cancel in the app,** export always available.
- **Price level to test, not assume:** $50 is below Houzz Pro (≈$399 on aggregators) and Buildertrend (≈$400+) and above Jobber's solo entry (≈$29–49), but those are reported figures that conflict between sources. Whether a Jamaican small contractor will pay $50 USD/month is **unvalidated**; it may need a local-currency price or a cheaper solo tier. Test willingness to pay in interviews before locking.
- **Later (P1+) add-on revenue** only where it directly tracks value to the contractor: payment processing margin (when payments launch), and optional extras such as extra storage. Not in V2 scope unless payments ship.

**Billing platform risk:** whether in-app subscriptions on Android must use Google Play Billing, or whether web checkout is allowed for a business SaaS, is **unresolved and must be checked against current Google policy** (`V2_AUDIT.md` H.2). It affects margin (store fees) and architecture, so decide before building billing.

**Not doing:** pay-per-lead, lead auctions, featured-placement ads in V2. They conflict with "your leads are yours" and the main complaint about the market.

---

## 11. Product differentiation, and the minimum complete V2

### 11.1 Differentiation (why we are not a clone)

| Others | BuildFlow |
|---|---|
| Marketplaces sell shared, paid leads | **Leads are yours, free, exclusive** |
| PM suites need weeks of setup and training | **First quote in one session, on a phone** |
| Business software and discovery are separate products (Houzz Pro is the partial exception) | **One chain: discover → quote → deliver → showcase → be discovered again** |
| Content is a separate marketing task | **Portfolio is generated from real project photos** |
| Reviews can be fake or unlinked | **Reviews and "verified job" tied to completed projects** |
| Annual contracts, per-user client fees, volume pricing | **Month-to-month, free client access, full export** |
| Built for US/UK assumptions | **Weak-signal tolerant, WhatsApp-first, JMD/USD, local areas** |

### 11.2 The simplicity rule (guard against bloat)

Four checks every proposed V2 feature must pass:
1. **User problem:** can we state, in one sentence, the specific problem a real contractor or customer has today that it solves?
2. **Loop:** does it speed up or make more trusted one of the nine steps in section 5?
3. **Phone-first:** can it be done in under a minute, one-handed, on a phone?
4. **Setup-free:** does it work without configuration? If it needs templates or settings to be useful, it is out or deferred.

If a feature fails 1 or 2 it is out of V2. If it fails 3 or 4 it needs redesign before it is in.

### 11.3 Minimum complete V2: in

"Minimum complete" means a contractor can walk the full chain in section 5 inside BuildFlow without needing another tool for the core job. Each row states the problem solved.

**Foundations (not features; must be done, from `V2_AUDIT.md`)**
Index fixes and a real staging Firebase project, public pages cacheable, abuse protection (App Check/CAPTCHA, durable rate limits), image pipeline fixed, email verification enforced, account deletion and data export, block/report moderation, real legal text, monitoring and CI. *Problem solved: the product can safely be used by real people and can pass Google Play review.*

**Product features**

| # | Feature | User problem it solves | Loop step |
|---|---|---|---|
| 1 | **Fast onboarding + activation checklist** | "I don't have time to set up software." Gets a contractor to a first sent quote in one session. | 1, 3 |
| 2 | **Public profile v2** (portfolio, services, area, share link + QR, verified phone, response time) | "Customers can't find or trust me outside my referral circle." | 1, 9 |
| 3 | **Quote request (hardened)** with confirmation to the customer | "Enquiries get lost or spammed." Customer knows what happens next. | 2 |
| 4 | **Lead inbox with follow-up** (stages, reminders on untouched leads, one-tap call/WhatsApp, logged) | "I lose leads because I reply late or forget." | 3 |
| 5 | **Quotes** (line items or single price, tax/GCT, deposit, branded PDF/link, accept online) | "My quotes are typed ad hoc in WhatsApp and look unprofessional; I can't prove what was agreed." | 4 |
| 6 | **Client link** (no login: quote, project status, updates, accept, message) | "Customers keep calling for updates; they don't trust what they can't see." | 4, 5, 6, 7 |
| 7 | **Project hub** (created automatically from an accepted quote: customer, scope, tasks, updates, files, money in one place) | "Information for one job is spread across chats, gallery and notes." | 5, 6 |
| 8 | **Site updates** (photo + note, offline-capable, optionally shared to the client link) | "I can't prove progress, and customers don't know what's happening." | 6 |
| 9 | **Tasks with assignment** (mobile completion, due dates fixed for timezone) | "Nobody on the crew knows what's next." | 6 |
| 10 | **Payments record + simple invoice** (deposit, balance, mark paid, shown on client link) | "I forget who has paid what." Online payment processing is not in V2. | 7 |
| 11 | **Publish to portfolio** (before/after from project photos, one tap) | "I never have time to market myself." | 8, 9 |
| 12 | **Verified reviews** (requested at completion, from the client link, tied to the project; contractor can reply) | "Customers can't tell good contractors from bad; fake reviews exist." | 8, 9 |
| 13 | **Notifications: push + email** with basic preferences (new lead, quote accepted, client message, task assigned) | "I miss enquiries because the app is closed." | 2, 3 |
| 14 | **Simple team access** (owner/admin/field member; field member sees assigned work only) | "I don't want crew seeing everything, and I don't want to pay a lot to add them." | 6 |
| 15 | **Subscription billing, enforced** (trial → paid, seat count, cancel in-app) | "We need a sustainable product the contractor can understand." | all |
| 16 | **Data export** (CSV + photos ZIP) | "I'm afraid my records get locked in." Builds trust, enables month-to-month promise. | all |
| 17 | **Search and Explore that scale** (service + area, index-backed, pagination) | "Customers can't find the right contractor nearby." | 1 |
| 18 | **Offline capture** (photos, site updates, task completion queue and sync) | "I lose signal on site and can't log the job." | 6 |
| 19 | **Android app** (Capacitor shell, push, camera) for Google Play closed testing | "Contractors live on Android phones; a web link isn't an app." | all |

(Features 18 and 19 are the most expensive; if schedule forces cuts, ship 1–17 as a web app first. See the order below.)

### 11.4 Left out of V2 (and why)

Each item fails the section 11.2 test: either no clear core problem for the target contractor, or it adds setup and complexity before the core loop is proven.

| Left out | Reason |
|---|---|
| **Online card payments / payment processing** | Real value, but depends on a processor that works in Jamaica and on the Play Billing decision; recording payments solves the immediate problem. *Reconsider after V2 once local payment methods are validated.* |
| **Full calendar / dispatch / drag-and-drop scheduling** | Small crews can work from project dates and task due dates; a scheduler is a large build for an unproven need. |
| **Job costing, budgets vs actuals, expense tracking** | Valuable to remodelers, but needs quotes, invoices *and* expenses to be meaningful; adds accounting complexity. |
| **Change orders** | Natural extension of quotes, but only after quotes are used in real jobs. |
| **Time tracking / crew clock-in** | A larger-crew need; target contractor is 1–5 people. |
| **Cost database / supplier pricing / takeoffs** | Needs supplier partnerships; fails "setup-free". |
| **Accounting integrations (QuickBooks etc.)** | Integration cost; target contractor mostly does not use accounting software. Export covers the need. |
| **Customer accounts / customer app** | The no-login client link meets the need; accounts add friction. |
| **Subcontractor / vendor portals** | Multi-party complexity; belongs to bigger firms. |
| **Selections, design boards, 3D** | Houzz territory; niche. |
| **RFIs, submittals, drawings, compliance** | Procore territory; wrong customer. |
| **Marketing automation, ads, paid promotion** | Conflicts with "leads are yours" and distracts before the core loop works. |
| **Likes, general comments, follower feed** | Do not create hiring trust; add moderation load. Keep **save** and **request a quote**. |
| **WhatsApp Business API integration** | V2 uses tap-to-open WhatsApp links logged on the contact; API access has cost and approval overhead; reconsider with usage data. |
| **iOS app** | Prove Android and the web first. |
| **Public API / integrations marketplace** | Premature. |
| **Multiple businesses per user, business switcher** | Edge case for the target contractor. |
| **AI features** | No user problem has been identified that requires them yet. If one emerges (e.g. drafting a quote from a voice note), evaluate it then. |

---

## 12. Sequencing and what to validate

### Build order (dependencies, not dates)
1. **Foundations** (audit blockers) in parallel with **#17 search/Explore fixes**.
2. **Chain core:** #3 hardened quote request → #4 lead inbox → #5 quotes → #6 client link → #7 project hub → #9 tasks → #8 site updates → #10 payments record → #11 publish to portfolio → #12 reviews.
3. **Around the chain:** #1 onboarding/checklist, #2 profile v2, #13 notifications, #14 team scoping, #16 export.
4. **Commercial:** #15 billing enforced (after the billing-platform decision).
5. **Field:** #18 offline, then #19 Android shell and Google Play closed testing.

The chain in step 2 is the product. If time runs short, cut from step 4 and 5 before touching step 2.

### Validate with real contractors before and during the build
These are bets this document depends on. None have been tested.
1. **Activation moment:** is "first quote sent" what makes contractors stick, or is it "first inbound lead"? Test with 8–10 contractors: watch them onboard on a phone.
2. **Willingness to pay:** is $50/month (with one user) acceptable in Jamaica, and in USD or JMD? Is a cheaper solo tier needed?
3. **Quotes:** how do they quote today (WhatsApp text, paper, photo of notebook)? How much GCT and tax detail is expected?
4. **Client link:** will customers open a link and accept a quote on their phone? What do they need to see to trust it?
5. **Payments:** how do customers pay deposits today (bank transfer, cash, Lynk, card)? This decides the post-V2 payments phase.
6. **Discovery:** do customers actually browse Explore, or do enquiries come from shared profile links? This tells us how much to invest in marketplace features versus sharing tools.
7. **Reviews:** will customers leave a review if asked on the client link at completion?

### Success measures (targets, not predictions)
- **Activation:** share of new contractors who send a first quote within 7 days (**target** to be set after the first cohort; I have no baseline).
- **Time to first quote** on a phone (**target:** one session).
- **Retention:** contractors with a site update or task completed in a given week.
- **Loop health:** projects completed → portfolio items published → reviews received → inbound quote requests per profile.
- **Customer side:** quote requests that reach "quote viewed" and "quote accepted".

---

## One-page summary

- **Who:** 1–5 person trades businesses in Jamaica, working from their phones; customers who want a trustworthy local contractor and are afraid of being let down.
- **Problem:** leads, quotes and job proof are scattered across WhatsApp and the gallery; good work is invisible outside referrals.
- **Promise:** *Get found, win the job, show the work, from one phone. Your leads are yours.*
- **Loop:** quote → project → site updates → paid → publish to portfolio → verified review → more quote requests.
- **Revenue:** one simple month-to-month subscription (starting from $50 incl. 1 user, +$20/user, to be validated); free client access; never pay-per-lead.
- **V2 = the whole chain, nothing beyond it.** 19 features, each tied to a user problem and a loop step; calendar, job costing, online payments, accounting, subcontractors, design tools and API are deliberately out.
