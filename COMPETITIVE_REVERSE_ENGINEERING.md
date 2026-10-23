# BuildFlow: Competitive Reverse Engineering

**Purpose.** Reverse engineer the *product principles* behind the leading construction and home-service platforms, compare them with BuildFlow V1, and set a V2 feature hierarchy. Nothing here copies interfaces or proprietary implementations; it extracts what users value and why.
**Status.** Research and recommendation only. Nothing has been implemented.
**Companion doc.** `V2_AUDIT.md` covers the technical state of V1. This document covers the product direction.

### How to read the evidence
- Sources are public reviews (Capterra, GetApp, G2, TrustRadius, Trustpilot), vendor pages, and comparison articles, gathered October 2026. Links are at the end.
- **Many comparison articles are written by competitors** (Projul, OneCrew, Connecteam, Workyard). Their complaints are directionally useful but biased; they are marked *(competitor source)*.
- **Prices conflict between sources** and change often. They are given as ranges to show the *pricing model*, not as quotes. Confirm on vendor pages before using any figure externally.
- Review sites over-represent strong opinions. A complaint that appears across several products and several sites is treated as an **industry pattern**; a single complaint is treated as an anecdote.
- Nothing here was tested hands-on inside competitor products.

---

## 1. Market map

The market splits into four jobs. Each leader is built around one of them, and their weaknesses come from stretching into the others.

| Job | Leaders | Core promise | Typical buyer |
|---|---|---|---|
| **Run service jobs** (quote → schedule → invoice → get paid) | Jobber (also Housecall Pro, ServiceTitan at the high end) | "Get paid faster, look professional" | 1–15 person trade/service business |
| **Run remodel/build projects** (estimate → selections → schedule → change orders → client portal) | Buildertrend, JobTread, Contractor Foreman, Houzz Pro (also CoConstruct, now part of Buildertrend) | "Run the whole job in one place" | Remodelers, custom home builders |
| **Run large commercial projects** (RFIs, submittals, drawings, compliance) | Procore | "One platform for every stakeholder on a big job" | GCs and owners with large annual volume |
| **Get customers** (marketplace / lead gen) | Houzz (consumer side), Angi, Thumbtack; locally ClickAway (Jamaica) | "We send you customers" | Any contractor needing work |

**BuildFlow's V1 position** sits between "get customers" (profiles, explore, quote requests) and a light version of "run projects" (leads, customers, projects, tasks). **Only Houzz Pro combines a consumer discovery network with contractor business software**, and it is also the product with the most complaints about lead quality, price and cancellation. That is the opening.

---

## 2. Competitor teardown

### 2.1 Houzz Pro (discovery network + business software)
- **Exceptional:** A huge consumer audience with inspiration photos, so contractor portfolios get seen. Quoting is praised as quick, with pre-loaded templates. Combines marketing (profile, ads, website) with CRM, estimates, invoicing and project tools. Design visuals (mood boards, 3D floor plans) for design-led firms.
- **Unnecessarily complicated:** A broad suite where many contractors only use a fraction; reviewers call navigation confusing and the UI slow; billing and payment flows described as confusing.
- **Users value:** Being visible where homeowners browse; fast, good-looking estimates; one login for marketing and operations.
- **Users complain about:**
  - Price (listed from roughly $399/month on aggregators) relative to return.
  - **Lead quality:** reviewers report bots, unresponsive enquiries, and mismatched job types; Houzz states leads are not guaranteed.
  - **Contracts and cancellation:** on Capterra, almost all reviews that mention cancellation are negative (auto-renewals, strict annual contracts, hard-to-cancel).
  - Inconsistent support.
- **Industry expectation set:** A contractor profile with portfolio and reviews is how homeowners judge trust.
- **Gap:** Honest, verified, non-shared leads; month-to-month pricing; a profile that produces leads without paying for ads.

### 2.2 Jobber (service-business operations)
- **Exceptional:** The quote → job → invoice → payment loop is fast and simple; client self-serve hub (view visits, approve quotes, pay, download receipts) on every plan; automated reminders and follow-ups; strong scheduling and dispatch; review requests and marketing add-ons; clear onboarding for small teams.
- **Unnecessarily complicated:** Tier gating. Online booking, automations and some marketing tools sit on higher plans, and add-ons stack on top.
- **Users value:** Looking professional to clients; getting paid faster; scheduling the crew without phone calls.
- **Users complain about:**
  - The mobile app lacks desktop features, and users ask for better offline access.
  - It is limited for multi-phase projects, job costing and takeoffs (fine for service, tight for remodel).
  - Reporting flexibility.
  - Card processing fees (about 2.9% + 30¢ reported).
  - Price jumps between tiers.
