# BuildFlow — Product Requirements (V1)

## Positioning
"Run your construction business. Showcase your work. Win more jobs."
Your construction business, projects, customers and reputation — all in one place.

## Users
| Role | V1 priority | Can |
|---|---|---|
| Contractor / Business owner | Primary | Manage business, leads, customers, projects, tasks, posts, profile, team, billing |
| Team member | Basic | View business data, update leads/projects/tasks, add notes; cannot delete, edit profile, manage team/billing |
| Customer | Primary | Browse, search, view profiles/posts, like, save, comment, follow, contact, request quotes |
| Platform admin | Basic | Metrics, users, businesses (verify/suspend), reports, plans, categories |

## Core loop (definition of done)
1. Sign up → 2. Create business → 3. Public profile → 4. Add services → 5. Upload images → 6. Post project →
7. Customer discovers profile → 8. Requests quote → 9. Lead appears → 10. Convert to customer → 11. Create project →
12. Add tasks → 13. Update project → 14. Complete → 15. Showcase → 16. New discovery.
All 16 steps are covered by the browser E2E run; tenant isolation by `tests/rules` and `tests/integration`.

## Feature requirements
- **Auth:** email/password, logout, reset, verification. Contractors are routed to onboarding.
- **Onboarding:** account → business → services → service area → logo/cover → first project/customer → finish. Progress bar; every step after business creation is skippable.
- **Public profile:** answers WHO / WHAT / WHERE / WHAT THEY'VE BUILT / HOW TO CONTACT above the fold. Primary CTA *Request a quote*, secondary *Contact*; sticky on mobile. Verified badge placeholder, followers, portfolio, posts, services, area, years, social links, reviews placeholder, report.
- **Social:** post types completed project, before/after, work in progress, project update, service showcase, business update. Images, caption, project link, service, location. Like, save, comment, follow, share. No messaging.
- **Discovery:** Explore (work feed + contractors), search by name/service/location with free-text parsing ("tilers in St Andrew").
- **CRM:** pipeline New → Contacted → Qualified → Quote sent → Negotiation → Won/Lost. Sources BuildFlow, Website, Referral, Social media, Phone, Other. Estimated value, assignment, notes, convert to customer, create project.
- **Customers:** name, phone, email, address, notes, projects, lead history, status, created date; search.
- **Projects:** name, customer, description, location, dates, status (Planning/Upcoming/In progress/On hold/Completed/Cancelled), budget, team, tasks, notes, photos, activity.
- **Tasks:** name, description, assignee, due date, priority (Low/Medium/High), status (To do/In progress/Done).
- **Dashboard:** new leads, active/completed projects, customers, pipeline value, recent activity, tasks due, profile views, quote requests, engagement; quick actions.
- **Analytics:** profile/post views, likes, comments, followers, saves, quote requests, lead sources, leads created/won, projects completed; month-over-month.
- **Notifications:** quote request, new lead, comment, follower, project assignment, task assignment (in-app).
- **Pricing:** Basic $50/mo incl. 1 user, +$20/user. Data-driven for future Pro/Business/Enterprise.
- **Reporting:** posts, comments, profiles; reasons spam, fraud, harassment, inappropriate, fake business, other.
- **Legal:** privacy, terms, SaaS refund/cancellation (configurable via `src/lib/legal.ts`), all flagged for legal review.

## Principles
Smallest useful version · no fake functionality (unbuilt features say "coming soon") · realistic empty states · mobile first (44px targets, bottom nav, sticky CTAs) · tenant data security first.