- **Pricing model:** Per-tier subscription with user caps plus per-seat add-ons. Reported 2026 figures range from about $29–49/month (solo) to $400–600/month (15 users), depending on source.
- **Industry expectation set:** **A client portal is table stakes; online quote approval and online payment are expected.**
- **Gap:** Project-based work (phases, change orders, progress photos to the client) and any discovery or marketplace side.

### 2.3 Buildertrend (residential construction PM)
- **Exceptional:** End-to-end residential build management: schedules (Gantt), selections, change orders, daily logs with photos, weather and location, a client portal for schedule, photos, selections and messages, budgets and job costing. It has **offline daily logs and time clock** that sync later, built because rural sites lose signal; the vendor reports most users hit this weekly.
- **Unnecessarily complicated:** Feature breadth. Small contractors say they pay for features they never use; crew training takes weeks *(competitor source)*.
- **Users value:** The client portal (fewer "what's happening?" calls); daily logs as a legal record; selections and change orders that are in writing.
- **Users complain about:**
  - Steep learning curve.
  - Price (reported $400–1,100/month, with onboarding packages extra).
  - **No simple bulk data export** (a Capterra reviewer said files, photos and proposals cannot be easily downloaded).
  - App slowness and crashes on poor signal *(competitor source)*.
- **Industry expectation set:** **Daily logs with photos, a client-visible schedule, change orders in writing, offline capture in the field.**
- **Gap:** Simplicity for small crews; data ownership/export; affordability.

### 2.4 Procore (commercial construction platform)
- **Exceptional:** Depth for large projects (RFIs, submittals, drawings, inspections, compliance), unlimited users so every stakeholder can be invited, a large integration marketplace, strong mobile capture for field logs and photos.
- **Unnecessarily complicated:** Everything for a small contractor. Proficiency is said to take months *(competitor source)*.
- **Users value:** One source of truth across owner, GC, subs; unlimited users.
- **Users complain about:**
  - Pricing is based on **Annual Construction Volume**, not users. That makes it prohibitive for small firms, and renewals rise as volume grows.
  - Slow support.
  - Crashes and lost data reported.
- **Industry expectation set:** **Do not charge per user for collaborators** (clients, subs, viewers). Procore and JobTread both make this explicit.
- **Gap:** Not relevant to small contractors. It is a reference point for what *not* to build in V2.

### 2.5 Contractor Foreman (low-cost all-in-one)
- **Exceptional:** Very broad feature list at a low entry price (about $49/month reported); a praised cost database for estimates; many modules (estimates, schedules, daily logs, time cards, invoices, safety).
- **Unnecessarily complicated:** "Everything module" sprawl at a budget price means many shallow features; per-user daily charges (about $1/user/day reported, *competitor source*) make cost unpredictable.
- **Users value:** Price-to-features ratio.
- **Users complain about:** Depth and polish versus price; total cost once users are added.
- **Industry expectation set:** Small contractors expect **estimating, scheduling, invoicing and daily logs** even at entry price.
- **Gap:** Focus. Doing the core loop very well instead of 30 modules adequately.

### 2.6 JobTread (fast-growing remodel/build PM)
- **Exceptional:**
  - Highly rated estimates and proposals (G2 proposal creation 9.5 vs Buildertrend 6.9 on small samples).
  - Integrated job costing.
  - **Unlimited customer and vendor portal users at no extra cost.**
  - Simple pricing: about $159–199/month for the first user + about $18–20 per additional user.
  - Free implementation and training, no contracts *(partly competitor source)*.
  - Strong support ratings and frequent updates.
- **Unnecessarily complicated:** Very configurable; power comes from setup work (custom fields, templates).
- **Users value:** Proposals that win jobs; knowing whether a job is profitable; no contract lock-in; support that responds.
- **Users complain about:** Small review base (65 on G2), so complaints are less visible. It has no consumer discovery.
- **Industry expectation set:** **Proposal → approval → job → budget-vs-actual in one flow; transparent per-user pricing; no annual lock-in.**
- **Gap:** Getting customers in the first place.

### 2.7 Lead marketplaces: Angi, Thumbtack (and ClickAway locally)
- **Exceptional:** Demand aggregation; consumers come to them first.
- **Users complain about:**
  - **Pay-per-lead pricing for shared leads**, so several pros pay for the same request.
  - Invalid or unresponsive contacts and difficulty getting credits.
  - Rising lead prices.
  - Billing and cancellation disputes.
  - In 2023 the FTC finalized an order requiring HomeAdvisor (Angi's affiliate) to pay up to $7.2 million over misleading claims about lead quality.
- **ClickAway (Jamaica):** A local matching app with job bidding, communication and payments; reported about 2,800 users during beta. It is a direct local competitor for the "find a tradesperson" side, though it is not a contractor operating system.
- **Industry lesson:** **Contractors distrust paid leads.** A platform that never sells or shares their leads is a differentiator in itself.

---

## 3. Product principles by area (25 areas)

For each area: the **industry expectation** (what a contractor now assumes exists), the **remaining gap** across competitors, and where **BuildFlow V1** stands. V1 status is from the repository, not assumed.

| # | Area | Industry expectation | Remaining gap in market | BuildFlow V1 |
|---|---|---|---|---|
| 1 | **Onboarding** | Guided setup with sample data; done-for-you import (Buildertrend, JobTread offer free implementation); first value in a session | Weeks of setup on the PM tools; long trials hide value | Signup → business → services → profile is short and works; no sample data in a real account, no import, no checklist |
| 2 | **Information architecture** | Organised around the *job*: everything (contacts, docs, money, schedule) hangs off it | Module-first menus (Estimates, Schedules, Logs…) make users hunt | Organised by object (Leads, Customers, Projects, Posts); lead → customer → project chain exists but is loosely linked |
| 3 | **Navigation** | Mobile bottom tabs for field; desktop sidebar for office; global "+" create | Desktop-first products bolt mobile on later | Bottom tabs + sidebar at `md`; good base. No global quick-create |
| 4 | **Lead management** | Pipeline with stages, source tracking, follow-up reminders, speed-to-lead alerts | Leads from marketplaces arrive dirty, shared, unverified | Pipeline, statuses, source, quote request → lead works. No reminders, no response-time tracking, no lead verification |
| 5 | **CRM** | Contact history timeline, tags, notes, linked jobs, one-click call/text/WhatsApp | CRMs bolted onto PM tools are thin | Leads and customers with notes; activity log exists; no unified timeline per contact, no call/WhatsApp actions |
| 6 | **Customer management** | Customer record with all jobs, quotes, invoices, payments, communications | Data fragmentation across modules | Customer record links projects; nothing financial or communication history |
| 7 | **Scheduling** | Calendar of jobs/visits by crew; drag to reschedule; client notified automatically | Service tools schedule visits; PM tools schedule phases; few do both simply | **Missing.** Projects have start/end dates; tasks have due dates; no calendar |
| 8 | **Project management** | Phases/milestones, status, budget vs actual, progress photos, daily logs | Over-engineered (Gantt, dependencies) for small crews | Projects with status, budget, tasks, photos, files. No phases, no daily log, no budget-vs-actual |
| 9 | **Task management** | Assign to crew, due date, checklist, mobile completion with photo proof | Usually buried inside projects | Tasks with priority/status/due date/assignee; **timezone bug** on due dates (see audit); no checklist or photo proof |
| 10 | **Client communication** | In-app messages tied to the job, plus automated texts/emails (on the way, quote sent, invoice due) | Clients still phone/WhatsApp; messages get lost outside the system | **Missing.** Contact form → lead only; no two-way messaging, no email/SMS/WhatsApp |
| 11 | **Client portals** | Client sees schedule, photos, documents; approves quotes/changes; pays; **free unlimited client access** | Portals require account creation, which clients resist | **Missing.** Quote requester has no status view |
| 12 | **Estimates/proposals** | Line items, templates/cost library, good-looking PDF, e-signature/online approval, deposit request | Supplier pricing feeds; clean print output; local tax handling | **Missing.** Only a free-text "budget" on quote requests and projects |
| 13 | **Invoicing** | Invoice from approved quote/progress; online payment; reminders; deposits; QuickBooks sync | Processing fees; poor support for local payment methods | **Missing** |
| 14 | **Project documentation** | Daily logs (who, what, weather, photos), change orders, signed approvals, exportable record | Bulk export of all records is weak (Buildertrend complaint) | Project files + photos only. No daily log, no change orders, no export |
| 15 | **Photos/files** | Fast capture from phone, auto-tag to job, before/after, annotate, share selected photos to client/portfolio | Slow uploads on weak signal; large files; no offline queue | Upload works; **no resize/EXIF strip, 10 MB originals, HEIC issues** (audit D3); no before/after pairing; project photos and portfolio posts are separate flows |
| 16 | **Notifications** | Push + email + SMS; per-event preferences; client-facing automations | Notification overload; little control | In-app list only. No push, email, SMS, or preferences |
| 17 | **Team management** | Roles, field vs office permissions, assignment, time tracking, per-user pricing or unlimited users | Per-user costs make owners avoid inviting crew | Invite + owner/admin/member roles; **members see everything** (no assigned-only), no time tracking |
| 18 | **Contractor profiles** | Portfolio, services, area, licences/insurance, reviews, response time, verified badge | Profiles exist to sell ads; little verification | Strong: public profile, portfolio posts, services, region, quote CTA. No verification, no reviews, no response-time signal |
| 19 | **Reviews** | Verified reviews from real jobs, automated review requests after completion, reply to reviews | Fake reviews; reviews not tied to real jobs | **Missing** |
| 20 | **Customer discovery** | Search by service + area; inspiration browsing; trust signals; request a quote | Paid, shared, low-quality leads; contractors pay whether or not they win | Explore feed, search, filters, quote request; free to contractors. Search breaks past 500 businesses (audit) |
| 21 | **Mobile workflows** | One-hand field tasks: photo, log, complete task, clock in, call/text/navigate | Mobile apps lag desktop (Jobber, Buildertrend complaints) | Mobile-first web; works at 390 px. No camera-first flows, no navigation/call shortcuts |
| 22 | **Offline workflows** | Capture offline, sync later (Buildertrend daily logs/time clock) | Most tools are online-only or partial | **Missing**; no service worker |
| 23 | **Pricing models** | Small-team tiers with transparent per-user add-ons; free client/sub access; monthly, no lock-in | ACV pricing (Procore), annual lock-ins (Houzz), tier gating (Jobber), per-day user fees | Basic $50/mo incl. 1 user + $20/user; data-driven plans. **Not enforced; no billing** |
| 24 | **Activation mechanisms** | First quote sent, first invoice paid, first job scheduled within a week; checklists; sample data | Long setup before value | Onboarding ends at a profile; no "first lead/first post/first project" checklist; no activation tracking |
| 25 | **Retention mechanisms** | Money flows through the product (payments), client portal habit, automations, data gravity, reviews accumulating | Lock-in via contracts instead of value | Weak: no payments, no recurring client touchpoints, no reviews. Social feed is the only habit loop |

---

## 4. Cross-industry patterns (the principles)

1. **Organise around the job, not the module.** Every successful product makes "the job" the hub (contacts, money, schedule, photos, messages). Products that organise by module get "confusing navigation" complaints.
2. **The client is a user, but must never feel like one.** Portals win when access is free and frictionless (link, not account). Charging per client seat is rejected industry-wide.
3. **Money in the product equals retention.** Quote approval → deposit → invoice → payment is the habit that keeps Jobber and JobTread customers; tools without payments are easy to leave.
4. **Field capture must survive no signal.** Offline daily logs and time clock are now a named feature because rural sites lose signal weekly.
5. **Complexity is the #1 churn reason for small contractors** ("pay for features I don't use", "weeks to train"). Breadth sells demos; focus keeps customers.
6. **Contractors distrust paid leads and lock-in contracts.** Lead quality, shared leads, auto-renewals and cancellation fees dominate complaints about Houzz and the marketplaces.
7. **Data ownership is a trust signal.** Inability to export is a recurring complaint; easy export is a cheap differentiator.
8. **Proof beats promises.** Before/after photos, daily logs and verified reviews tied to real jobs are what homeowners trust and what protect contractors in disputes.

---

## 5. KEEP · IMPROVE · REMOVE · ADD · DIFFERENTIATE

### KEEP
- **Combined discovery + CRM in one product.** Only Houzz does this and is widely disliked for price and lead quality; the combination is the strategic asset.
- **Quote request → lead created automatically**, with the contractor's own data, free, unshared. Keep it free and exclusive.
- **Public contractor profile with portfolio** at a shareable URL (`/contractor/[username]`).
- **Mobile-first layout** with bottom tabs, simple object model (lead → customer → project → task).
- **Transparent, low entry price** ($50 incl. 1 user, +$20/user), month-to-month. This positions against Houzz Pro (≈$399) and Buildertrend (≈$400+) and sits near JobTread's per-user model.
- **Strong tenant isolation and server-side data access** (see audit).

### IMPROVE
- **Lead management:** follow-up reminders, "time to first response" shown to the contractor, stale-lead nudges, quick actions (call / WhatsApp / email) on every lead.
- **One contact timeline:** merge lead and customer history into one record with everything (requests, messages, quotes, projects, photos).
- **Project hub:** make the project page the centre (tasks, photos, files, client updates, money) instead of separate lists.
- **Photos:** camera-first capture, compression and EXIF strip, before/after pairing, and "share to portfolio" from project photos so the social feed is a by-product of real work, not separate effort.
- **Profiles:** add trust signals (verified phone/business, licence/insurance fields, response time, jobs completed, reviews).
- **Search and discovery:** server-side search by service + area that scales; parish/region-first browsing for the local market.
- **Onboarding:** an activation checklist (complete profile → first post → share profile link → first lead → first project) and an optional import of contacts.
- **Tasks:** fix timezone handling; assign to crew with mobile completion and photo proof.
- **Team permissions:** field member sees only assigned projects/tasks; office/admin sees all.
- **Notifications:** add email and push, with preferences.

### REMOVE (or demote)
- **Separate "posts" authoring as the main content path.** Demote stand-alone posting in favour of publishing from project photos. Keep posts, but stop making contractors create content twice.
- **Social mechanics that do not drive hiring** (likes, generic comments) from prominent positions. Keep saves and "request a quote from this post"; vanity metrics add moderation load without business value. Re-evaluate with usage data.
- **Hand-maintained demo codebases** (`demo-site/`, `demo-artifact/`) as the partner-facing product (see audit F.1).
- **Unbounded per-view analytics events.** Replace with daily counts that answer contractor questions ("profile views → quote requests").
- **Anything Procore-style** (RFIs, submittals, drawings) from consideration for V2.

### ADD
- **Estimates/quotes** with line items, simple templates, tax/GCT handling, a branded PDF, online accept via link, and deposit request. This is the single biggest functional gap versus every competitor.
- **Client link (lightweight portal):** a no-login, unguessable link per quote/project where the client sees status, photos, quote, approves, and messages. Free and unlimited.
- **Invoices and payment status** (recorded payments first; online payments when a local-friendly processor is chosen).
- **Simple schedule:** a calendar/agenda of project dates, visits and tasks by crew member; client notified of visit dates.
- **Daily log / site update:** photo + note + optional weather, offline-capable, optionally shared to the client link.
- **Messaging:** job-linked messages plus one-tap WhatsApp/call/email handoff that logs the touchpoint on the contact timeline.
- **Verified reviews:** requested automatically when a project is marked complete; only clients tied to a real project can review; contractor can reply.
- **Offline capture** for photos, logs and task completion with background sync.
- **Data export** (CSV for contacts/leads/projects, ZIP for photos/files) available on every plan.
- **Activation and retention analytics** for BuildFlow itself (time to first lead, first quote, weekly active businesses).

### DIFFERENTIATE
1. **"Your leads are yours."** Never sell, share or auction quote requests. Contractors pay a flat subscription, not per lead. This is a direct answer to the biggest complaint about Houzz, Angi and Thumbtack.
2. **Work becomes marketing automatically.** Project photos → before/after → portfolio post → profile → new quote requests. Neither the PM tools (no discovery) nor marketplaces (no operations) close this loop.
3. **Verified proof of work.** Reviews and portfolio items linked to real completed projects in BuildFlow ("Verified job"), giving homeowners a trust signal marketplaces cannot fake.
4. **Built for the Caribbean field reality.** Offline-first capture, low-data image handling, WhatsApp as a first-class channel, parish-level areas, JMD/USD and GCT, local payment methods. Global tools treat these as edge cases.
5. **Simple by default.** Do the core loop (get found → quote → win → deliver → showcase → get reviewed) better than anyone, with no setup consultant needed. Resist Contractor Foreman–style module sprawl.
6. **Fair commercial terms.** Month-to-month, cancel in-app, full data export, free client access. Directly contrasts the Houzz cancellation complaints and Procore's ACV pricing.

---

## 6. Recommended V2 feature hierarchy

Ordering assumes the production blockers in `V2_AUDIT.md` (indexes, abuse protection, image pipeline, account deletion, legal text, monitoring) are done first or in parallel. Those are prerequisites, not features, and are not repeated here.

### P0: absolutely necessary for V2
The minimum for a contractor to run real jobs in BuildFlow and for the core loop to work end to end.

| Feature | Why P0 |
|---|---|
| **Estimates/quotes** (line items, templates, tax, PDF, accept via link, deposit request) | Every competitor has it; contractors cannot "win" a lead in-app without it |
| **Client link** (no-login view: quote, status, photos; approve; message) | Industry expectation; closes the loop for the customer who requested a quote |
| **Contact timeline** (lead + customer merged history, quick call/WhatsApp/email, logged) | Fixes fragmented CRM; WhatsApp is the real channel |
| **Lead follow-up** (reminders, stale-lead nudges, response time) | Speed-to-lead decides wins; cheap to build |
| **Project hub** with **site updates/daily log** (photo + note, shareable to client) | Core field workflow and proof of work |
| **Photo pipeline v2** (camera-first, compressed, EXIF stripped, before/after, publish-to-portfolio) | Feeds both operations and discovery; also a privacy fix |
| **Role-scoped access** (field members see assigned work only) | Promised in V1 spec; required before teams use it |
| **Notifications: email + push** for new quote request, quote accepted, client message, task assigned | Without delivery outside the app, leads go cold |
| **Billing with enforcement** (subscription, trial expiry, seat count) | Business model; decide Stripe vs Play Billing first (audit H.2) |
| **Data export** (CSV + photo ZIP) | Trust and differentiation; low effort |
| **Activation checklist** in onboarding | Converts signups into working accounts |
| **Discovery search that scales** (service + area, index-backed) | Current search silently fails past 500 businesses |

### P1: important, next
| Feature | Why P1 |
|---|---|
| **Invoices + payment recording**, then online payments with a locally viable processor | Money-in-product is the strongest retention lever; depends on processor choice for Jamaica |
| **Verified reviews** tied to completed projects, auto-requested, with replies | Key trust signal and differentiator; needs completed-project volume first |
| **Schedule/calendar** (agenda by crew; visit notifications to clients) | Expected, but small crews can operate on project dates initially |
| **Offline capture** (photos, site updates, task completion; background sync) | Real field need; build after the capture flows are stable |
| **Profile trust signals** (verified phone/business, licence/insurance, response time, jobs completed) | Improves lead conversion for good contractors |
| **Change orders** (scope/price change approved via client link) | Protects contractors in disputes; natural extension of estimates |
| **WhatsApp Business integration** (templated notifications) beyond tap-to-open | Higher reach; requires WhatsApp Business API account and cost review |
| **Notification preferences** and digest | Prevents overload once more events exist |
| **Contractor insights** ("profile views → quote requests → won jobs", response time) | Shows ROI of the platform, which is a retention mechanism |
| **Native Android shell** (Capacitor) with push and camera | Path to Google Play closed testing |

### P2: later
| Feature | Why later |
|---|---|
| Job costing / budget vs actual | Valuable for remodelers; needs estimates + invoices + expenses first |
| Time tracking / crew clock-in (offline) | Useful for larger crews; not core to the discovery loop |
| Cost/item library with supplier pricing | Speeds estimates; needs supplier partnerships |
| Accounting sync (QuickBooks or local equivalent) | Integration cost; validate demand in-market |
| Customer accounts (saved contractors, project history across contractors) | Client link covers the need first |
| Sub-contractor/vendor collaboration | Multi-party complexity; Procore territory |
| Selections / design boards | Houzz territory; niche for design-led firms |
| Marketing automation (campaigns, repeat-customer reminders) | After core retention is proven |
| Public API / integrations marketplace | Only with scale |
| iOS app store release | After Android closed testing proves the shell |

### Explicitly not planned
- Pay-per-lead or lead auctions.
- Annual-only contracts or cancellation fees.
- Commercial-construction modules (RFIs, submittals, drawing management).

---

## 7. Open questions to validate with contractors

These need real interviews in the target market, not more desk research:
1. Do contractors quote in JMD, USD or both, and is GCT shown on quotes?
2. Which payment methods do clients actually use for deposits (bank transfer, card, Lynk, cash)? This decides the payments phase.
3. How much client communication happens on WhatsApp today, and would contractors accept messages being logged in BuildFlow?
4. Does the social feed drive quote requests, or do contractors mainly share their profile link directly? (Instrument this before investing more in feed features.)
5. What is the typical crew size and how many members would need logins?
6. Which offline moments matter most: photos, notes, task completion, or time?

---

## Sources
- Houzz Pro: [Capterra](https://capterra.com/p/199689/Houzz-Pro/), [Capterra reviews](https://www.capterra.com/p/199689/Houzz-Pro/reviews/?page=7%5C), [GetApp reviews](https://www.getapp.com/construction-mechanics-software/a/houzz-pro/reviews/), [Trustpilot (Houzz UK)](https://www.trustpilot.com/review/houzz.co.uk), [ComplaintsBoard](https://www.complaintsboard.com/houzz-auto-renewing-contract-c1128375), [Contractor Talk](https://www.contractortalk.com/posts/8342066), [Sidehusl](https://sidehusl.com/houzz/)
- Jobber: [ContractorToolStack pricing](https://contractortoolstack.com/software/jobber/pricing/), [FieldCamp reviews](https://fieldcamp.ai/reviews/jobber-reviews/), [SchedulingKit review](https://schedulingkit.com/reviews/jobber-review), [SchedulingKit pricing](https://schedulingkit.com/pricing-guides/jobber-pricing), [Software Advice](https://www.softwareadvice.com/scheduling/jobber-profile/), [TrustRadius](https://www.trustradius.com/products/jobber/reviews), [OneCrew](https://www.getonecrew.com/post/jobber-reviews) *(competitor)*, [SchedulingKit pros/cons](https://schedulingkit.com/pros-and-cons/jobber-pros-and-cons), [Capterra pricing](https://capterra.com/p/127994/Jobber/pricing/)
- Buildertrend: [GetApp reviews](https://www.getapp.com/construction-software/a/buildertrend/reviews/), [Projul pricing analysis](https://projul.com/blog/buildertrend-pricing-analysis-2026/) *(competitor)*, [OneCrew](https://www.getonecrew.com/post/buildertrend-reviews) *(competitor)*, [Tools for Humans](https://www.toolsforhumans.ai/ai-tools/buildertrend), [Buildertrend offline blog](https://buildertrend.com/blog/offline-time-clock-daily-logs/), [Buildertrend app](https://buildertrend.com/app/), [Connecteam review](https://connecteam.com/reviews/buildertrend/) *(competitor)*, [Workyard review](https://www.workyard.com/compare/buildertrend-review) *(competitor)*
- Procore: [Constructable](https://constructable.ai/blog/procore-reviews-pricing-alternatives), [Jibble](https://jibble.io/construction-software-reviews/procore), [SoftwareConnect](https://softwareconnect.com/reviews/procore/), [Lark](https://www.larksuite.com/en_us/blog/procore-review)
- JobTread / Contractor Foreman: [G2 comparison](https://www.g2.com/compare/contractor-foreman-vs-jobtread), [GetApp comparison](https://www.getapp.com/construction-software/a/contractor-foreman/compare/jobtread/), [Projul JobTread pricing](https://projul.com/blog/jobtread-pricing-analysis-2026/) *(competitor)*, [Projul alternatives](https://projul.com/blog/best-jobtread-alternatives) *(competitor)*, [SoftwareConnect](https://softwareconnect.com/reviews/jobtread/), [Capterra](https://capterra.com/p/218503/JobTread/), [TrustRadius pricing](https://trustradius.com/products/jobtread/pricing), [G2 Buildertrend vs JobTread](https://www.g2.com/compare/buildertrend-vs-trimble-trimble-viewpoint-team-vs-jobtread)
- Lead marketplaces: [Trustpilot Angi](https://ch.trustpilot.com/review/angi.com), [Trustpilot Thumbtack](https://ca.trustpilot.com/review/thumbtack.com?page=2), [Automate the Journey](https://automatethejourney.com/firstlap/blog/are-angi-thumbtack-leads-worth-it), [Sikayetvar Angi for Pros](https://www.sikayetvar.com/en/angi-for-pros-us)
- Jamaica: [Jamaica Observer on ClickAway](https://jamaicaobserver.com/business/clickaway), [ClickAwayJA App Store](https://apps.apple.com/dk/app/clickawayja/id1586624571)
